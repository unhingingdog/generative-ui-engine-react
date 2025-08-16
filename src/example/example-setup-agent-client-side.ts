// example-setup-agent-client-side.ts
// POC: stream straight from OpenAI Responses (no Agents SDK/trace). Keeps debugs + in-tab convo memory.

import { registry } from "../template-utils/example-component-sets/registry";
import type { UserQueryResponsePayload } from "../template-utils/types";
import {
  createEngineAdapter,
  createAgentsProvider,
  type EnginePort,
  type ChatMessage,
} from "../agent/transport";
import { generateSystemPrompt } from "../agent/prompt-generator";
import { createCombinedEngine } from "../engine/engine";
import OpenAI from "openai";

// ---------- helpers ----------
function createAsyncQueue<T>() {
  const buf: T[] = [];
  let pending: ((r: IteratorResult<T>) => void) | null = null;
  let ended = false;
  return {
    push(v: T) {
      if (pending) {
        pending({ value: v, done: false });
        pending = null;
      } else buf.push(v);
    },
    end() {
      ended = true;
      if (pending) {
        pending({ value: undefined as any, done: true });
        pending = null;
      }
    },
    async next(): Promise<IteratorResult<T>> {
      if (buf.length) return { value: buf.shift()!, done: false };
      if (ended) return { value: undefined as any, done: true };
      return new Promise((resolve) => (pending = resolve));
    },
    [Symbol.asyncIterator]() {
      return this;
    },
  };
}

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

// ---------- constants ----------
const SYSTEM_PROMPT = generateSystemPrompt(
  "Example domain: collect a few details from the user, then present a simple summary.",
  registry.instructions,
);

// ---------- main ----------
export async function startExample() {
  console.log("STARTING UP EXAMPLE");
  const openai = new OpenAI({
    apiKey: import.meta.env.VITE_OPENAI_API_KEY as string,
    dangerouslyAllowBrowser: true,
  });
  console.log("SET KEY", import.meta.env.VITE_OPENAI_API_KEY);

  console.log("ENGINE START");
  let adapter!: ReturnType<typeof createEngineAdapter>;
  const engine = await createCombinedEngine({
    registry,
    rootNode: document.getElementById("gen-ui-root")!,
    onSubmit: (payloads: UserQueryResponsePayload[]) =>
      adapter.submit(payloads),
    debug: true,
  });
  console.log("INIT ENGINE", engine);

  const port: EnginePort = {
    next: (d: string) => engine.push(d),
    reset: () => engine.reset(),
  };

  // Provider: Responses API stream → engine
  const provider = createAgentsProvider(async function*(
    messages: ChatMessage[],
  ) {
    console.log("PROVIDER start", messages);

    const prompt = buildPromptFromMessages(messages, SYSTEM_PROMPT);
    const q = createAsyncQueue<string>();
    let gotDelta = false;

    try {
      console.log("RESPONSES creating stream…");
      const stream = await openai.responses.stream({
        model: "gpt-5",
        input: prompt,
      });
      console.log("RESPONSES stream created", stream);

      await new Promise<void>((resolve) => {
        let resolved = false;
        const done = () => {
          if (!resolved) {
            resolved = true;
            console.log("RESPONSES completed");
            q.end();
            resolve();
          }
        };

        // ✅ Correct TS signature: event object, use event.delta
        stream.on("response.output_text.delta", (event: any) => {
          const delta = event?.delta as string | undefined;
          if (delta) {
            gotDelta = true;
            // console.log("Δ", JSON.stringify(delta));
            q.push(delta);
          }
        });

        stream.on("response.completed", done);
        stream.on("error", (e: any) => {
          console.log("RESPONSES stream error", e);
          done();
        });
      });
    } catch (e) {
      console.log("RESPONSES top-level error", e);
      q.end();
    }

    // Fallback if no chunks arrived
    if (!gotDelta) {
      try {
        console.log("NO STREAM CHUNKS; FALLBACK single call");
        const res = await openai.responses.create({
          model: "gpt-5",
          input: prompt,
        });
        const text = (res as any).output_text ?? "";
        if (text) yield text;
      } catch (e) {
        console.log("FALLBACK error", e);
      }
      return;
    }

    // Emit deltas to engine
    for await (const delta of q) yield delta;
  });
  console.log("CREATED provider", provider);

  adapter = createEngineAdapter(port, provider, {
    systemPrompt: SYSTEM_PROMPT,
    initialUserMessage: "Say hi and ask for two fields you need to proceed.",
  });
  console.log("CREATED adapter", adapter);

  await adapter.run();
  console.log("ADAPTER run started");

  (window as any).gui = {
    send: (t: string) => (adapter as any).send(t),
    reset: () => (adapter as any).resetConversation(),
  };
  console.log("WINDOW GUI controls bound");
}
