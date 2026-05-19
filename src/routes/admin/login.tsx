import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { LangSwitcher } from "@/components/LangSwitcher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/login")({ component: AdminLoginPage });

function AdminLoginPage() {
  const { t } = useTranslation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    // username -> synthetic email so Supabase Auth accepts it
    const email = `${username.toLowerCase().trim()}@nassib.local`;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) { toast.error(t("admin.badCredentials")); return; }
    window.location.href = "/admin";
  };

  return (
    <div className="min-h-screen bg-rose-gradient">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link to="/" className="flex items-center gap-3">
          <Logo size={48} />
          <span className="font-display text-lg text-primary">{t("brand.name")}</span>
        </Link>
        <LangSwitcher />
      </header>
      <main className="mx-auto flex max-w-md flex-col items-center px-4 pt-16">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="w-full rounded-2xl bg-card p-8 shadow-soft">
          <h1 className="font-display text-2xl font-semibold text-primary">{t("admin.login")}</h1>
          <form className="mt-6 grid gap-4" onSubmit={onSubmit}>
            <div className="grid gap-2"><Label>{t("admin.username")}</Label><Input value={username} onChange={(e) => setUsername(e.target.value)} required autoComplete="username" /></div>
            <div className="grid gap-2"><Label>{t("admin.password")}</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" /></div>
            <Button type="submit" disabled={busy} className="h-11 rounded-xl">{busy ? t("common.loading") : t("admin.signIn")}</Button>
            <Link to="/admin/signup" className="text-xs text-center text-muted-foreground hover:text-foreground">Configuration initiale →</Link>
          </form>
        </motion.div>
      </main>
    </div>
  );
}
