import type { z } from "zod";
import type { CacheStore } from "../transcript/types.js";

export interface ToolDefinition<TArgs = unknown> {
  description: string;
  parameters: z.ZodSchema<TArgs>;
  execute: (args: TArgs) => Promise<ToolResult<unknown>>;
}

export interface ToolResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface AIToolsConfig {
  apiKey: string;
  cache?: CacheStore;
}
