import type { TemplatePair } from "../template-react-binding";
import type { LayoutBase } from "../../template-models/template-models";
import { templateValidatorFor } from "../../template-models/validator-utils";
import type { TextComponent } from "../types";
import z from "zod";
import type { JSX } from "react";

type TemplateType = "heading";
type Level = 1 | 2 | 3 | 4 | 5 | 6;

interface HeadingTemplate extends LayoutBase<TemplateType> {
  content: string;
  level?: Level;
}

export const templateValidator = templateValidatorFor("heading", {
  content: z.string().min(1),
  level: z
    .union([
      z.literal(1),
      z.literal(2),
      z.literal(3),
      z.literal(4),
      z.literal(5),
      z.literal(6),
    ])
    .optional(),
});

export type HeadingProps = TextComponent & {
  level?: Level;
};

const Heading = ({ content, level = 2 }: HeadingProps) => {
  const Tag = `h${level}` as keyof JSX.IntrinsicElements;
  return <Tag>{content}</Tag>;
};

export const HeadingSet = {
  type: "heading",
  component: Heading,
  templateValidator,
  instructions: {
    generalUsage: "Use for titles; choose an appropriate level (1–6).",
    fields: {
      level: "Number 1–6; renders as h1…h6. Default is 2.",
      content:
        "The text of the heading. Always include this field of the template last.",
    },
  },
} as const satisfies TemplatePair<TemplateType, HeadingTemplate, HeadingProps>;
