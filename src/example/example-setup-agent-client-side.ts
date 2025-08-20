// This is an example implementation refactored to use the high-level createClient API.

import { registry } from "../template-utils/example-component-sets/registry";
import {
  createClient,
  generateSystemPrompt,
  type ChatMessage,
  type EnginePort,
} from "../agent";
import { createCombinedEngine } from "../engine/engine";
import OpenAI from "openai";

// This function is required for the openai.responses.create API endpoint.
function buildPromptFromMessages(
  messages: ChatMessage[],
  systemPrompt: string,
) {
  const hasSystem = messages.some((m) => m.role === "system");
  const parts: string[] = [];
  if (!hasSystem && systemPrompt) parts.push(`SYSTEM:\n${systemPrompt}`);
  for (const m of messages) {
    const role = (m.role ?? "user").toUpperCase();
    parts.push(`${role}: ${String(m.content ?? "")}`);
  }
  parts.push("ASSISTANT:");
  return parts.join("\n");
}

const complexExample = {
  id: "container",
  children: [
    // ... (complexExample JSON is unchanged)
  ],
};

// ---------- constants ----------
const SYSTEM_PROMPT = generateSystemPrompt(
  "You are a customer service assistant for a furniture store.",
  registry.instructions,
  { exampleJSON: complexExample },
);

// ---------- main ----------
export async function startExample() {
  console.log("STARTING UP EXAMPLE");
  const openai = new OpenAI({
    apiKey: import.meta.env.VITE_OPENAI_API_KEY as string,
    dangerouslyAllowBrowser: true,
  });

  // This function will be the stream provider for our agent.
  async function* streamFactory(messages: ChatMessage[]) {
    console.log("PROVIDER start", messages);
    const prompt = buildPromptFromMessages(messages, SYSTEM_PROMPT);

    try {
      const stream = await openai.responses.create({
        model: "gpt-4o-mini",
        input: prompt,
        stream: true,
      });

      for await (const event of stream as any) {
        if (event?.type === "response.output_text.delta") {
          const delta = event.delta as string;
          if (delta) {
            yield delta;
          }
        }
      }
    } catch (e) {
      console.error("OpenAI stream error", e);
    }
  }

  console.log("ENGINE START");
  // Define the type for the client/adapter using the return type of createClient.
  type ClientAdapter = ReturnType<typeof createClient>;
  // A variable to hold the client/adapter is needed before initialization
  // to resolve the circular dependency with the `onSubmit` callback.
  let client: ClientAdapter;

  const engine = await createCombinedEngine({
    registry,
    rootNode: document.getElementById("gen-ui-root")!,
    // The engine's onSubmit calls the client's submit method.
    onSubmit: (payloads) => {
      if (client) {
        client.submit(payloads);
      }
    },
    debug: false,
  });
  console.log("INIT ENGINE", engine);

  // Create an object that conforms to the EnginePort interface,
  // mapping `next` to the engine's `push` method.
  const enginePort: EnginePort = {
    next: (delta: string) => engine.push(delta),
    reset: () => engine.reset(),
  };

  // Create the client using the single, high-level function.
  // This replaces the manual creation of providers and adapters.
  client = createClient({
    engine: enginePort,
    systemPrompt: SYSTEM_PROMPT,
    initialUserMessage: "Say hi and ask for two fields you need to proceed.",
    provider: {
      type: "client",
      streamFactory: streamFactory,
    },
  });
  console.log("CREATED client", client);

  // Start the conversation.
  await client.run();
  console.log("CLIENT run started");

  // Expose controls for debugging.
  (window as any).gui = {
    send: (t: string) => client.send(t),
    reset: () => client.resetConversation(),
  };
  console.log("WINDOW GUI controls bound");
}
