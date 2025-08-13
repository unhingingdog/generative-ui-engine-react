import z from "zod";
import type { ComponentType } from "react";
import type { LayoutBase } from "../template-models/template-models";
import type { GenerativeUIComponent } from "./types";

export type TemplateFieldInstructions<
  T extends string,
  U extends LayoutBase<T>,
> = {
  generalUsage: string;
  fields?: Partial<Record<Exclude<keyof U, "id">, string>>;
};

type TemplateValidatorLike<U> =
  | z.ZodType<U>
  | ((getUnion: () => z.ZodTypeAny) => z.ZodType<U>);

export type TemplatePair<
  T extends string,
  U extends LayoutBase<T>,
  P extends GenerativeUIComponent,
> = {
  type: T;
  instructions: TemplateFieldInstructions<T, U>;
  templateValidator: TemplateValidatorLike<U>;
  component: ComponentType<P>;
};

type PairByType<Ps extends readonly TemplatePair<any, any, any>[]> = {
  [K in Ps[number]as K["type"]]: K;
};
type TemplateUnion<Ps extends readonly TemplatePair<any, any, any>[]> =
  Ps[number] extends TemplatePair<any, infer U, any> ? U : never;
type ComponentsByType<Ps extends readonly TemplatePair<any, any, any>[]> = {
  [K in Ps[number]as K["type"]]: K["component"];
};
type ValidatorsByType<Ps extends readonly TemplatePair<any, any, any>[]> = {
  [K in Ps[number]as K["type"]]: z.ZodTypeAny;
};
type InstructionsByType<Ps extends readonly TemplatePair<any, any, any>[]> = {
  [K in Ps[number]as K["type"]]: K["instructions"];
};

export function createTemplateRegistry<
  const Ps extends readonly [
    TemplatePair<any, any, any>,
    ...TemplatePair<any, any, any>[],
  ],
>(...pairs: Ps) {
  let Union!: z.ZodTypeAny; // will be set via z.lazy
  const resolved = pairs.map((p) =>
    typeof p.templateValidator === "function"
      ? (p.templateValidator as (g: () => z.ZodTypeAny) => z.ZodTypeAny)(
        () => Union,
      )
      : (p.templateValidator as z.ZodTypeAny),
  ) as z.ZodTypeAny[];

  Union = z.lazy(() => (z as any).discriminatedUnion("id", resolved));

  const schema = Union as z.ZodType<TemplateUnion<Ps>>;
  const components = Object.fromEntries(
    pairs.map((p) => [p.type, p.component]),
  ) as ComponentsByType<Ps>;
  const validators = Object.fromEntries(
    pairs.map((p) => [p.type, resolved[pairs.indexOf(p)]]),
  ) as ValidatorsByType<Ps>;
  const instructions = Object.fromEntries(
    pairs.map((p) => [p.type, p.instructions]),
  ) as InstructionsByType<Ps>;
  const byType = Object.fromEntries(
    pairs.map((p) => [p.type, p]),
  ) as PairByType<Ps>;

  return { schema, components, validators, instructions, byType };
}
