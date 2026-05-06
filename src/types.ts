import type { AppManager } from "@nodeknit/app-manager";

export type McpToolMode = "public" | "protected";

export interface IMcpContext {
  appManager: AppManager;
  req?: unknown;
}

export interface IMcpTool {
  name: string;
  description: string;
  mode: McpToolMode;
  inputSchema?: Record<string, unknown>;
  handler: (params: unknown, context: IMcpContext) => Promise<unknown>;
}
