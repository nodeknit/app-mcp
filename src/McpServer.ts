import type { AppManager } from "@nodeknit/app-manager";
import type { Request, Response, NextFunction } from "express";
import type { IMcpContext, IMcpTool } from "./types";

export class McpServer {
  private tools = new Map<string, IMcpTool>();
  private groups = new Map<string, { description: string }>();

  get size(): number {
    return this.tools.size;
  }

  register(tool: IMcpTool): void {
    if (this.tools.has(tool.name)) {
      console.warn(`[McpServer] tool '${tool.name}' already registered, overwriting`);
    }
    const group = tool.group ?? "general";
    if (!this.groups.has(group)) {
      this.groups.set(group, { description: tool.groupDescription ?? "" });
    } else if (tool.groupDescription && !this.groups.get(group)?.description) {
      this.groups.set(group, { description: tool.groupDescription });
    }
    this.tools.set(tool.name, { ...tool, group, shortDescription: tool.shortDescription ?? shortDescription(tool.description) });
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
        const base = {
          protocol: "mcp",
          version: "1.1",
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
          endpoints: {
            groups: { method: "GET", path: endpoint, description: "Compact tool catalogue. Fetch a group only when its tools are needed." },
            group: { method: "GET", path: `${endpoint}/group/:group`, description: "Full schemas and call documentation for one group." },
            call: { method: "POST", path: `${endpoint}/call/:toolName`, description: "Call a tool with a JSON body." },
            flat: { method: "GET", path: `${endpoint}?flat=1`, description: "Legacy full list of every visible tool and schema." }
          }
        };
        const flat = req.query.flat === "1" || req.query.flat === "true" || req.query.all === "1";
        return res.json(flat ? { ...base, tools: this.buildToolList(endpoint, isAdmin) } : {
          ...base,
          groups: this.buildGroupList(endpoint, isAdmin)
        });
      }

      const groupPrefix = `${endpoint}/group/`;
      if (req.method === "GET" && url.startsWith(groupPrefix)) {
        const name = decodeURIComponent(url.slice(groupPrefix.length));
        const isAdmin = this.checkAdminKey(req);
        const tools = this.visibleTools(isAdmin).filter((tool) => tool.group === name);
        if (!this.groups.has(name) && tools.length === 0) {
          return res.status(404).json({ error: `Group '${name}' not found` });
        }
        return res.json({
          protocol: "mcp",
          version: "1.1",
          group: { name, description: this.groups.get(name)?.description ?? "", toolCount: tools.length },
          tools: tools.map((tool) => this.toolDetail(endpoint, tool))
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

  private visibleTools(isAdmin: boolean): IMcpTool[] {
    return Array.from(this.tools.values()).filter((tool) => isAdmin || tool.mode === "public");
  }

  private buildGroupList(endpoint: string, isAdmin: boolean) {
    const grouped = new Map<string, IMcpTool[]>();
    for (const tool of this.visibleTools(isAdmin)) {
      const group = tool.group ?? "general";
      grouped.set(group, [...(grouped.get(group) ?? []), tool]);
    }
    return Array.from(grouped.entries()).map(([name, tools]) => ({
      name,
      description: this.groups.get(name)?.description || `Tools: ${tools.map((tool) => tool.name).join(", ")}`,
      toolCount: tools.length,
      tools: tools.map((tool) => ({
        name: tool.name,
        mode: tool.mode,
        description: tool.shortDescription ?? shortDescription(tool.description),
        call: `POST ${endpoint}/call/${tool.name}`
      })),
      details: { method: "GET", path: `${endpoint}/group/${encodeURIComponent(name)}` }
    })).sort((a, b) => a.name.localeCompare(b.name));
  }

  private buildToolList(endpoint: string, isAdmin: boolean) {
    return this.visibleTools(isAdmin).map((tool) => this.toolDetail(endpoint, tool));
  }

  private toolDetail(endpoint: string, tool: IMcpTool) {
    return {
      name: tool.name,
      group: tool.group ?? "general",
      description: tool.description,
      shortDescription: tool.shortDescription ?? shortDescription(tool.description),
      mode: tool.mode,
      schema: tool.inputSchema ?? { type: "object", properties: {} },
      call: {
        method: "POST",
        path: `${endpoint}/call/${tool.name}`,
        auth: tool.mode === "protected" ? "X-Mcp-Key header or ?mcp_key= required" : "none"
      }
    };
  }
}

function shortDescription(description: string): string {
  const firstLine = description.split("\n")[0]?.trim() ?? "";
  const firstSentence = firstLine.split(/(?<=[.!?])\s/)[0] ?? firstLine;
  return firstSentence.length > 140 ? `${firstSentence.slice(0, 137)}...` : firstSentence;
}
