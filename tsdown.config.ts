import { defineConfig } from "tsdown";

export default defineConfig({
  // Use an object to map entry points to output paths
  entry: {
    "agent/index": "src/agent/index.ts",
    "engine/index": "src/engine/index.ts",
    "template-models/index": "src/template-models/index.ts",
    "template-utils/index": "src/template-utils/index.ts",
  },
  // Generate both ESM and CJS formats
  format: ["esm", "cjs"],
  // Ensure the dist folder is cleared before each build
  clean: true,
  // Use the 'dts' option to enable declaration file generation
  dts: true,
});
