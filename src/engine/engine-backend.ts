import z from "zod";
import { initTelomere, type ParseResult } from "telomere";
import { isKeyOrTypeError, debugClip } from "./engine-utils";

export interface EngineBackend {
  next(delta: string): void;
  reset(): void;
}

type Logger = Pick<Console, "debug" | "warn" | "error">;

type Opts<TSchema extends z.ZodTypeAny> = {
  schema: TSchema;
  onNext(data: z.infer<TSchema>): void;
  onInvalid?(err: unknown, stableDoc: string): void;
  debug?: boolean;
  logger?: Logger;
};

export async function createEngineBackend<TSchema extends z.ZodTypeAny>({
  schema,
  onNext,
  onInvalid,
  debug = false,
  logger = console,
}: Opts<TSchema>): Promise<EngineBackend> {
  const tel = await initTelomere();

  let raw = "";
  let seq = 0;
  let totalBytes = 0;

  const logd = (...args: any[]) => debug && logger.debug("[engine]", ...args);
  const logw = (...args: any[]) => debug && logger.warn("[engine]", ...args);
  const loge = (...args: any[]) => debug && logger.error("[engine]", ...args);

  logd("engine created");

  const next = (delta: string) => {
    seq += 1;
    totalBytes += delta.length;
    logd(
      `Δ#${seq} received (${delta.length}B, total ${totalBytes}B):`,
      debugClip(delta),
    );

    raw += delta;

    let r: ParseResult;
    try {
      r = tel.processDelta(delta);
    } catch (err) {
      loge(`Δ#${seq} telomere.processDelta threw:`, err);
      onInvalid?.(err, raw);
      return;
    }

    logd(
      `Δ#${seq} telomere ->`,
      r.type,
      r.type === "Success"
        ? ` (cap ${r.cap.length}B: ${debugClip(r.cap)})`
        : "",
    );

    if (r.type !== "Success") {
      logd(`Δ#${seq} not closable yet; awaiting more bytes`);
      return;
    }

    const stableDoc = raw + r.cap;
    logd(`Δ#${seq} stable doc (${stableDoc.length}B):`, debugClip(stableDoc));

    let parsed: unknown;
    try {
      parsed = JSON.parse(stableDoc);
      logd(`Δ#${seq} JSON.parse OK`);
    } catch (err) {
      logw(`Δ#${seq} JSON.parse failed:`, err);
      onInvalid?.(err, stableDoc);
      return;
    }

    const res = schema.safeParse(parsed);
    if (res.success) {
      logd(`Δ#${seq} Zod.parse OK -> onNext()`);
      onNext(res.data);
      return;
    }

    // Only surface *hard* schema errors. Pending/extendable failures are swallowed.
    if (isKeyOrTypeError(res.error)) {
      logw(`Δ#${seq} Zod HARD error -> onInvalid`, res.error.issues);
      onInvalid?.(res.error, stableDoc);
    } else {
      logd(
        `Δ#${seq} Zod pending (missing/extendable) — waiting for more bytes`,
      );
      // Keep buffering — do not emit onInvalid.
    }
  };

  const reset = () => {
    logd(
      `reset() called; clearing ${raw.length}B, seq=${seq}, totalBytes=${totalBytes}`,
    );
    raw = "";
    seq = 0;
    totalBytes = 0;
    try {
      (tel as any).reset?.();
      logd(`reset() telomere.reset invoked`);
    } catch (err) {
      logw(`reset() telomere.reset threw:`, err);
    }
  };

  return { next, reset };
}
