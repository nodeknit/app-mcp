import type { AppManager } from "@nodeknit/app-manager";
import { McpServer } from "./McpServer";
import type { IMcpTool } from "./types";

type ToolCollectionItem = { appId: string; item: IMcpTool };

export class McpToolHandler {
  constructor(private readonly server: McpServer) {}

  async process(_appManager: AppManager, data: ToolCollectionItem[]): Promise<void> {
    for (const { item } of data) {
      this.server.register(item);
      console.log(`[McpToolHandler] registered tool: ${item.name}`);
    }
    console.log(`[McpToolHandler] total tools: ${this.server.size}`);
  }

  async unprocess(_appManager: AppManager, data: ToolCollectionItem[]): Promise<void> {
    for (const { item } of data) {
      this.server.unregister(item.name);
    }
  }
}
