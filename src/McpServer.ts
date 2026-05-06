import type { AppManager } from "@nodeknit/app-manager";
import type { Request, Response, NextFunction } from "express";
import type { IMcpContext, IMcpTool } from "./types";

export class McpServer {
  private tools = new Map<string, IMcpTool>();

  get size(): number {
    return this.tools.size;
  }

  register(tool: IMcpTool): void {
    if (this.tools.has(tool.name)) {
      console.warn(`[McpServer] tool '${tool.name}' already registered, overwriting`);
    }
    this.tools.set(tool.name, tool);
  }

  unregister(name: string): void {
    this.tools.delete(name);
  }

  async callTool(name: string, params: unknown = {}, ctx: Partial<IMcpContext> = {}): Promise<unknown> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`MCP: tool '${name}' not found`);
    }

    return tool.handler(params, ctx as IMcpContext);
  }

  middleware(endpoint: string, appManager: AppManager) {
    return async (req: Request, res: Response, next: NextFunction) => {
      const url = req.url.split("?")[0] ?? "";

      if (req.method === "GET" && url === endpoint) {
        const isAdmin = this.checkAdminKey(req);
        return res.json({
          protocol: "mcp",
          version: "1.0",
          info: {
            auth: {
              type: "api-key",
              methods: [
                { type: "header", name: "X-Mcp-Key" },
                { type: "query", name: "mcp_key" }
              ],
              status: isAdmin ? "authenticated" : "unauthenticated"
            }
          },
          tools: this.buildToolList(endpoint, isAdmin)
        });
      }

      const callPrefix = `${endpoint}/call/`;
      if (req.method === "POST" && url.startsWith(callPrefix)) {
        const toolName = url.slice(callPrefix.length);
        const tool = this.tools.get(toolName);

        if (!tool) {
          return res.status(404).json({ error: `Tool '${toolName}' not found` });
        }

        if (tool.mode === "protected" && !this.checkAdminKey(req)) {
          return res.status(401).json({ error: "Admin key required for this tool" });
        }

        try {
          const ctx: IMcpContext = { appManager, req };
          const result = await tool.handler(req.body ?? {}, ctx);
          return res.json({ tool: toolName, result });
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : "Tool execution failed";
          return res.status(500).json({ error: message });
        }
      }

      return next();
    };
  }

  private checkAdminKey(req: Request): boolean {
    const adminKey = process.env.MCP_ADMIN_KEY;
    if (!adminKey) {
      return false;
    }

    const headerValue = req.headers["x-mcp-key"];
    const queryValue = req.query.mcp_key;

    const provided = Array.isArray(headerValue)
      ? headerValue[0]
      : typeof headerValue === "string"
        ? headerValue
        : Array.isArray(queryValue)
          ? queryValue[0]
          : typeof queryValue === "string"
            ? queryValue
            : "";

    return provided === adminKey;
  }

  private buildToolList(endpoint: string, isAdmin: boolean) {
    return Array.from(this.tools.values())
      .filter((tool) => isAdmin || tool.mode === "public")
      .map((tool) => ({
        name: tool.name,
        description: tool.description,
        mode: tool.mode,
        schema: tool.inputSchema ?? { type: "object", properties: {} },
        call: {
          method: "POST",
          path: `${endpoint}/call/${tool.name}`,
          auth: tool.mode === "protected" ? "X-Mcp-Key header or ?mcp_key= required" : "none"
        }
      }));
  }
}
