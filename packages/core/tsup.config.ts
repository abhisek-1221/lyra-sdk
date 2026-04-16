import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    url: "src/modules/url.ts",
    fmt: "src/utils/format.ts",
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
