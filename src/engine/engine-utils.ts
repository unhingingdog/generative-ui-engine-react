import z from "zod";

export const debugClip = (s: string, n = 200) =>
  s.length > n ? `${s.slice(0, n)}…` : s;

/**
 * Hard = errors we want to emit immediately:
 *  - unrecognized_keys
 *  - invalid_type where the field is present (received !== "undefined")
 *
 * Everything else is considered "pending" and swallowed.
 */
export function isKeyOrTypeError(err: unknown): boolean {
  if (!(err instanceof z.ZodError)) return false;

  return err.issues.some((i: any) => {
    if (i.code === "unrecognized_keys") return true;
    if (i.code === "invalid_type") {
      // Wrong *concrete* type now (e.g., string vs number) -> hard
      return i.received !== "undefined";
    }
    return false; // swallow all other codes as pending
  });
}
