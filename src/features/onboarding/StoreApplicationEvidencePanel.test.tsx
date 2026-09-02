// @vitest-environment jsdom

import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UiAdapterError, type StoreApplicationDossier } from "../../adapters/uiAdapters";
import StoreApplicationEvidencePanel from "./StoreApplicationEvidencePanel";

const application: StoreApplicationDossier = {
  draftId: "draft-evidence",
  tenantId: null,
  draftRevision: 7,
  ready: false,
  blockers: ["license", "owner_declaration"],
  requirements: [
    {
      key: "license",
      label: "ترخيص النشاط",
      description: "أرفق الترخيص بصيغة واضحة.",
      uploadRequired: true,
      allowExemption: false,
      resolved: false,
      evidence: null,
    },
    {
      key: "owner_declaration",
      label: "إفادة المالك",
      description: "إفادة صريحة عند عدم توفر المستند.",
      uploadRequired: false,
      allowExemption: true,
      resolved: false,
      evidence: null,
    },
  ],
  correctionRequest: null,
  timeline: [],
};

function renderPanel(actions: {
  onUploadEvidence?: React.ComponentProps<typeof StoreApplicationEvidencePanel>["onUploadEvidence"];
  onDeclareExemption?: React.ComponentProps<typeof StoreApplicationEvidencePanel>["onDeclareExemption"];
} = {}, props: Partial<React.ComponentProps<typeof StoreApplicationEvidencePanel>> = {}) {
  const onApplicationChanged = vi.fn();
  const onBusyChange = vi.fn();
  render(
    <StoreApplicationEvidencePanel application={application} onUploadEvidence={actions.onUploadEvidence ?? vi.fn()} onDeclareExemption={actions.onDeclareExemption ?? vi.fn()} onApplicationChanged={onApplicationChanged} onBusyChange={onBusyChange} {...props} />,
  );
  return { onApplicationChanged, onBusyChange };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("StoreApplicationEvidencePanel", () => {
  it("uploads an allowed document with the current revision and applies the server result", async () => {
    const next = { ...application, draftRevision: 8, blockers: ["owner_declaration"] };
    const onUploadEvidence = vi.fn().mockResolvedValue(next);
    const { onApplicationChanged, onBusyChange } = renderPanel({ onUploadEvidence });
    const file = new File(["licensed"], "license.pdf", { type: "application/pdf" });

    await userEvent.upload(screen.getByLabelText("رفع مستند ترخيص النشاط"), file);

    await waitFor(() => expect(onUploadEvidence).toHaveBeenCalledWith("license", file, expect.any(AbortSignal)));
    expect(onApplicationChanged).toHaveBeenCalledWith(next);
    expect(onBusyChange).toHaveBeenCalledWith(true);
    expect(onBusyChange).toHaveBeenLastCalledWith(false);
  });

  it("rejects unsupported and oversized files before calling the API", async () => {
    const onUploadEvidence = vi.fn();
    renderPanel({ onUploadEvidence });
    const upload = screen.getByLabelText("رفع مستند ترخيص النشاط");
    const user = userEvent.setup({ applyAccept: false });

    await user.upload(upload, new File(["text"], "notes.txt", { type: "text/plain" }));
    expect((await screen.findByRole("alert")).textContent).toContain("صيغة الملف غير مدعومة");

    await user.upload(upload, new File([new Uint8Array(5 * 1024 * 1024 + 1)], "large.pdf", { type: "application/pdf" }));
    expect((await screen.findByRole("alert")).textContent).toContain("أكبر من 5 ميجابايت");
    expect(onUploadEvidence).not.toHaveBeenCalled();
  });

  it("records an allowed exemption only after a meaningful reason", async () => {
    const next = { ...application, draftRevision: 8, blockers: ["license"] };
    const onDeclareExemption = vi.fn().mockResolvedValue(next);
    const { onApplicationChanged } = renderPanel({ onDeclareExemption });

    await userEvent.click(screen.getByRole("button", { name: "تسجيل الإعفاء" }));
    expect((await screen.findByRole("alert")).textContent).toContain("10 أحرف");
    expect(onDeclareExemption).not.toHaveBeenCalled();

    await userEvent.type(screen.getByRole("textbox", { name: "سبب إعفاء إفادة المالك" }), "لا يتطلب نشاطي هذا المستند");
    await userEvent.click(screen.getByRole("button", { name: "تسجيل الإعفاء" }));
    await waitFor(() => expect(onDeclareExemption).toHaveBeenCalledWith("owner_declaration", "لا يتطلب نشاطي هذا المستند", expect.any(AbortSignal)));
    expect(onApplicationChanged).toHaveBeenCalledWith(next);
  });

  it("does not overwrite a revision conflict and offers an explicit server reload", async () => {
    const onUploadEvidence = vi.fn().mockRejectedValue(new UiAdapterError("عدّل مستخدم آخر هذا الطلب.", "conflict", "draft_revision_conflict"));
    const onReloadDraft = vi.fn().mockResolvedValue(undefined);
    renderPanel({ onUploadEvidence }, { onReloadDraft });

    await userEvent.upload(screen.getByLabelText("رفع مستند ترخيص النشاط"), new File(["licensed"], "license.pdf", { type: "application/pdf" }));
    expect((await screen.findByRole("alert")).textContent).toContain("عدّل مستخدم آخر");
    await userEvent.click(screen.getByRole("button", { name: "تحميل أحدث نسخة" }));
    await waitFor(() => expect(onReloadDraft).toHaveBeenCalledOnce());
    expect(onUploadEvidence).toHaveBeenCalledOnce();
  });
});
