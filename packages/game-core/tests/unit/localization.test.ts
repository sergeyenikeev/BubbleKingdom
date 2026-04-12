import { describe, expect, it } from "vitest";

import { messages, translate } from "../../src/index";

describe("localization dictionaries", () => {
  it("keeps english and russian keysets aligned", () => {
    expect(Object.keys(messages.ru).sort()).toEqual(Object.keys(messages.en).sort());
  });

  it("serves approved russian copy for critical first-session and settings strings", () => {
    expect(translate("ru", "ui.tagline")).toBe("Лопай шары. Возрождай королевство.");
    expect(translate("ru", "screen.settings")).toBe("Настройки");
    expect(translate("ru", "level.goal")).toBe("Цель");
    expect(translate("ru", "reward.watchAdContinue")).toBe("Смотреть рекламу + ходы");
    expect(translate("ru", "preLevel.start")).toBe("Начать уровень");
    expect(translate("ru", "reward.comeback")).toBe("Награда за возвращение");
  });

  it("falls back to english and then the key when a translation is missing", () => {
    expect(translate("ru", "ui.title")).toBe("Bubble Kingdom");
    expect(translate("en", "missing.key")).toBe("missing.key");
  });
});
