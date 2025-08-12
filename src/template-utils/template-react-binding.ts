import z from "zod";
import { type ComponentType } from "react";
import type { LayoutBase } from "../template-models/template-models";
import type { GenerativeUIComponent } from "./types";

export type ZodSchemaFor<T> = z.ZodType<T>;

export function layoutBaseSchema<I extends string>(id: I) {
  return z.object({ id: z.literal(id) }).strict() as unknown as z.ZodType<
    LayoutBase<I>
  >;
}

export function parentOf<TChild extends z.ZodTypeAny>(child: TChild) {
  return z
    .object({ children: z.array(child) })
    .strict() as unknown as z.ZodType<{ children: z.infer<TChild>[] }>;
}

export const textContent = z
  .object({ content: z.string() })
  .strict() as unknown as z.ZodType<{ content: string }>;

export const queryPrompt = z
  .object({ queryId: z.string(), query: z.string() })
  .strict() as unknown as z.ZodType<{ queryId: string; query: string }>;

export function makeTemplateSchema<
  I extends string,
  TExtra extends z.ZodRawShape,
>(id: I, extra: TExtra) {
  const base = z.object({ id: z.literal(id) }).strict();
  const rest = z.object(extra).strict();
  const out = z.intersection(base, rest);
  type Out = LayoutBase<I> & z.infer<typeof rest>;
  return out as unknown as z.ZodType<Out>;
}

type TemplateFieldInstructions<
  I extends string,
  Template extends LayoutBase<I>,
> = {
  generalUsage: string;
  fields?: Partial<Record<Exclude<keyof Template, "id">, string>>;
};

export type TemplateSet<
  TemplateType extends string,
  Template extends LayoutBase<TemplateType>,
  Props extends GenerativeUIComponent,
> = {
  type: TemplateType;
  instructions: TemplateFieldInstructions<TemplateType, Template>;
  templateValidator: z.ZodType<Template>;
  component: ComponentType<Props>;
};
