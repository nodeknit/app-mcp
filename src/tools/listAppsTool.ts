import type { IMcpTool } from "../types";

export const listAppsTool: IMcpTool = {
  name: "system.listApps",
  description: "Returns loaded apps and their current runtime state",
  mode: "protected",
  inputSchema: { type: "object", properties: {} },
  async handler(_params, context) {
    const loadedApps = context.appManager.appStorage.getApps();

    return Object.entries(loadedApps).map(([appId, app]) => ({
      appId,
      name: app.package?.appName ?? app.package?.name ?? appId,
      enabled: Boolean(app.enable),
      version: app.package?.version ?? null,
      isSystemApp: Boolean(app.isSystemApp)
    }));
  }
};
