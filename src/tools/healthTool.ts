import type { IMcpTool } from "../types";

export const healthTool: IMcpTool = {
  name: "health",
  description: "Returns process health, uptime and timestamp",
  mode: "public",
  inputSchema: { type: "object", properties: {} },
  async handler() {
    return {
      status: "ok",
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString()
    };
  }
};
