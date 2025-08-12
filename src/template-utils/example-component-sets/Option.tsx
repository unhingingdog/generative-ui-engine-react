import type {
  GenerativeUIAssistantQueryComponent,
  GenerativeUISubmitComponent,
  UserQueryResponsePayload,
} from "../types";
import type { QueryResponder } from "../../template-models/template-models";
import type { TemplatePair } from "../template-react-binding";
import { templateValidatorFor } from "../../template-models/validator-utils";
import z from "zod";

type TemplateType = "option";
interface InputTemplate extends QueryResponder<TemplateType> { }

export const templateValidator = templateValidatorFor("option", {
  queryId: z.string(),
  queryContent: z.string(),
});

export type Props = GenerativeUIAssistantQueryComponent &
  GenerativeUISubmitComponent;

const Option = ({ queryId, queryContent, onSubmit }: Props) => {
  const handleClick = () => {
    const payload: UserQueryResponsePayload[] = [
      { queryId, response: queryContent },
    ];
    onSubmit(payload);
  };
  return (
    <button id={queryId} onClick={handleClick}>
      {queryContent}
    </button>
  );
};

export const OptionSet = {
  type: "option",
  component: Option,
  templateValidator,
  instructions: {
    generalUsage:
      "Standalone assistant-prompted option; clicking submits the option text as the user's response.",
    fields: {
      queryId:
        "Stable identifier linking this option to the assistant’s query.",
      queryContent:
        "Label shown on the button; also used as the submitted value.",
    },
  },
} as const satisfies TemplatePair<TemplateType, InputTemplate, Props>;
