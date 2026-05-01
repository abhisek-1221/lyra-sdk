import type { z } from "zod";
import type { CacheStore } from "../transcript/types.js";

export interface ToolDefinition<TArgs = unknown, TResult = unknown> {
  description: string;
  parameters: z.ZodSchema<TArgs>;
  execute: (args: TArgs) => Promise<TResult>;
}

export interface AIToolsConfig {
  apiKey: string;
  cache?: CacheStore;
}
