import { createEventSource } from "eventsource-client";

/* ---------- Shared types ---------- */
export type UserQueryResponsePayload = { queryId: string; response: unknown };
export type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
};

export interface EnginePort {
  next(delta: string): void;
  reset(): void;
}

/* ---------- Provider abstraction ---------- */
export interface StreamHandle {
  iterator: AsyncIterable<string>;
  cancel?: () => void; // optional cancellation hook
}

export interface StreamProvider {
  start(messages: ChatMessage[]): StreamHandle; // returns an async-iterable of deltas
}

/* ---------- Provider: external server via SSE (POST) ---------- */
export function createSSEProvider(opts: {
  url: string;
  headers?: Record<string, string>;
  method?: "POST" | "GET";
  bodyBuilder?: (messages: ChatMessage[]) => unknown; // default: { messages, stream:true }
}): StreamProvider {
  const { url, headers = {}, method = "POST", bodyBuilder } = opts;
  return {
    start(messages) {
      const es = createEventSource({
        url,
        method,
        headers: { "content-type": "application/json", ...headers },
        body: JSON.stringify(
          bodyBuilder ? bodyBuilder(messages) : { messages, stream: true },
        ),
      });
      const iterator = es as unknown as AsyncIterable<{ data?: string }>;
      // Map events → plain string deltas
      async function* map(): AsyncIterable<string> {
        try {
          for await (const evt of iterator) {
            const data = typeof evt?.data === "string" ? evt.data : "";
            if (!data || data === "[DONE]") continue;
            yield data;
          }
        } finally {
          es.close();
        }
      }
      return { iterator: map(), cancel: () => es.close() };
    },
  };
}

/* ---------- Provider: client-side Agents SDK (or any async-iterable factory) ---------- */
export function createAgentsProvider(
  streamFactory: (
    messages: ChatMessage[],
  ) => AsyncIterable<string> & { cancel?: () => void },
): StreamProvider {
  return {
    start(messages) {
      const it = streamFactory(messages);
      return { iterator: it, cancel: it.cancel?.bind(it) };
    },
  };
}

/* ---------- Engine adapter (provider-agnostic) ---------- */
export function createEngineAdapter(
  engine: EnginePort,
  provider: StreamProvider,
  init: {
    systemPrompt: string;
    initialUserMessage?: string;
    transformDelta?: (raw: string) => string | null | undefined; // default identity
  },
) {
  const { systemPrompt, initialUserMessage, transformDelta = (s) => s } = init;

  let messages: ChatMessage[] = [{ role: "system", content: systemPrompt }];
  if (initialUserMessage)
    messages.push({ role: "user", content: initialUserMessage });

  let inflight: StreamHandle | null = null;

  function abort() {
    inflight?.cancel?.();
    inflight = null;
  }

  function resetConversation(initial?: string) {
    abort();
    engine.reset();
    messages = [{ role: "system", content: systemPrompt }];
    if (initial) messages.push({ role: "user", content: initial });
  }

  async function run() {
    abort();
    engine.reset();
    const handle = provider.start(messages);
    inflight = handle;
    for await (const raw of handle.iterator) {
      const d = transformDelta(raw);
      if (d) engine.next(d);
    }
    inflight = null;
  }

  async function submit(payloads: UserQueryResponsePayload[]) {
    abort();
    messages.push({
      role: "user",
      content: JSON.stringify({ type: "submission", payloads }),
    });
    await run();
  }

  async function send(text: string) {
    abort();
    messages.push({ role: "user", content: text });
    await run();
  }

  const history = () => messages as ReadonlyArray<ChatMessage>;

  return { run, submit, send, abort, resetConversation, history };
}
