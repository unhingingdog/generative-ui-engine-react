import z from "zod";
import type { LayoutBase, Parent, QueryableParent } from "./template-models";

export type ZSchema<T> = z.ZodType<T>;

export const templateValidatorFor = <
  T extends string,
  S extends z.ZodRawShape & { id?: never },
>(
  kind: T,
  shape: S,
): ZSchema<LayoutBase<T> & z.infer<z.ZodObject<S>>> =>
  z
    .object({ id: z.literal(kind) })
    .extend(shape)
    .strict() as unknown as ZSchema<LayoutBase<T> & z.infer<z.ZodObject<S>>>;

/* parent: children must be LayoutBase<string>[] */
export const parentValidatorFor = <I extends string>(
  kind: I,
): ZSchema<Parent<I>> =>
  z
    .object({
      id: z.literal(kind),
      children: z.array(z.object({ id: z.string() }).strict()),
    })
    .strict() as unknown as ZSchema<Parent<I>>;

/* queryable parent: children must be QueryPrompt[] (queryId + queryContent in this project) */
export const queryableParentValidatorFor = <I extends string>(
  kind: I,
): ZSchema<QueryableParent<I>> =>
  z
    .object({
      id: z.literal(kind),
      children: z.array(
        z.object({ queryId: z.string(), queryContent: z.string() }).strict(),
      ),
    })
    .strict() as unknown as ZSchema<QueryableParent<I>>;
