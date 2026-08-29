import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Eye, EyeOff, LockKeyhole, Mail, Phone, UserRound } from "lucide-react";
import { useUiAdapters } from "../../adapters/UiAdaptersContext";
import type { UserProfile } from "../../adapters/uiAdapters";
import { uiErrorMessage } from "../../adapters/uiAdapters";
import { authorizeReturnTarget, readSafeReturnTarget } from "../../app/safeReturnTarget";
import PlatformAuthShell from "./PlatformAuthShell";

type AuthMode = "login" | "register" | "forgot" | "reset";

interface AuthRoutePageProps {
  mode: AuthMode;
  currentUser: UserProfile | null;
  restoring: boolean;
  onAuthenticated: (user: UserProfile) => void;
}

export default function AuthRoutePage({ mode, currentUser, restoring, onAuthenticated }: AuthRoutePageProps) {
  const { auth, provisioning } = useUiAdapters();
  const [name, setName] = useState("");
  const [email, setEmail] = useState(() => new URLSearchParams(window.location.search).get("email") ?? "");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const returnTarget = useMemo(() => readSafeReturnTarget(window.location.search), []);

  const continueAfterAuthentication = async (user: UserProfile) => {
    onAuthenticated(user);
    let stores = [];
    try {
      stores = await provisioning.listStores();
    } catch {
      // A failed optional destination lookup must not turn a valid login into a false failure.
    }
    window.location.assign(authorizeReturnTarget(returnTarget, user, stores));
  };

  useEffect(() => {
    if (!restoring && currentUser && (mode === "login" || mode === "register")) void continueAfterAuthentication(currentUser);
  }, [currentUser, mode, restoring]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (mode === "forgot") {
        setNotice(await auth.forgotPassword(email));
      } else if (mode === "reset") {
        const token = new URLSearchParams(window.location.search).get("token") ?? "";
        setNotice(await auth.resetPassword({ token, email, password, passwordConfirmation: confirmation }));
        setPassword("");
        setConfirmation("");
      } else {
        const user = mode === "register"
          ? await auth.register({ name, email, phone, password, passwordConfirmation: confirmation })
          : await auth.login(email, password);
        await continueAfterAuthentication(user);
      }
    } catch (caught) {
      setError(uiErrorMessage(caught, "تعذر إكمال العملية. راجع البيانات وحاول مرة أخرى."));
    } finally {
      setBusy(false);
    }
  };

  const titles: Record<AuthMode, [string, string]> = {
    login: ["مرحبًا بعودتك", "ادخل إلى حسابك لإدارة متاجرك ومتابعة طلباتك."],
    register: ["ابدأ حساب التاجر", "حساب واحد آمن يقودك من الفكرة حتى نشر المتجر."],
    forgot: ["استعادة الوصول", "أدخل بريدك وسنرسل التعليمات إن كان الحساب موجودًا."],
    reset: ["تعيين كلمة مرور جديدة", "استخدم الرابط الآمن واختر كلمة مرور قوية لا تقل عن 10 أحرف."],
  };
  const modeLabels: Record<AuthMode, string> = {
    login: "دخول آمن إلى بوابة التاجر",
    register: "إنشاء حساب تاجر جديد",
    forgot: "استعادة آمنة للوصول",
    reset: "تحديث بيانات الدخول",
  };
  const inputClass = "platform-auth-input min-h-12 w-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-normal outline-none transition";

  return (
    <PlatformAuthShell modeLabel={modeLabels[mode]} title={titles[mode][0]} description={titles[mode][1]}>
            <a href="/" className="mt-7 inline-flex min-h-10 items-center gap-2 text-sm font-bold text-slate-500 transition hover:text-slate-950"><ArrowLeft className="h-4 w-4" />العودة للرئيسية</a>

            {error && <div role="alert" className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}</div>}
            {notice && <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">{notice}</div>}

            <form onSubmit={submit} className="mt-7 space-y-4">
              {mode === "register" && <Field icon={UserRound} label="الاسم الكامل"><input value={name} onChange={(event) => setName(event.target.value)} required maxLength={120} autoComplete="name" className={inputClass} /></Field>}
              <Field icon={Mail} label="البريد الإلكتروني"><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required maxLength={255} autoComplete="email" dir="ltr" className={`${inputClass} text-left`} /></Field>
              {mode === "register" && <Field icon={Phone} label="رقم الهاتف — اختياري"><input value={phone} onChange={(event) => setPhone(event.target.value)} maxLength={32} autoComplete="tel" dir="ltr" placeholder="+967 7xx xxx xxx" className={`${inputClass} text-left`} /></Field>}
              {(mode === "login" || mode === "register" || mode === "reset") && (
                <Field icon={LockKeyhole} label={mode === "reset" ? "كلمة المرور الجديدة" : "كلمة المرور"}>
                  <input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} required minLength={mode === "login" ? undefined : 10} autoComplete={mode === "login" ? "current-password" : "new-password"} className={`${inputClass} pl-12`} />
                  <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label="إظهار أو إخفاء كلمة المرور" className="absolute left-3 top-9 text-slate-400">{showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button>
                </Field>
              )}
              {(mode === "register" || mode === "reset") && <Field icon={LockKeyhole} label="تأكيد كلمة المرور"><input type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required minLength={10} autoComplete="new-password" className={inputClass} /></Field>}

              <button disabled={busy || restoring} style={{ backgroundColor: "var(--platform-brand-accent)", color: "var(--platform-brand-accent-foreground)" }} className="min-h-12 w-full px-5 py-3.5 text-sm font-black shadow-[0_12px_28px_rgba(8,23,37,0.14)] transition hover:brightness-95 disabled:cursor-wait disabled:opacity-60">
                {busy ? "جاري المعالجة..." : mode === "login" ? "تسجيل الدخول" : mode === "register" ? "إنشاء الحساب والمتابعة" : mode === "forgot" ? "إرسال تعليمات الاستعادة" : "تحديث كلمة المرور"}
              </button>
            </form>

            <nav className="platform-auth-links mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm font-bold">
              {mode !== "login" && <a href="/login">لدي حساب</a>}
              {mode !== "register" && <a href="/register">إنشاء حساب جديد</a>}
              {mode === "login" && <a href="/forgot-password">نسيت كلمة المرور؟</a>}
              {mode === "reset" && notice && <a href="/login">الانتقال لتسجيل الدخول</a>}
            </nav>
    </PlatformAuthShell>
  );
}

function Field({ icon: Icon, label, children }: { icon: React.ComponentType<{ className?: string }>; label: string; children: React.ReactNode }) {
  return <label className="relative block text-sm font-bold text-slate-700"><span className="mb-2 flex items-center gap-2"><Icon className="platform-auth-field-icon h-4 w-4" />{label}</span>{children}</label>;
}
