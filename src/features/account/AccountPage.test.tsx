// @vitest-environment jsdom

import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UiAdaptersProvider } from "../../adapters/UiAdaptersContext";
import { createFakeUiAdapters } from "../../adapters/testing/fakeUiAdapters";
import type { UserProfile } from "../../adapters/uiAdapters";
import AccountPage from "./AccountPage";
import { ApiError } from "../../services/apiClient";

const user: UserProfile = {
  id: "account-owner",
  fullName: "Account Owner",
  email: "owner@example.test",
  phone: "+967700000000",
  profileRevision: 1,
  createdAt: null,
  updatedAt: null,
  role: "merchant",
  platformRoles: [],
  platformPermissions: [],
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("AccountPage", () => {
  it("uses the server revision for profile changes and the current credential for password rotation", async () => {
    const changed = { ...user, fullName: "Updated Owner", profileRevision: 2 };
    const updateProfile = vi.fn().mockResolvedValue(changed);
    const changePassword = vi.fn().mockResolvedValue("تم تحديث كلمة المرور وإلغاء الجلسات الأخرى.");
    const onUserChanged = vi.fn();
    const adapters = createFakeUiAdapters({ auth: { updateProfile, changePassword } });
    render(<UiAdaptersProvider adapters={adapters}><AccountPage user={user} onUserChanged={onUserChanged} onLoggedOut={vi.fn()} onSessionExpired={vi.fn()} /></UiAdaptersProvider>);

    const name = screen.getByDisplayValue("Account Owner");
    await userEvent.clear(name);
    await userEvent.type(name, "Updated Owner");
    await userEvent.click(screen.getByRole("button", { name: "حفظ الملف الشخصي" }));
    await waitFor(() => expect(updateProfile).toHaveBeenCalledWith({
      expectedRevision: 1,
      name: "Updated Owner",
      phone: "+967700000000",
    }, expect.any(AbortSignal)));
    expect(onUserChanged).toHaveBeenCalledWith(changed);

    const passwordFields = screen.getAllByLabelText(/كلمة المرور/);
    await userEvent.type(passwordFields[0], "secure-pass-123");
    await userEvent.type(passwordFields[1], "new-secure-pass-456");
    await userEvent.type(passwordFields[2], "new-secure-pass-456");
    await userEvent.click(screen.getByRole("button", { name: "تغيير كلمة المرور" }));
    await waitFor(() => expect(changePassword).toHaveBeenCalledWith({
      currentPassword: "secure-pass-123",
      password: "new-secure-pass-456",
      passwordConfirmation: "new-secure-pass-456",
    }, expect.any(AbortSignal)));
    expect(await screen.findByText("تم تحديث كلمة المرور وإلغاء الجلسات الأخرى.")).toBeTruthy();
  }, 15_000);

  it("fails closed and clears the route when the session expires during a mutation", async () => {
    const onSessionExpired = vi.fn();
    const adapters = createFakeUiAdapters({
      auth: { updateProfile: vi.fn().mockRejectedValue(new ApiError("expired", "unauthenticated", 401)) },
    });
    render(<UiAdaptersProvider adapters={adapters}><AccountPage user={user} onUserChanged={vi.fn()} onLoggedOut={vi.fn()} onSessionExpired={onSessionExpired} /></UiAdaptersProvider>);

    const name = screen.getByDisplayValue("Account Owner");
    await userEvent.clear(name);
    await userEvent.type(name, "Changed after expiry");
    await userEvent.click(screen.getByRole("button", { name: "حفظ الملف الشخصي" }));

    await waitFor(() => expect(onSessionExpired).toHaveBeenCalledWith("/app/account"));
  });

  it("ignores a delayed profile response after the authenticated account changes", async () => {
    let resolveUpdate!: (value: UserProfile) => void;
    const updateProfile = vi.fn().mockReturnValue(new Promise<UserProfile>((resolve) => { resolveUpdate = resolve; }));
    const onUserChanged = vi.fn();
    const adapters = createFakeUiAdapters({ auth: { updateProfile } });
    const view = render(<UiAdaptersProvider adapters={adapters}><AccountPage user={user} onUserChanged={onUserChanged} onLoggedOut={vi.fn()} onSessionExpired={vi.fn()} /></UiAdaptersProvider>);
    const name = screen.getByDisplayValue("Account Owner");
    await userEvent.clear(name);
    await userEvent.type(name, "Delayed owner A");
    await userEvent.click(screen.getByRole("button", { name: "حفظ الملف الشخصي" }));

    const nextUser = { ...user, id: "account-owner-b", fullName: "Owner B", email: "owner-b@example.test" };
    view.rerender(<UiAdaptersProvider adapters={adapters}><AccountPage user={nextUser} onUserChanged={onUserChanged} onLoggedOut={vi.fn()} onSessionExpired={vi.fn()} /></UiAdaptersProvider>);
    resolveUpdate({ ...user, fullName: "Delayed owner A", profileRevision: 2 });

    await waitFor(() => expect(screen.getByDisplayValue("Owner B")).toBeTruthy());
    expect(onUserChanged).not.toHaveBeenCalled();
  });
});
