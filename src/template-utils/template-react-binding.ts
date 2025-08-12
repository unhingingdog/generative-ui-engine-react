import z from "zod";
import type { ComponentType } from "react";
import type { LayoutBase } from "../template-models/template-models";
import type { GenerativeUIComponent } from "./types";

export type TemplateFieldInstructions<
  T extends string,
  Template extends LayoutBase<T>,
> = {
  generalUsage: string;
  fields?: Partial<Record<Exclude<keyof Template, "id">, string>>;
};

export type TemplatePair<
  T extends string,
  Template extends LayoutBase<T>,
  Props extends GenerativeUIComponent,
> = {
  type: T;
  instructions: TemplateFieldInstructions<T, Template>;
  templateValidator: z.ZodType<Template>;
  component: ComponentType<Props>;
};

type PairByType<Ps extends readonly TemplatePair<any, any, any>[]> = {
  [P in Ps[number]as P["type"]]: P;
};
type TemplateUnion<Ps extends readonly TemplatePair<any, any, any>[]> =
  Ps[number] extends TemplatePair<any, infer TMPL, any> ? TMPL : never;
type ComponentsByType<Ps extends readonly TemplatePair<any, any, any>[]> = {
  [P in Ps[number]as P["type"]]: P["component"];
};
type ValidatorsByType<Ps extends readonly TemplatePair<any, any, any>[]> = {
  [P in Ps[number]as P["type"]]: P["templateValidator"];
};
type InstructionsByType<Ps extends readonly TemplatePair<any, any, any>[]> = {
  [P in Ps[number]as P["type"]]: P["instructions"];
};

export function createTemplateRegistry<
  const Ps extends readonly [
    TemplatePair<any, any, any>,
    ...TemplatePair<any, any, any>[],
  ],
>(...pairs: Ps) {
  const options = pairs.map((p) => p.templateValidator);

  const schema = (z as any).discriminatedUnion("id", options) as z.ZodType<
    TemplateUnion<Ps>
  >;

  const components = Object.fromEntries(
    pairs.map((p) => [p.type, p.component]),
  ) as ComponentsByType<Ps>;
  const validators = Object.fromEntries(
    pairs.map((p) => [p.type, p.templateValidator]),
  ) as ValidatorsByType<Ps>;
  const instructions = Object.fromEntries(
    pairs.map((p) => [p.type, p.instructions]),
  ) as InstructionsByType<Ps>;
  const byType = Object.fromEntries(
    pairs.map((p) => [p.type, p]),
  ) as PairByType<Ps>;

  return { schema, components, validators, instructions, byType };
}
