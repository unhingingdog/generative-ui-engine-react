import type { GenerativeUIAssistantQueryComponent } from "../types";
import type { QueryResponder } from "../../template-models/template-models";
import type { TemplateSet } from "../template-react-binding";
import { templateValidatorFor } from "../../template-models/validator-utils";
import z from "zod";

type TemplateType = "input";

interface InputTemplate extends QueryResponder<TemplateType> { }

export const templateValidator = templateValidatorFor("input", {
  queryId: z.string(),
  queryContent: z.string(),
});

export type Props = GenerativeUIAssistantQueryComponent;
const Input = ({ queryId, queryContent }: Props) => (
  <span>
    <label>{queryContent}</label>
    <input name={queryId} id={queryId} />
  </span>
);

export const InputSet = {
  type: "input",
  component: Input,
  templateValidator,
  instructions: {
    generalUsage:
      "An input to present to the user to extract a piece of information. Multiple inputs can be composed  together in a form template for complex queries",
    fields: {
      queryId:
        "An id the links the assistant's query to the user's response, in a structured way.",
      queryContent: "The text content used to prompt the user's response.",
    },
  },
} as const satisfies TemplateSet<TemplateType, InputTemplate, Props>;
