import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { migrateThemeValue, THEME_PRESETS } from "../themePresets.ts";

describe("saved theme compatibility", () => {
  it.each([
    ["solarized-light", "paper"], ["punktespiegel", "paper"],
    ["catppuccin-mocha", "ink"], ["dracula", "ink"], ["dark", "nord-dark"],
    ["default-dark", "nord-dark"], ["light", "nord-light"],
    ["default-light", "nord-light"],
  ])("maps %s to %s without dropping the saved preference", (stored, expected) => {
    expect(migrateThemeValue(stored)).toBe(expected);
  });

  it("preserves every current theme and rejects unknown values", () => {
    for (const preset of THEME_PRESETS) expect(migrateThemeValue(preset.id)).toBe(preset.id);
    expect(migrateThemeValue("not-a-theme")).toBeNull();
  });
});

// The bootstrap runs before React to avoid flashing the wrong theme.
// Keep it compatible with the hook and authorized by the page's CSP.
const html = readFileSync(new URL("../../../../index.html", import.meta.url), "utf8");
const bootstrap = html.match(/<script>([\s\S]*?)<\/script>/)![1];

describe("initial theme bootstrap", () => {
  it("has a matching CSP hash", () => {
    const hash = createHash("sha256").update(bootstrap).digest("base64");
    expect(html).toContain(`'sha256-${hash}'`);
  });

  it.each(["paper", "ink", "nord-light", "nord-dark", "high-contrast", "high-contrast-light", "solarized-light", "punktespiegel", "catppuccin-mocha", "dracula", "default-dark", "default-light"])("agrees with the hook for %s", (saved) => {
    const dataset: { theme?: string } = {};
    let dark = false;
    runInNewContext(bootstrap, {
      localStorage: { getItem: () => saved },
      matchMedia: () => ({ matches: false }),
      document: { documentElement: { dataset, classList: { toggle: (_name: string, value: boolean) => { dark = value; } } } },
    });
    const expected = THEME_PRESETS.find(({ id }) => id === migrateThemeValue(saved))!;
    expect(dataset.theme).toBe(expected.id);
    expect(dark).toBe(expected.isDark);
  });
});
