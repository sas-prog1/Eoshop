// @vitest-environment jsdom

import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UiAdaptersProvider } from "../../adapters/UiAdaptersContext";
import { createFakeUiAdapters } from "../../adapters/testing/fakeUiAdapters";
import { DEFAULT_PLATFORM_SETTINGS, type PlatformSettings } from "../../services/platformSettingsApi";
import { PlatformSettingsProvider, usePlatformSettings } from "../../adapters/PlatformSettingsContext";

function Probe() {
  const { settings, loading, replace } = usePlatformSettings();
  return <div>
    <span>{loading ? "loading" : settings.platformName}</span>
    <button type="button" onClick={() => replace({ ...settings, platformName: "حفظ الإدارة" })}>replace</button>
  </div>;
}

afterEach(cleanup);

describe("PlatformSettingsProvider", () => {
  it("publishes the server projection and applies an administrator replacement immediately", async () => {
    const load = vi.fn().mockResolvedValue({ ...DEFAULT_PLATFORM_SETTINGS, platformName: "هوية الخادم" });
    render(
      <UiAdaptersProvider adapters={createFakeUiAdapters({ platformSettings: { load } })}>
        <PlatformSettingsProvider><Probe /></PlatformSettingsProvider>
      </UiAdaptersProvider>,
    );

    expect(await screen.findByText("هوية الخادم")).toBeTruthy();
    screen.getByRole("button", { name: "replace" }).click();
    expect(await screen.findByText("حفظ الإدارة")).toBeTruthy();
    expect(document.documentElement.style.getPropertyValue("--platform-primary")).toBe("#0284C7");
    expect(document.documentElement.style.getPropertyValue("--platform-brand-primary")).toBe("#081725");
    expect(document.documentElement.style.getPropertyValue("--platform-brand-accent")).toBe("#B18A46");
    expect(document.documentElement.style.getPropertyValue("--platform-brand-surface")).toBe("#F8F6F1");
    expect(document.documentElement.style.getPropertyValue("--platform-brand-font")).toContain("Tajawal");
  });

  it("ignores a late response after unmount", async () => {
    let resolveLoad: ((settings: PlatformSettings) => void) | null = null;
    const load = vi.fn().mockImplementation(() => new Promise<PlatformSettings>((resolve) => { resolveLoad = resolve; }));
    const rendered = render(
      <UiAdaptersProvider adapters={createFakeUiAdapters({ platformSettings: { load } })}>
        <PlatformSettingsProvider><Probe /></PlatformSettingsProvider>
      </UiAdaptersProvider>,
    );
    expect(screen.getByText("loading")).toBeTruthy();
    rendered.unmount();
    resolveLoad?.({ ...DEFAULT_PLATFORM_SETTINGS, platformName: "استجابة متأخرة" });
    await waitFor(() => expect(screen.queryByText("استجابة متأخرة")).toBeNull());
  });
});
