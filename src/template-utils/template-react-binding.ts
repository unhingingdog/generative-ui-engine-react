// The types/schemas in this file are verging on over-engineered.
// But the intent is to create matching pairs of templates, and
// corresponding react components to link the two halves of the
// engine that are decoupled in that respect.
//
// It provides a utility to create any arbitrary pairing, and
// attempts to create a typesafe registry of them.
// This generalises the entire approach of generative UI.
//
// TODO: simplify. This is mostly hacky GPT code. I insisted it derive
// multiple discriminated unions. There's probably a more elegant approach.

import { z } from "zod";
import type { ComponentType } from "react";
import type { LayoutBase } from "../template-models/template-models";
import type { GenerativeUIComponent } from "./types";

/** Authoring primitives */
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
  /** Discriminant for maps (typically equals U["id"]) */
  type: T;
  /** Human-facing guidance */
  instructions: TemplateFieldInstructions<T, U>;
  /** Concrete zod schema or a factory taking a union getter */
  templateValidator: TemplateValidatorLike<U>;
  /** React component bound to this template id; props = U (plus usual React props) */
  component: ComponentType<P>;
};

/** Derived utility types */
export type TemplatePairs = readonly [
  TemplatePair<any, any, any>,
  ...TemplatePair<any, any, any>[],
];

export type TemplateUnion<Ps extends readonly TemplatePair<any, any, any>[]> =
  Ps[number] extends TemplatePair<any, infer U, any> ? U : never;

export type ComponentsByType<
  Ps extends readonly TemplatePair<any, any, any>[],
> = {
  [K in Ps[number] as K["type"]]: K["component"];
};

export type ValidatorsByType<
  Ps extends readonly TemplatePair<any, any, any>[],
> = {
  [K in Ps[number] as K["type"]]: z.ZodTypeAny;
};

export type InstructionsByType<
  Ps extends readonly TemplatePair<any, any, any>[],
> = {
  [K in Ps[number] as K["type"]]: K["instructions"];
};

export type PairByType<Ps extends readonly TemplatePair<any, any, any>[]> = {
  [K in Ps[number] as K["type"]]: K;
};

export type TemplateIds<Ps extends readonly TemplatePair<any, any, any>[]> =
  Ps[number]["type"];

/** Registry surface */
export type TemplateRegistry<Ps extends TemplatePairs> = Readonly<{
  /** Discriminated union on "id" (matches LayoutBase["id"]) */
  schema: z.ZodType<TemplateUnion<Ps>>;
  /** id → React component */
  components: ComponentsByType<Ps>;
  /** id → concrete zod validator */
  validators: ValidatorsByType<Ps>;
  /** id → authoring instructions */
  instructions: InstructionsByType<Ps>;
  /** id → original pair (component + validator + instructions) */
  byType: PairByType<Ps>;
}>;

/** Factory */
export function createTemplateRegistry<const Ps extends TemplatePairs>(
  ...pairs: Ps
): TemplateRegistry<Ps> {
  let Union!: z.ZodTypeAny; // set via z.lazy below

  // 1) Resolve validators (some may close over the union)
  const resolved = pairs.map((p) => {
    const v = p.templateValidator as TemplateValidatorLike<unknown>;
    return typeof v === "function" ? v(() => Union) : (v as z.ZodTypeAny);
  });

  // 2) Build the discriminated union lazily to break cycles via children z.lazy
  Union = z.lazy(() => (z as any).discriminatedUnion("id", resolved));

  // 3) Assemble typed maps
  const schema = Union as z.ZodType<TemplateUnion<Ps>>;

  const components = Object.freeze(
    Object.fromEntries(pairs.map((p) => [p.type, p.component])),
  ) as ComponentsByType<Ps>;

  const validators = Object.freeze(
    Object.fromEntries(pairs.map((p, i) => [p.type, resolved[i]])),
  ) as ValidatorsByType<Ps>;

  const instructions = Object.freeze(
    Object.fromEntries(pairs.map((p) => [p.type, p.instructions])),
  ) as InstructionsByType<Ps>;

  const byType = Object.freeze(
    Object.fromEntries(pairs.map((p) => [p.type, p])),
  ) as PairByType<Ps>;

  return Object.freeze({
    schema,
    components,
    validators,
    instructions,
    byType,
  });
}
