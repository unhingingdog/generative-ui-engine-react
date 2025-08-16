import z from "zod";
import { initTelomere, type ParseResult } from "telomere";
import { isKeyOrTypeError } from "./engine-utils";

export interface EngineBackend {
  next(delta: string): void;
  reset(): void;
}

type Logger = Pick<Console, "debug" | "warn" | "error">;

export type EngineBackendInputs<TSchema extends z.ZodTypeAny> = {
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
}: EngineBackendInputs<TSchema>): Promise<EngineBackend> {
  const telomere = await initTelomere();

  let raw = "";
  let seq = 0;

  const logd = (...args: any[]) => debug && logger.debug("[engine]", ...args);
  const logw = (...args: any[]) => debug && logger.warn("[engine]", ...args);
  const loge = (...args: any[]) => debug && logger.error("[engine]", ...args);

  logd("engine created");

  const next = (delta: string) => {
    seq += 1;
    logd(`Δ#${seq} received delta:`, delta);

    console.log("DELTA WAS: ", delta);

    raw += delta;

    console.log("RAW IS NOW: ", raw);

    let telomereResult: ParseResult;
    try {
      telomereResult = telomere.processDelta(delta);
    } catch (err) {
      console.error("TELOMERE ERROR", err);
      loge(`Δ#${seq} telomere.processDelta threw:`, err);
      onInvalid?.(err, raw);
      return;
    }

    console.log("TELOMERE CAP", telomereResult);

    logd(
      `Δ#${seq} telomere ->`,
      telomereResult.type,
      telomereResult.type === "Success" ? ` : ${telomereResult.cap})` : "",
    );

    if (telomereResult.type !== "Success") {
      logd(`Δ#${seq} not closable yet; awaiting more bytes`);
      return;
    }

    const stableDoc = raw + telomereResult.cap;
    logd(`Δ#${seq} stable doc:`, stableDoc);

    console.log("STABLE IS: ", stableDoc);

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
      console.log("VALIDATION SUCCESS", res);
      logd(`Δ#${seq} Zod.parse OK -> onNext()`);
      onNext(res.data);
      return;
    }

    // Only surface *hard* schema errors. Pending/extendable failures are swallowed.
    if (isKeyOrTypeError(res.error)) {
      console.log("VALIDATION ERROR", res.error);
      logw(`Δ#${seq} Zod HARD error -> onInvalid`, res.error.issues);
      onInvalid?.(res.error, stableDoc);
    } else {
      console.log("VALIDATION ERROR", res.error);
      logd(
        `Δ#${seq} Zod pending (missing/extendable) — waiting for more bytes`,
      );
      // Keep buffering — do not emit onInvalid.
    }
  };

  const reset = () => {
    logd(`reset() called; clearing ${raw.length}B, seq=${seq}`);
    raw = "";
    seq = 0;
    try {
      telomere.reset?.();
      logd(`reset() telomere.reset invoked`);
    } catch (err) {
      logw(`reset() telomere.reset threw:`, err);
    }
  };

  return { next, reset };
}
