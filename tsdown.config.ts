import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    "agent/index": "src/agent/index.ts",
    "engine/index": "src/engine/index.ts",
    "template-models/index": "src/template-models/index.ts",
    "template-utils/index": "src/template-utils/index.ts",
  },
  format: ["esm", "cjs"],
  clean: true,
  dts: true,
  platform: "browser",
  target: "esnext",
});
