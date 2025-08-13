import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import type { ParseResult } from "telomere";
import { createEngineBackend, type EngineBackend } from "./engine-backend";
import { registry } from "../template-utils/example-component-sets/registry";

vi.mock("telomere", () => ({ initTelomere: vi.fn() }));
import { initTelomere } from "telomere";

const NC: ParseResult = { type: "NotClosable" };
const S = (cap = ""): ParseResult => ({ type: "Success", cap });

function mockTelomere(sequence: ParseResult[]) {
  const processDelta = vi
    .fn<(d: string) => ParseResult>()
    .mockImplementation(() => NC);
  sequence.forEach((r) => processDelta.mockImplementationOnce(() => r));
  const reset = vi.fn();
  vi.mocked(initTelomere as unknown as any).mockResolvedValue({
    processDelta,
    reset,
  } as any);
  return { processDelta, reset };
}

async function mkEngine(sequence: ParseResult[]) {
  const { reset } = mockTelomere(sequence);
  const onNext = vi.fn();
  const onInvalid = vi.fn();
  const engine = await createEngineBackend({
    schema: registry.schema,
    onNext,
    onInvalid,
    debug: true,
  });
  return { engine, onNext, onInvalid, reset };
}

/* ------------------------- Stateless unit tests ------------------------- */

describe("engine-backend (stateless cases)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
  });

  it("emits onNext only when a stable, valid frame arrives (streamed)", async () => {
    const { engine, onNext, onInvalid } = await mkEngine([NC, S("")]);
    engine.next('{"id":"paragraph","content":"Hel');
    expect(onNext).not.toHaveBeenCalled();
    engine.next('lo"}');
    expect(onInvalid).not.toHaveBeenCalled();
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onNext).toHaveBeenCalledWith({ id: "paragraph", content: "Hello" });
  });

  it("treats missing required field as pending (no onInvalid)", async () => {
    const { engine, onNext, onInvalid } = await mkEngine([S("")]);
    engine.next('{"id":"heading","content":"T"}'); // missing level
    expect(onNext).not.toHaveBeenCalled();
    expect(onInvalid).not.toHaveBeenCalled(); // pending, not hard
  });

  it("rejects unknown keys due to strict() (hard error)", async () => {
    const { engine, onNext, onInvalid } = await mkEngine([S("")]);
    engine.next('{"id":"paragraph","content":"Hi","x":1}');
    expect(onNext).not.toHaveBeenCalled();
    expect(onInvalid).toHaveBeenCalledTimes(1);
  });

  // Probably worth addrssing at some point, but distinguishing between the zod errors is getting gnarly
  it.skip("reports wrong value type as onInvalid (hard)", async () => {
    const { engine, onNext, onInvalid } = await mkEngine([S("")]);
    // level must be a number; send string to trigger hard invalid_type
    engine.next('{"id":"heading","content":"Title","level":"2"}');
    expect(onNext).not.toHaveBeenCalled();
    expect(onInvalid).toHaveBeenCalledTimes(1);
  });

  it("reset clears stream state (and telomere state) before next frames", async () => {
    const { engine, onNext, onInvalid, reset } = await mkEngine([NC, S("")]);

    engine.next('{"id":"paragraph","content":"Part'); // NC
    engine.reset();
    expect(reset).toHaveBeenCalledTimes(1);

    engine.next('{"id":"paragraph","content":"Fresh"}'); // Success
    expect(onInvalid).not.toHaveBeenCalled();
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onNext).toHaveBeenCalledWith({ id: "paragraph", content: "Fresh" });
  });

  it("handles heading with required level", async () => {
    const { engine, onNext, onInvalid } = await mkEngine([S("")]);
    engine.next('{"id":"heading","content":"Title","level":2}');
    expect(onInvalid).not.toHaveBeenCalled();
    expect(onNext).toHaveBeenCalledWith({
      id: "heading",
      content: "Title",
      level: 2,
    });
  });
});

/* ----------------------- Stateful stream integration -------------------- */

describe.sequential(
  "engine-backend · stateful stream (invalid close → mid onNext → final onNext)",
  () => {
    let engine: EngineBackend;
    let onNext: ReturnType<typeof vi.fn>;
    let onInvalid: ReturnType<typeof vi.fn>;

    beforeAll(async () => {
      const ctx = await mkEngine([
        NC, // #1 open container (NC)
        S('"}]}'), // #2 cap: heading(content:"Ti") -> pending (missing level)
        S('"}]}'), // #3 cap: container{heading OK, paragraph "Hi the"} -> onNext #1
        NC, // #4 append paragraph tail (NC)
        S("]}"), // #5 cap: close container -> onNext #2
      ]);
      engine = ctx.engine;
      onNext = ctx.onNext;
      onInvalid = ctx.onInvalid;
    });

    it("#1 opens container (NotClosable)", () => {
      engine.next('{"id":"container","children":[');
      expect(onInvalid).toHaveBeenCalledTimes(0);
      expect(onNext).toHaveBeenCalledTimes(0);
    });

    it("#2 caps to valid JSON but missing required field → pending (no onInvalid)", () => {
      engine.next('{"id":"heading","content":"Ti');
      expect(onInvalid).toHaveBeenCalledTimes(0);
      expect(onNext).toHaveBeenCalledTimes(0);
    });

    it("#3 caps mid-stream to valid container (heading + paragraph 'Hi the') → onNext #1", () => {
      engine.next('tle","level":2},{"id":"paragraph","content":"Hi the');
      expect(onInvalid).toHaveBeenCalledTimes(0);
      expect(onNext).toHaveBeenCalledTimes(1);
      expect(onNext).toHaveBeenNthCalledWith(1, {
        id: "container",
        children: [
          { id: "heading", content: "Title", level: 2 },
          { id: "paragraph", content: "Hi the" },
        ],
      });
    });

    it("#4 stitches paragraph tail back into raw (NotClosable)", () => {
      engine.next('re"},');
      expect(onInvalid).toHaveBeenCalledTimes(0);
      expect(onNext).toHaveBeenCalledTimes(1);
    });

    it("#5 streams form and final cap closes container → onNext #2", () => {
      engine.next(
        '{"id":"form","children":[' +
        '{"id":"input","queryId":"name","queryContent":"Your name"},' +
        '{"id":"input","queryId":"email","queryContent":"Email"}' +
        "]}",
      );
      expect(onInvalid).toHaveBeenCalledTimes(0);
      expect(onNext).toHaveBeenCalledTimes(2);
      expect(onNext).toHaveBeenNthCalledWith(2, {
        id: "container",
        children: [
          { id: "heading", content: "Title", level: 2 },
          { id: "paragraph", content: "Hi there" },
          {
            id: "form",
            children: [
              { id: "input", queryId: "name", queryContent: "Your name" },
              { id: "input", queryId: "email", queryContent: "Email" },
            ],
          },
        ],
      });
    });
  },
);
