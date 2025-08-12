import type { TemplatePair } from "../template-react-binding";
import type { LayoutBase } from "../../template-models/template-models";
import { templateValidatorFor } from "../../template-models/validator-utils";
import type { TextComponent } from "../types";
import z from "zod";

type TemplateType = "paragraph";

interface ParagraphTemplate extends LayoutBase<TemplateType> {
  content: string;
}

export const templateValidator = templateValidatorFor("paragraph", {
  content: z.string().min(1),
});

export type ParagraphProps = TextComponent;

const Paragraph = ({ content }: ParagraphProps) => <p>{content}</p>;

export const ParagraphSet = {
  type: "paragraph",
  component: Paragraph,
  templateValidator,
  instructions: {
    generalUsage: "Use for body copy.",
    fields: {
      content:
        "The paragraph text. Always include this field of the template last.",
    },
  },
} as const satisfies TemplatePair<
  TemplateType,
  ParagraphTemplate,
  ParagraphProps
>;
