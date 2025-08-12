import type { PropsWithChildren } from "react";
import type {
  GenerativeUISubmitComponent,
  UserQueryResponsePayload,
} from "../types";
import type { QueryableParent } from "../../template-models/template-models";
import type { TemplateSet } from "../template-react-binding";
import { queryableParentValidatorFor } from "../../template-models/validator-utils";

type TemplateType = "form";
interface FormTemplate extends QueryableParent<TemplateType> { }

export const templateValidator = queryableParentValidatorFor("form");

export type FormProps = PropsWithChildren & GenerativeUISubmitComponent;

const Form = ({ children, onSubmit }: FormProps) => {
  const handleSubmit: React.FormEventHandler<HTMLFormElement> = (e) => {
    e.preventDefault();

    const fd = new FormData(e.currentTarget);
    const acc = new Map<string, Array<string | File>>();

    for (const [name, v] of fd.entries()) {
      const arr = acc.get(name) ?? [];
      arr.push(typeof v === "string" ? v : (v as File));
      acc.set(name, arr);
    }

    // include clicked submitter (if it has a name)
    const submitter = (e.nativeEvent as SubmitEvent).submitter as
      | HTMLButtonElement
      | HTMLInputElement
      | null;
    if (submitter) {
      const name = submitter.getAttribute("name");
      if (name) {
        const val = submitter.getAttribute("value") ?? "";
        const arr = acc.get(name) ?? [];
        arr.push(val);
        acc.set(name, arr);
      }
    }

    // Map form data -> UserQueryResponsePayload[]
    const responses: UserQueryResponsePayload[] = Array.from(acc.entries()).map(
      ([queryId, arr]) => ({
        queryId,
        response: arr.length === 1 ? arr[0] : arr,
      }),
    );

    onSubmit(responses);
  };

  return (
    <form onSubmit={handleSubmit}>
      {children}
      <button name="submit" type="submit">
        Continue
      </button>
    </form>
  );
};

export const FormSet = {
  type: "form",
  component: Form,
  templateValidator,
  instructions: {
    generalUsage: "Scope inputs and buttons; submits together.",
    fields: {
      children:
        "Array of 'input' query prompts. Always include this field of the template last.",
    },
  },
} as const satisfies TemplateSet<TemplateType, FormTemplate, FormProps>;
