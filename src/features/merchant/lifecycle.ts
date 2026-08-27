import type { StoreSubmission } from "../../adapters/uiAdapters";

export type MerchantLifecycleTone = "neutral" | "info" | "warning" | "danger" | "success";
export type MerchantActionOwner = "merchant" | "platform" | "system" | "none";
export type MerchantLifecycleStage = "review" | "provisioning" | "publication" | "published" | "blocked";

export interface MerchantLifecycleViewModel {
  stage: MerchantLifecycleStage;
  tone: MerchantLifecycleTone;
  label: string;
  headline: string;
  explanation: string;
  nextAction: string;
  actionOwner: MerchantActionOwner;
  actionOwnerLabel: string;
  completedSteps: number;
  canOpenBuilder: boolean;
  isPublished: boolean;
}

const ownerLabels: Record<MerchantActionOwner, string> = {
  merchant: "أنت",
  platform: "فريق المنصة",
  system: "النظام",
  none: "لا يوجد إجراء مطلوب",
};

function lifecycle(
  values: Omit<MerchantLifecycleViewModel, "actionOwnerLabel">,
): MerchantLifecycleViewModel {
  return { ...values, actionOwnerLabel: ownerLabels[values.actionOwner] };
}

export function publicationBlockerLabel(blocker: string): string {
  const labels: Record<string, string> = {
    review_not_approved: "اعتماد المتجر لم يكتمل",
    provisioning_not_ready: "تجهيز بيئة المتجر لم يكتمل",
    publication_request_not_open: "طلب النشر غير مفتوح",
    domain_not_reserved: "العنوان العام غير محجوز",
    subscription_not_active: "اشتراك المتجر غير فعال",
    workspace_not_ready: "بيانات المتجر ليست جاهزة للنشر",
  };

  return labels[blocker] ?? "يوجد مانع نشر يحتاج مراجعة فريق المنصة";
}

export function deriveMerchantLifecycle(store: StoreSubmission): MerchantLifecycleViewModel {
  const canOpenBuilder = store.verificationStatus === "approved"
    && store.provisioningStatus === "active"
    && store.capabilities.workspaceManage;

  if (store.verificationStatus === "suspended") {
    return lifecycle({
      stage: "blocked",
      tone: "danger",
      label: "موقوف",
      headline: "تم تعليق المتجر",
      explanation: "المتجر غير متاح حاليًا ولا يمكن إدارة مساحته حتى تراجع إدارة المنصة التعليق.",
      nextAction: "تواصل مع فريق المنصة لمعرفة سبب التعليق وخطوات الاستعادة.",
      actionOwner: "platform",
      completedSteps: 1,
      canOpenBuilder: false,
      isPublished: false,
    });
  }

  if (store.verificationStatus === "changes_requested") {
    return lifecycle({
      stage: "blocked",
      tone: "warning",
      label: "استكمال مطلوب",
      headline: "طلبت المنصة استكمال بنود محددة",
      explanation: store.reviewFeedback || "راجع البنود المحددة من فريق المنصة وأعد إرسال الطلب دون البدء من جديد.",
      nextAction: "افتح طلب الاستكمال، صحح البنود المحددة فقط، ثم أعد الإرسال.",
      actionOwner: "merchant",
      completedSteps: 1,
      canOpenBuilder: false,
      isPublished: false,
    });
  }

  if (store.verificationStatus === "rejected") {
    return lifecycle({
      stage: "blocked",
      tone: "danger",
      label: "مرفوض",
      headline: "رُفض طلب المتجر نهائيًا",
      explanation: store.reviewFeedback || "أغلقت إدارة المنصة الطلب بعد المراجعة.",
      nextAction: "راجع سبب القرار وتواصل مع دعم المنصة إذا احتجت إلى اعتراض أو طلب جديد.",
      actionOwner: "platform",
      completedSteps: 1,
      canOpenBuilder: false,
      isPublished: false,
    });
  }

  if (store.verificationStatus === "pending") {
    return lifecycle({
      stage: "review",
      tone: "info",
      label: "قيد المراجعة",
      headline: "طلب المتجر لدى فريق المنصة",
      explanation: "تم استلام الطلب. لن يبدأ تجهيز قاعدة المتجر قبل اكتمال المراجعة.",
      nextAction: "لا يلزمك إجراء الآن؛ انتظر قرار المراجعة.",
      actionOwner: "platform",
      completedSteps: 1,
      canOpenBuilder: false,
      isPublished: false,
    });
  }

  if (store.verificationStatus !== "approved") {
    return lifecycle({
      stage: "blocked",
      tone: "danger",
      label: "حالة غير متوقعة",
      headline: "تعذر تحديد مرحلة المتجر بأمان",
      explanation: "أوقفنا الإجراءات لأن حالة المتجر لا تطابق العقد المعروف.",
      nextAction: "حدّث البيانات، ثم تواصل مع فريق المنصة إذا استمرت المشكلة.",
      actionOwner: "platform",
      completedSteps: 0,
      canOpenBuilder: false,
      isPublished: false,
    });
  }

  if (["not_started", "queued", "provisioning", "retrying"].includes(store.provisioningStatus)) {
    const queued = store.provisioningStatus === "not_started" || store.provisioningStatus === "queued";
    return lifecycle({
      stage: "provisioning",
      tone: "info",
      label: queued ? "بانتظار التجهيز" : "جارٍ التجهيز",
      headline: queued ? "تم اعتماد المتجر وسيبدأ التجهيز" : "يجري إنشاء بيئة المتجر",
      explanation: "يجهز النظام قاعدة البيانات والإعدادات المعزولة الخاصة بمتجرك.",
      nextAction: "لا تغلق حسابك أو تعِد إنشاء الطلب؛ ستتحدث الحالة تلقائيًا.",
      actionOwner: "system",
      completedSteps: 2,
      canOpenBuilder: false,
      isPublished: false,
    });
  }

  if (store.provisioningStatus === "failed") {
    return lifecycle({
      stage: "blocked",
      tone: "danger",
      label: "تعذر التجهيز",
      headline: "توقف تجهيز المتجر بأمان",
      explanation: "لم يصبح المتجر متاحًا، واحتفظ النظام ببيانات الطلب لمراجعة المشكلة وإعادة المحاولة.",
      nextAction: "فريق المنصة مسؤول عن مراجعة التجهيز وإعادة المحاولة.",
      actionOwner: "platform",
      completedSteps: 2,
      canOpenBuilder: false,
      isPublished: false,
    });
  }

  if (store.provisioningStatus !== "active") {
    return lifecycle({
      stage: "blocked",
      tone: "danger",
      label: "حالة غير متوقعة",
      headline: "تعذر تحديد حالة التجهيز",
      explanation: "لن نفتح أدوات المتجر قبل أن يؤكد الخادم جاهزية بيئته.",
      nextAction: "حدّث البيانات أو تواصل مع فريق المنصة.",
      actionOwner: "platform",
      completedSteps: 2,
      canOpenBuilder: false,
      isPublished: false,
    });
  }

  if (store.subscriptionStatus !== "active") {
    const pending = store.subscriptionStatus === "pending_activation";
    return lifecycle({
      stage: "blocked",
      tone: "warning",
      label: pending ? "بانتظار تفعيل الباقة" : "الاشتراك غير فعال",
      headline: pending ? "المتجر جاهز تقنيًا وينتظر تفعيل الباقة" : "توقف النشر بسبب حالة الاشتراك",
      explanation: pending
        ? "لن ينشر المتجر حتى تُفعّل الباقة المختارة."
        : "يمكنك إدارة بيانات المتجر، لكن عرضه العام يتطلب اشتراكًا فعالًا.",
      nextAction: pending ? "ينفذ فريق المنصة تفعيل الباقة." : "تواصل مع فريق المنصة لاستعادة أو تجديد الاشتراك.",
      actionOwner: "platform",
      completedSteps: 3,
      canOpenBuilder,
      isPublished: false,
    });
  }

  if (store.publicationStatus === "published") {
    if (store.publicDomain && store.publicationBlockers.length === 0) {
      return lifecycle({
        stage: "published",
        tone: "success",
        label: "منشور",
        headline: "متجرك متاح للعملاء",
        explanation: "استخدم الرابط العام المؤكد من الخادم لمشاركة متجرك ومتابعة إدارته.",
        nextAction: "شارك الرابط أو افتح لوحة المتجر لإدارة المحتوى والطلبات.",
        actionOwner: "merchant",
        completedSteps: 4,
        canOpenBuilder,
        isPublished: true,
      });
    }

    return lifecycle({
      stage: "blocked",
      tone: "danger",
      label: "النشر يحتاج مراجعة",
      headline: "الخادم لا يؤكد رابطًا عامًا صالحًا",
      explanation: "لن نعرض رابطًا مستنتجًا أو غير مؤكد. بيانات النشر تحتاج مراجعة تشغيلية.",
      nextAction: "حدّث الحالة، ثم تواصل مع فريق المنصة إن استمرت المشكلة.",
      actionOwner: "platform",
      completedSteps: 3,
      canOpenBuilder,
      isPublished: false,
    });
  }

  if (store.publicationStatus === "rejected") {
    return lifecycle({
      stage: "blocked",
      tone: "warning",
      label: "النشر غير معتمد",
      headline: "أُعيد طلب نشر المتجر",
      explanation: "المتجر جاهز للإدارة، لكن طلب النشر يحتاج معالجة قبل ظهوره للعملاء.",
      nextAction: "راجع بيانات المتجر ثم أعد إرسال طلبه من بوابة التاجر.",
      actionOwner: "merchant",
      completedSteps: 3,
      canOpenBuilder,
      isPublished: false,
    });
  }

  if (store.publicationBlockers.length > 0) {
    return lifecycle({
      stage: "blocked",
      tone: "warning",
      label: "غير جاهز للنشر",
      headline: publicationBlockerLabel(store.publicationBlockers[0]),
      explanation: "يمكنك إدارة المتجر، لكن الخادم ما زال يمنع عرضه العام حتى تكتمل المتطلبات.",
      nextAction: "راجع موانع النشر الظاهرة، ويعالج فريق المنصة المتطلبات التشغيلية.",
      actionOwner: "platform",
      completedSteps: 3,
      canOpenBuilder,
      isPublished: false,
    });
  }

  return lifecycle({
    stage: "publication",
    tone: "success",
    label: "جاهز للنشر",
    headline: "اكتملت المتطلبات الفنية",
    explanation: "يمكنك إدارة المتجر ونشره الآن من حساب المالك بعد مراجعة المعاينة النهائية.",
    nextAction: "راجع المتجر ثم اضغط نشر ليصبح الرابط العام متاحًا للعملاء.",
    actionOwner: "merchant",
    completedSteps: 3,
    canOpenBuilder,
    isPublished: false,
  });
}
