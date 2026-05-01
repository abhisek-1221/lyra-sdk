import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    url: "src/url.ts",
    fmt: "src/fmt.ts",
    transcript: "src/modules/transcript.ts",
    "ai-tools": "src/ai-tools/index.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  splitting: true,
  treeshake: true,
  sourcemap: true,
  target: "es2022",
  outDir: "dist",
});
