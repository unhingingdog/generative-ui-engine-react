export {
  generateSystemPrompt,
  type GeneratePromptOptions,
} from "./prompt-generator";

export type { ChatMessage, EnginePort } from "./transport";

import {
  createSSEProvider,
  createAgentsProvider,
  createEngineAdapter,
  type StreamProvider,
  type ChatMessage,
  type EnginePort,
} from "./transport";

export { type UserQueryResponsePayload } from "./transport";

/**
 * Configuration options for creating a new agent.
 * You must provide one type of stream provider: 'sse' for server-sent events,
 * or 'client' for a client-side stream factory.
 */
export type CreateClientOptions = {
  engine: EnginePort;
  systemPrompt: string;
  initialUserMessage?: string;
  provider:
  | {
    type: "sse";
    url: string;
    headers?: Record<string, string>;
    method?: "POST" | "GET";
    bodyBuilder?: (messages: ChatMessage[]) => unknown;
  }
  | {
    type: "client";
    streamFactory: (messages: ChatMessage[]) => AsyncIterable<string>;
  };
};

/**
 * Creates and configures a new generative UI agent.
 * This is the main function for connecting your UI engine to a streaming data source.
 * @param options The configuration for the agent.
 * @returns An adapter with methods to control the conversation (`run`, `submit`, `send`, `resetConversation`, etc.).
 */
export function createClient(options: CreateClientOptions) {
  let provider: StreamProvider;

  // Internally, we create the correct provider based on the user's options.
  if (options.provider.type === "sse") {
    provider = createSSEProvider(options.provider);
  } else {
    provider = createAgentsProvider(options.provider.streamFactory);
  }

  // Then, we create and return the engine adapter, hiding this complexity from the user.
  return createEngineAdapter(options.engine, provider, {
    systemPrompt: options.systemPrompt,
    initialUserMessage: options.initialUserMessage,
  });
}
