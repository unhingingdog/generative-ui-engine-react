// Container.tsx
import type { PropsWithChildren } from "react";
import type { GenerativeUIComponent } from "../types";
import type { Parent, LayoutBase } from "../../template-models/template-models";
import { templateValidatorFor } from "../../template-models/validator-utils";
import z from "zod";
import type { TemplatePair } from "../template-react-binding";

type TemplateType = "container";
interface ContainerTemplate extends Parent<TemplateType> { }

export const templateValidator = (
  getUnion: () => z.ZodTypeAny,
): z.ZodType<ContainerTemplate> => {
  const Node: z.ZodType<LayoutBase<string>> = z.lazy(() =>
    getUnion(),
  ) as z.ZodType<LayoutBase<string>>;
  return templateValidatorFor("container", {
    children: z.array(Node).nonempty(),
  }) as unknown as z.ZodType<ContainerTemplate>;
};

export type ContainerProps = PropsWithChildren & GenerativeUIComponent;
const Container = ({ children }: ContainerProps) => <div>{children}</div>;

export const ContainerSet = {
  type: "container",
  component: Container,
  templateValidator,
  instructions: {
    generalUsage: "Group children; one root with nested content.",
    fields: { children: "Array of child nodes." },
  },
} as const satisfies TemplatePair<
  TemplateType,
  ContainerTemplate,
  ContainerProps
>;
