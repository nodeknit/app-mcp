import type { AppManager } from "@nodeknit/app-manager";

export type McpToolMode = "public" | "protected";

export interface IMcpContext {
  appManager: AppManager;
  req?: unknown;
}

export interface IMcpTool {
  name: string;
  description: string;
  /** A capability area used for progressive tool discovery. */
  group?: string;
  /** Description of the group; the first registered value is used. */
  groupDescription?: string;
  /** One-line description used in the compact MCP catalogue. */
  shortDescription?: string;
  mode: McpToolMode;
  inputSchema?: Record<string, unknown>;
  handler: (params: unknown, context: IMcpContext) => Promise<unknown>;
}
