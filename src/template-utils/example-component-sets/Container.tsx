import type { PropsWithChildren } from "react";
import type { GenerativeUIComponent } from "../types";
import type { Parent } from "../../template-models/template-models";
import type { TemplatePair } from "../template-react-binding";
import { parentValidatorFor } from "../../template-models/validator-utils";

type TemplateType = "container";
interface ContainerTemplate extends Parent<TemplateType> { }

export const templateValidator = parentValidatorFor("container");

export type ContainerProps = PropsWithChildren & GenerativeUIComponent;
const Container = ({ children }: ContainerProps) => <div>{children}</div>;

export const ContainerSet = {
  type: "container",
  component: Container,
  templateValidator,
  instructions: {
    generalUsage: "Group children; one root with nested content.",
    fields: {
      children:
        "The templates wrapped by this container. Always include this field last.",
    },
  },
} as const satisfies TemplatePair<
  TemplateType,
  ContainerTemplate,
  ContainerProps
>;
