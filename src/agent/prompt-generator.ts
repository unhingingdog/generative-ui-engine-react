import type { TemplateFieldInstructions } from "../template-utils/template-react-binding";

type InstructionMap = Readonly<
  Record<string, TemplateFieldInstructions<any, any>>
>;
type InstructionPairs = ReadonlyArray<{
  type: string;
  instructions: TemplateFieldInstructions<any, any>;
}>;

export type InstructionRegistry = InstructionMap | InstructionPairs;

export interface GeneratePromptOptions {
  extraRules?: string[];
  exampleJSON?: object | (() => object);
  sectionTitle?: string;
}

/** Normalize array or map registries to { type -> instructions }. */
const normalizeRegistry = (
  registry: InstructionRegistry,
): Record<string, TemplateFieldInstructions<any, any>> => {
  if (Array.isArray(registry)) {
    const out: Record<string, TemplateFieldInstructions<any, any>> = {};
    for (const { type, instructions } of registry) out[type] = instructions;
    return out;
  }
  return registry as Record<string, TemplateFieldInstructions<any, any>>;
};

/** Build a system prompt from consumer-provided TemplatePairs (or a prebuilt {type->instructions} map). */
export function generateSystemPrompt(
  domainInstructions: string,
  registry: InstructionRegistry,
  opts: GeneratePromptOptions = {},
): string {
  const map = normalizeRegistry(registry);
  const lines: string[] = [];

  lines.push(
    "You are an assistant that interacts with the user using a UI template DSL.",
  );
  lines.push("");

  if (domainInstructions.trim()) lines.push(domainInstructions.trim(), "");

  lines.push(
    "",
    "### Usage",
    "- Each template has a semantic id field you must include this feid in all templates.",
    "- You can build arbirarily complex, combinatorial, recursive UIs.",
    "- This system is powerful. Try to express concepts in an original creative way.",
    "- If you don't provide any user input for them to use for a response, it'll kill the dialogue. So always offer this in some form.",
    "- DEBUG PROMPT - make a very complex UI. Nest it 4 levels deep. Any template that has a children prop can create a new level, so create a deeply recursive response",
    "- DEBUG PROMPT - be creative, don't just use plain boring forms",
    "",
  );

  lines.push(opts.sectionTitle || "### Template types & how to use them");
  for (const [type, instr] of Object.entries(map)) {
    lines.push(`- **${type}**: ${instr.generalUsage}`);
    lines.push(`  • \`id\`: Must be the exact string "${type}".`);
    // --- MODIFICATION END ---
    if (instr.fields) {
      for (const [field, hint] of Object.entries(instr.fields)) {
        // To avoid confusion, skip re-documenting 'id' if it's in the fields map
        if (field === "id") continue;
        lines.push(`  • \`${field}\`: ${hint}`);
      }
    }
  }

  lines.push(
    "",
    "### Rules",
    "- Output ONLY a single JSON object that matches the published schema.",
    "- No prose, no Markdown, no backticks, no code fences.",
    "- Use only documented fields; do not invent properties.",
    "- Keep copy concise and human-friendly.",
  );

  if (opts.extraRules?.length)
    for (const r of opts.extraRules) lines.push(`- ${r}`);

  if (opts.exampleJSON) {
    const example =
      typeof opts.exampleJSON === "function"
        ? opts.exampleJSON()
        : opts.exampleJSON;
    lines.push(
      "",
      "### Minimal example",
      "```json",
      JSON.stringify(example, null, 2),
      "```",
    );
  }

  return lines.join("\n");
}
