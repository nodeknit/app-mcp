import { AbstractApp, CollectionHandler } from "@nodeknit/app-manager";
import { McpServer } from "./McpServer";
import { McpToolHandler } from "./McpToolHandler";
import { healthTool, listAppsTool, toggleAppTool } from "./tools";

const ENDPOINT = "/mcp";

export class AppMCP extends AbstractApp {
  readonly appId = "app-mcp";
  readonly name = "MCP Server";

  private readonly server = new McpServer();

  @CollectionHandler("mcpTools")
  toolHandler: McpToolHandler = new McpToolHandler(this.server);

  async mount(): Promise<void> {
    if (process.env.MCP_ENABLED !== "true") {
      console.log("[AppMCP] disabled (set MCP_ENABLED=true to enable)");
      return;
    }

    this.server.register(healthTool);
    this.server.register(listAppsTool);
    this.server.register(toggleAppTool);

    this.appManager.app.use(this.server.middleware(ENDPOINT, this.appManager));

    console.log(`[AppMCP] ready. Tools: ${this.server.size}. Endpoint: ${ENDPOINT}`);
    if (!process.env.MCP_ADMIN_KEY) {
      console.warn("[AppMCP] MCP_ADMIN_KEY is not set; protected tools will be unauthorized");
    }
  }

  async unmount(): Promise<void> {
    return Promise.resolve();
  }
}
