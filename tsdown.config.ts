import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    client: "src/client/index.ts",
    engine: "src/engine/index.ts",
    "template-models": "src/template-models/index.ts",
    "template-utils": "src/template-utils/index.ts",
  },
  format: ["esm"],
  dts: true,
  hash: false,
  external: [
    "react",
    "react-dom",
    "zod",
    "openai",
    "@openai/agents",
    "@openai/agents-openai",
    "eventsource-client",
    "telomere",
  ],
  outDir: "dist",
  clean: true,
  tsconfig: "./tsconfig.build.json",
});
