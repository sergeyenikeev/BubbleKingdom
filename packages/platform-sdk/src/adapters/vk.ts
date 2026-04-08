import { createId } from "@bubble-kingdom/shared";

import type { AdapterRuntimeOptions } from "./shared";
import { createMockPlatformAdapter } from "./mock";
import type { PlatformAdapter } from "../interfaces";

export function createVkPlatformAdapterStub(options: AdapterRuntimeOptions): PlatformAdapter {
  const base = createMockPlatformAdapter({
    ...options,
    platformTarget: "vk",
    storagePrefix: options.storagePrefix ?? "bubble-kingdom-vk",
  });

  return {
    ...base,
    target: "vk",
    session: {
      ...base.session,
      sessionId: createId("vk-session"),
      platformTarget: "vk",
    },
    async boot() {
      await base.boot();
      await base.logging.capture(
        "info",
        "VK adapter stub is active. Replace with VK Games Bridge integration before release.",
      );
    },
  };
}
