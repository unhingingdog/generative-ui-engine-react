# Shadowboxin



**Shadowboxin: Utils for real-time streamed LLM-generated UIs.**  
Bring your own component registry (BYO) and let an engine render UI described by model output.

#### Beta 
This is an active WIP, and probably unrealiable right now

## Modules (public subpaths)

- `shadowboxin/client` – prompt + adapter/provider wiring
- `shadowboxin/engine` – runtime that renders model-emitted UI
- `shadowboxin/template-models` – schema helpers/validators
- `shadowboxin/template-utils` – registry helpers and component bindings

---

## Install

~~~sh
npm install shadowboxin zod react react-dom
~~~

> Assumes a React app (Vite recommended). Shadowboxin ships ESM with subpath exports only (no root entry).

---

## Quick Start

### 1) Create a tiny component registry (Container, Paragraph, Button)

Create `src/sbx/registry.tsx`:

~~~tsx
import { z } from "zod"
import type { ComponentType, ReactNode } from "react"

import { createTemplateRegistry } from "shadowboxin/template-utils"
import { templateValidatorFor, parentValidatorFor } from "shadowboxin/template-models"

/** ───────── Paragraph ───────── */
type ParagraphProps = { content: string }
const Paragraph: ComponentType<ParagraphProps> = ({ content }) => <p>{content}</p>

export const ParagraphSet = {
  type: "paragraph",
  component: Paragraph,
  templateValidator: templateValidatorFor("paragraph", { content: z.string().min(1) }),
  instructions: {
    generalUsage: "Use for body copy.",
    fields: { content: "The paragraph text." }
  }
}

/** ───────── Container ───────── */
type ContainerProps = { children?: ReactNode }
const Container: ComponentType<ContainerProps> = ({ children }) => (
  <div data-sbx="container">{children}</div>
)

export const ContainerSet = {
  type: "container",
  component: Container,
  templateValidator: parentValidatorFor("container"),
  instructions: { generalUsage: "Groups other elements." }
}

/** ───────── Button ───────── */
type ButtonProps = { label: string; onSubmit: (payloads: unknown[]) => void }
const Button: ComponentType<ButtonProps> = ({ label, onSubmit }) => (
  <button type="button" onClick={() => onSubmit([])}>{label}</button>
)

export const ButtonSet = {
  type: "button",
  component: Button,
  templateValidator: templateValidatorFor("button", { label: z.string().min(1) }),
  instructions: {
    generalUsage: "Simple submit button; no fields.",
    fields: { label: "Button text." }
  }
}

/** ───────── Registry ───────── */
export const registry = createTemplateRegistry(ContainerSet, ParagraphSet, ButtonSet)
~~~

---

### 2) Wire the engine and a tiny local provider (no network)

Create `src/sbx/setup.ts`:

~~~ts
import {
  createAgentsProvider,
  createEngineAdapter,
  generateSystemPrompt,
  type ChatMessage,
  type EnginePort
} from "shadowboxin/client"

import { createEngine } from "shadowboxin/engine"
import { registry } from "./registry"

// Minimal example JSON the assistant could emit (Container → Paragraph + Button)
export const minimalExample = {
  id: "container",
  children: [
    { id: "paragraph", content: "Hello from Shadowboxin." },
    { id: "button", label: "Continue" }
  ]
} as const

// Build a system prompt using your registry instructions and the example JSON
const SYSTEM_PROMPT = generateSystemPrompt(
  "You respond by emitting UI templates only.",
  registry.instructions,
  { exampleJSON: minimalExample }
)

/** Local demo provider that yields one JSON response (no network). */
const provider = createAgentsProvider(async function* (_messages: ChatMessage[]) {
  // In production, plug in your streamed LLM responses here and yield deltas.
  yield JSON.stringify(minimalExample)
})

export async function startShadowboxin(root: HTMLElement) {
  let adapter!: ReturnType<typeof createEngineAdapter>

  const engine = await createEngine({
    registry,
    rootNode: root,
    onSubmit: (payloads) => adapter.submit(payloads),
    debug: false
  })

  const port: EnginePort = {
    next: (d) => engine.push(d),
    reset: () => engine.reset()
  }

  adapter = createEngineAdapter(port, provider, {
    systemPrompt: SYSTEM_PROMPT,
    initialUserMessage: "Render the minimal example."
  })

  await adapter.run()
}
~~~

---

### 3) Mount it in your app

Create `src/main.tsx`:

~~~tsx
import { StrictMode, useEffect, useRef } from "react"
import { createRoot } from "react-dom/client"
import { startShadowboxin } from "./sbx/setup"

function App() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (ref.current) startShadowboxin(ref.current)
  }, [])
  return <div ref={ref} id="gen-ui-root" />
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
~~~

---

## Example UI JSON (what the assistant/provider can emit)

Create `src/sbx/example.json` (optional, for reference):

~~~json
{
  "id": "container",
  "children": [
    { "id": "paragraph", "content": "Hello from Shadowboxin." },
    { "id": "button", "label": "Continue" }
  ]
}
~~~

---

## How it works

- **Registry** exposes types/instructions/validators for your components.  
- **System Prompt** is generated from registry instructions + an example JSON.  
- **Provider** yields model output (as JSON strings); swap in your streamed LLM.  
- **Adapter + Engine** connect the stream to the renderer and handle user onSubmit.

