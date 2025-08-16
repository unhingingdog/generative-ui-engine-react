// example-component-sets/Form.tsx
import type { PropsWithChildren } from "react";
import type { TemplatePair } from "../template-react-binding";
import type {
  GenerativeUISubmitComponent,
  GenerativeUIComponent,
  UserQueryResponsePayload,
} from "../types";
import type { Parent } from "../../template-models/template-models";
import { templateValidatorFor } from "../../template-models/validator-utils";
import { templateValidator as InputValidator } from "./Input";
import z from "zod";

type TemplateType = "form";
interface FormTemplate extends Parent<TemplateType> { }

export const templateValidator = templateValidatorFor("form", {
  children: z.array(InputValidator),
}) as unknown as z.ZodType<FormTemplate>;

export type FormProps = PropsWithChildren &
  GenerativeUISubmitComponent &
  GenerativeUIComponent;

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

    const payload: UserQueryResponsePayload[] = Array.from(acc.entries()).map(
      ([queryId, arr]) => ({
        queryId,
        response: arr.length === 1 ? arr[0] : arr,
      }),
    );

    onSubmit(payload);
  };

  return (
    <form onSubmit={handleSubmit}>
      {children}
      <button type="submit">Continue</button>
    </form>
  );
};

export const FormSet = {
  type: "form",
  component: Form,
  templateValidator,
  instructions: {
    generalUsage:
      "Collect values from input nodes and submit as an array of {queryId,response}.",
    fields: { children: "Array of input nodes." },
  },
} as const satisfies TemplatePair<TemplateType, FormTemplate, FormProps>;
