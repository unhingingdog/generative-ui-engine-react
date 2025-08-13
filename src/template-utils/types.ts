// All generateive UI components need a stable key
export type Key = string & { readonly __brand: "guiKey" };
export interface GenerativeUIComponent {
  key: Key;
}

// An id that can match an assistant's query to the user, with the user's resposne.
interface QueryId {
  queryId: string;
}

// A component with text content.
export interface TextComponent extends GenerativeUIComponent {
  content: string;
}

export interface GenerativeUIAssistantQueryComponent
  extends QueryId,
  GenerativeUIComponent {
  queryId: string; // An id which can be matched to the user's resposne.
  queryContent: string; // the content presented to the user to prompt their input.
}

// basically the equiv of form data when responding to the LLM.
export interface UserQueryResponsePayload extends QueryId {
  response: any;
}

// This consumes a global engine onSubmit, which sends the user's message to the assistant
// to continue the dialogue.
export interface GenerativeUISubmitComponent extends GenerativeUIComponent {
  onSubmit(payload: UserQueryResponsePayload[]): void;
}
