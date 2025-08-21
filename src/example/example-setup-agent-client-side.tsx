// This is an example implementation using the example template pairs in template-utils.
// The code quality is not exemplary.

import { registry as exampleRegistryNotToBePackaged } from "../template-utils/example-component-sets/registry";
import type { RenderTargetModels } from "../template-utils";
import {
  createEngineAdapter,
  createAgentsProvider,
  generateSystemPrompt,
  type EnginePort,
  type ChatMessage,
} from "../client";
import { createEngine } from "../engine";
import OpenAI from "openai";
import React from "react";

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
    {
      id: "heading",
      level: 1,
      content: "Project Setup Assistant",
    },
    {
      id: "paragraph",
      content:
        "Welcome! I can help you set up your new project. Please provide the details below or choose a quick-start option.",
    },
    {
      id: "container",
      children: [
        {
          id: "heading",
          level: 2,
          content: "New Project Details",
        },
        {
          id: "form",
          children: [
            {
              id: "input",
              queryId: "project_name",
              queryContent: "What is the name of your project?",
            },
            {
              id: "input",
              queryId: "project_description",
              queryContent: "Briefly describe the project's main goal.",
            },
          ],
        },
        {
          id: "container",
          children: [
            {
              id: "heading",
              level: 3,
              content: "Quick Start",
            },
            {
              id: "option",
              queryId: "quick_start_react",
              queryContent: "Initialize a standard React App",
            },
            {
              id: "container",
              children: [
                {
                  id: "heading",
                  level: 4,
                  content: "Advanced Options",
                },
                {
                  id: "container",
                  children: [
                    {
                      id: "paragraph",
                      content: "Select a specific deployment target:",
                    },
                    {
                      id: "container",
                      children: [
                        {
                          id: "option",
                          queryId: "deploy_vercel",
                          queryContent: "Deploy to Vercel",
                        },
                        {
                          id: "option",
                          queryId: "deploy_aws",
                          queryContent: "Deploy to AWS Amplify",
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

export const DebugWrapper: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  return (
    <div style={{ border: "2px dashed red", padding: "8px" }}>
      <h3 style={{ marginTop: 0, color: "red" }}>DEBUG WRAPPER</h3>
      {children}
    </div>
  );
};

// ---------- constants ----------
const SYSTEM_PROMPT = generateSystemPrompt(
  "You are an customer service assistant for a furniture store.",
  exampleRegistryNotToBePackaged.instructions,
  { exampleJSON: complexExample },
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
  const engine = await createEngine({
    registry: exampleRegistryNotToBePackaged,
    rootNode: document.getElementById("gen-ui-root")!,
    onSubmit: (payloads: RenderTargetModels.UserQueryResponsePayload[]) =>
      adapter.submit(payloads),
    debug: false,
    wrapper: DebugWrapper,
  });
  console.log("INIT ENGINE", engine);

  const port: EnginePort = {
    next: (d: string) => engine.push(d),
    reset: () => engine.reset(),
  };

  // Provider: Responses API stream → engine (async-iterable; no race with 'completed')
  const provider = createAgentsProvider(async function* (
    messages: ChatMessage[],
  ) {
    console.log("PROVIDER start", messages);

    const prompt = buildPromptFromMessages(messages, SYSTEM_PROMPT);
    let gotDelta = false;

    try {
      console.log("RESPONSES creating stream (async iterable) …");
      const stream = await openai.responses.create({
        model: "gpt-4o-mini",
        input: prompt,
        stream: true,
      });
      console.log("RESPONSES stream created (iterable)");

      for await (const event of stream as any) {
        // Typical event types: response.created, response.output_text.delta, response.completed, ...
        if (event?.type === "response.output_text.delta") {
          const delta = event.delta as string;
          if (delta && delta.length) {
            gotDelta = true;
            // console.log("Δ", JSON.stringify(delta));
            yield delta;
          }
        } else if (event?.type === "response.completed") {
          console.log("RESPONSES completed");
        } else if (
          event?.type === "response.error" ||
          event?.type === "error"
        ) {
          console.log("RESPONSES event error", event);
        }
      }
      console.log("RESPONSES iterator ended");
    } catch (e) {
      console.log("RESPONSES stream/create error", e);
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
    }
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
