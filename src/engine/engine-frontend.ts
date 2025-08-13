import { type UserQueryResponsePayload } from "../template-utils/types";

interface EngineFrontendOptions {
  onSubmit(payload: UserQueryResponsePayload[]): void;
}
