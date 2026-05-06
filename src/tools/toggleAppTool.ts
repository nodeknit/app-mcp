import type { IMcpTool } from "../types";

export const toggleAppTool: IMcpTool = {
  name: "system.toggleApp",
  description: "Enable or disable app by appId",
  mode: "protected",
  inputSchema: {
    type: "object",
    required: ["appId", "enabled"],
    properties: {
      appId: { type: "string" },
      enabled: { type: "boolean" }
    }
  },
  async handler(params, context) {
    const payload = (params ?? {}) as { appId?: unknown; enabled?: unknown };
    const appId = typeof payload.appId === "string" ? payload.appId : "";
    const enabled = typeof payload.enabled === "boolean" ? payload.enabled : null;

    if (!appId || enabled === null) {
      throw new Error("appId:string and enabled:boolean are required");
    }

    const runtime = context.appManager.appStorage.get(appId);
    if (!runtime?.appInstance) {
      throw new Error(`App '${appId}' not found`);
    }

    const current = Boolean(runtime.enable);
    if (current === enabled) {
      return { appId, enabled: current, changed: false };
    }

    if (enabled) {
      await runtime.appInstance._mount();
    } else {
      await runtime.appInstance._unmount();
    }

    runtime.enable = enabled;
    runtime.appInstance.enabled = enabled;

    return { appId, enabled, changed: true };
  }
};
