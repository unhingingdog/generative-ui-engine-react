import type { UserQueryResponsePayload } from "../template-utils/types";

interface ResponseStreamData {
  type: "data";
  content: string;
}

interface ResponseEnd {
  type: "end";
}

interface ResponseError {
  type: "error";
  error: Error;
}

type StreamEvent = ResponseStreamData | ResponseEnd | ResponseError;

export interface AgentInterface {
  prompt(content: UserQueryResponsePayload[]): void; //engine-frontend onSubmit
  handleStreamEvent(chunk: StreamEvent): void; // engine-backend next
}
