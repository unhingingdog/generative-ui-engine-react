import { Agent, run, system, user } from "@openai/agents";
import { createAgentsProvider } from "../agent/transport";
import type { ChatMessage } from "../agent/transport";

function createOpenAIAgentsStreamFactory(agent: Agent) {
  return async function* (messages: ChatMessage[]) {
    const items = messages.map((m) =>
      m.role === "system" ? system(m.content) : user(m.content),
    );
    const stream = await run(agent, items, { stream: true });
    try {
      // Yield plain text deltas from raw stream events (no ReadableStream typing needed)
      for await (const ev of stream as AsyncIterable<any>) {
        if (
          ev?.type === "raw_model_stream_event" &&
          ev.data?.type === "output_text_delta"
        ) {
          const delta = ev.data.delta as string | undefined;
          if (delta) yield delta;
        }
      }
      await (stream as any).completed;
    } catch (err) {
      console.error("Openai stream factory error", err);
    }
  };
}

export function createOpenAIAgentsProvider(agent: Agent) {
  return createAgentsProvider(createOpenAIAgentsStreamFactory(agent));
}
