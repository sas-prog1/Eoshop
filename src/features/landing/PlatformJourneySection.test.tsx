// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import PlatformJourneySection from "./PlatformJourneySection";

afterEach(cleanup);

describe("PlatformJourneySection", () => {
  it("describes the real merchant journey without unsupported metrics", () => {
    render(<PlatformJourneySection platformName="مبتكر" ctaLabel="أنشئ متجرك" onStart={vi.fn()} />);

    expect(screen.getByRole("heading", { level: 2, name: "كيف تبدأ متجرك على مبتكر؟" })).toBeTruthy();
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
    expect(screen.getByText("أنشئ حسابك")).toBeTruthy();
    expect(screen.getByText("أدر متجرك وانشره")).toBeTruthy();
    expect(screen.queryByText(/\d+\s*(متجر|عميل)/)).toBeNull();
  });

  it("starts the merchant journey from the section call to action", async () => {
    const operator = userEvent.setup();
    const onStart = vi.fn();

    render(<PlatformJourneySection platformName="مبتكر" ctaLabel="أنشئ متجرك" onStart={onStart} />);
    await operator.click(screen.getByRole("button", { name: "أنشئ متجرك" }));

    expect(onStart).toHaveBeenCalledTimes(1);
  });
});
