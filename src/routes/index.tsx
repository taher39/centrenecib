import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useServerFn } from "@tanstack/react-start";
import { loginByCode } from "@/lib/booking.functions";
import { Logo } from "@/components/Logo";
import { LangSwitcher } from "@/components/LangSwitcher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { InstallPWA } from "@/components/InstallPWA";

export const Route = createFileRoute("/")({ component: HomePage });

function RoseBloom() {
  return (
    <svg viewBox="0 0 200 200" className="h-44 w-44">
      <defs>
        <radialGradient id="g" cx="50%" cy="50%">
          <stop offset="0%" stopColor="oklch(0.92 0.08 350)" />
          <stop offset="100%" stopColor="oklch(0.65 0.18 350)" />
        </radialGradient>
      </defs>
      {[0, 60, 120, 180, 240, 300].map((rot, i) => (
        <g key={i} style={{ transformOrigin: "100px 100px", transform: `rotate(${rot}deg)`, animationDelay: `${i * 70}ms` }} className="petal">
          <path d="M100 100 C 70 70, 70 30, 100 20 C 130 30, 130 70, 100 100 Z" fill="url(#g)" opacity="0.9" />
        </g>
      ))}
      <circle cx="100" cy="100" r="14" fill="oklch(0.78 0.13 85)" />
    </svg>
  );
}

function HomePage() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === "ar";
  const navigate = useNavigate();
  const codeLogin = useServerFn(loginByCode);
  const [stage, setStage] = useState<"bloom" | "split" | "form">("bloom");
  const [mode, setMode] = useState<"code" | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Auto-redirect if remembered
    const c = typeof window !== "undefined" ? localStorage.getItem("nassib_client") : null;
    if (c) { navigate({ to: "/me" }); return; }
    const t1 = setTimeout(() => setStage("split"), 1100);
    const t2 = setTimeout(() => setStage("form"), 2000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [navigate]);

  const tryLogin = async () => {
    if (!/^\d{10}$/.test(code)) { toast.error(t("client.invalidCode")); return; }
    setBusy(true);
    try {
      const r = await codeLogin({ data: { code } });
      if (!r.client) { toast.error(t("client.invalidCode")); return; }
      localStorage.setItem("nassib_code", code);
      localStorage.setItem("nassib_client", JSON.stringify({ id: r.client.id, fullName: r.client.full_name }));
      navigate({ to: "/me" });
    } finally { setBusy(false); }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-rose-gradient">
      <header className="relative z-30 mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <div className={`flex items-center gap-3 ${isRtl ? "flex-row-reverse" : ""}`}>
          <Logo size={56} />
          <div className={isRtl ? "text-right" : "text-left"}>
            <div className="font-display text-xl font-semibold text-primary">{t("brand.name")}</div>
            <div className="text-xs text-muted-foreground">{t("brand.tagline")}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <InstallPWA variant="client" />
          <LangSwitcher />
          <Link to="/admin/login"><Button variant="ghost" size="sm" className="gap-1"><ShieldCheck className="h-4 w-4" />{t("admin.login")}</Button></Link>
        </div>
      </header>

      <AnimatePresence>
        {stage === "bloom" && (
          <motion.div key="bloom" initial={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-20 flex items-center justify-center">
            <RoseBloom />
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div initial={{ x: 0 }} animate={stage !== "bloom" ? { x: "-100%" } : { x: 0 }} transition={{ duration: 0.9, ease: [0.7, 0, 0.3, 1] }} className="absolute inset-y-0 left-0 z-10 w-1/2 bg-gradient-to-br from-primary/95 to-primary/80" />
      <motion.div initial={{ x: 0 }} animate={stage !== "bloom" ? { x: "100%" } : { x: 0 }} transition={{ duration: 0.9, ease: [0.7, 0, 0.3, 1] }} className="absolute inset-y-0 right-0 z-10 w-1/2 bg-gradient-to-bl from-primary/95 to-primary/80" />

      <main className="relative z-0 mx-auto flex max-w-md flex-col items-center px-4 pb-16 pt-12">
        <AnimatePresence mode="wait">
          {stage === "form" && (
            <motion.div key="form" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="w-full">
              <div className="mb-8 text-center">
                <h1 className="font-display text-3xl font-semibold text-primary md:text-4xl">{t("client.loginTitle")}</h1>
                <p className="mt-2 text-sm text-muted-foreground">{t("brand.exclusive")}</p>
              </div>

              {mode === null && (
                <div className="grid gap-3">
                  <Button size="lg" className="h-14 rounded-2xl text-base" onClick={() => setMode("code")}>
                    <Sparkles className="h-4 w-4" /> {t("client.haveCode")}
                  </Button>
                  <Button size="lg" variant="outline" className="h-14 rounded-2xl text-base border-primary/30" onClick={() => navigate({ to: "/book" })}>
                    {t("client.newClient")}
                  </Button>
                </div>
              )}

              {mode === "code" && (
                <form className="grid gap-4 rounded-2xl bg-card p-6 shadow-soft" onSubmit={(e) => { e.preventDefault(); tryLogin(); }}>
                  <div className="grid gap-2">
                    <Label>{t("client.codeLabel")}</Label>
                    <Input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} inputMode="numeric" maxLength={10} placeholder="——————————" className="h-12 text-center tracking-[0.4em] text-lg" />
                  </div>
                  <Button type="submit" size="lg" disabled={busy} className="h-12 rounded-xl">{busy ? t("common.loading") : t("client.enter")}</Button>
                  <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setMode(null)}>← {t("common.back")}</button>
                </form>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="relative z-0 pb-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} {t("brand.name")}
      </footer>
    </div>
  );
}
