import type { ToolDefinition } from "./types.js";

export function vercelTool<TArgs>(def: ToolDefinition<TArgs>) {
  return {
    description: def.description,
    parameters: def.parameters,
    execute: def.execute as (args: TArgs) => Promise<unknown>,
  };
}
