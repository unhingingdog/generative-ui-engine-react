// src/engine/engine.test.ts
import "@testing-library/jest-dom/vitest";
import { within, fireEvent } from "@testing-library/dom";
import { act } from "react-dom/test-utils";
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import type { ParseResult } from "telomere";

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

import { createCombinedEngine } from "./engine";
import { registry } from "../template-utils/example-component-sets/registry";

describe.sequential(
  "createCombinedEngine · stream → DOM render + submit (mock telomere)",
  () => {
    let rootNode: HTMLElement;
    let engine: Awaited<ReturnType<typeof createCombinedEngine>>;
    const onSubmit = vi.fn();

    beforeAll(async () => {
      mockTelomere([
        NC, // #1 open container (NC)
        S('"}]}'), // #2 cap: heading("Ti") -> pending (missing level)
        S('"}]}'), // #3 cap: container { heading OK, paragraph "Hi the" } -> onNext #1
        NC, // #4 paragraph tail (NC)
        S("]}"), // #5 cap: close container + form -> onNext #2
      ]);

      rootNode = document.createElement("div");
      document.body.appendChild(rootNode);

      engine = await createCombinedEngine({
        registry,
        rootNode,
        onSubmit,
        debug: true,
        logger: console,
        onInvalid: undefined,
      });
    });

    afterAll(() => {
      engine.destroy();
      document.body.removeChild(rootNode);
    });

    it("#1 NotClosable → no DOM", () => {
      act(() => engine.push('{"id":"container","children":['));
      const q = within(rootNode);
      expect(q.queryByRole("heading")).toBeNull();
      expect(q.queryByText(/hi the/i)).toBeNull();
    });

    it("#2 pending (missing level) → still no DOM", () => {
      act(() => engine.push('{"id":"heading","content":"Ti'));
      const q = within(rootNode);
      expect(q.queryByRole("heading")).toBeNull();
      expect(q.queryByText(/hi the/i)).toBeNull();
    });

    it("#3 onNext #1 → heading + partial paragraph", () => {
      act(() =>
        engine.push('tle","level":2},{"id":"paragraph","content":"Hi the'),
      );
      const q = within(rootNode);
      expect(
        q.getByRole("heading", { level: 2, name: /title/i }),
      ).toBeInTheDocument();
      expect(q.getByText("Hi the")).toBeInTheDocument();
      expect(q.queryByRole("button", { name: /continue/i })).toBeNull();
    });

    it("#4 NotClosable tail → DOM unchanged", () => {
      act(() => engine.push('re"},'));
      const q = within(rootNode);
      expect(
        q.getByRole("heading", { level: 2, name: /title/i }),
      ).toBeInTheDocument();
      expect(q.getByText("Hi the")).toBeInTheDocument();
    });

    it("#5 onNext #2 → final UI with form; fill + submit calls onSubmit", () => {
      act(() =>
        engine.push(
          '{"id":"form","children":[' +
            '{"id":"input","queryId":"name","queryContent":"Your name"},' +
            '{"id":"input","queryId":"email","queryContent":"Email"}' +
            "]}",
        ),
      );

      const q = within(rootNode);
      expect(q.getByText("Hi there")).toBeInTheDocument();

      const nameEl = rootNode.querySelector<HTMLInputElement>("#name")!;
      const emailEl = rootNode.querySelector<HTMLInputElement>("#email")!;
      fireEvent.input(nameEl, { target: { value: "Hamish" } });
      fireEvent.input(emailEl, { target: { value: "h@example.com" } });

      const submitBtn = q.getByRole("button", { name: /continue/i });
      fireEvent.click(submitBtn);

      expect(onSubmit).toHaveBeenCalledTimes(1);
      expect(onSubmit).toHaveBeenCalledWith([
        { queryId: "name", response: "Hamish" },
        { queryId: "email", response: "h@example.com" },
      ]);
    });
  },
);
