import { createFileRoute, Link, Outlet, useLocation, useNavigate, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { me } from "@/lib/admin.functions";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { LangSwitcher } from "@/components/LangSwitcher";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import {
  Calendar, Users, Sparkles, Image as ImageIcon, ScrollText, Wallet,
  Percent, Settings as SettingsIcon, UserCog, ClipboardList, LogOut, Menu, X,
  Package, UserCheck, FileText
} from "lucide-react";
import { useEffect, useState } from "react";
import { InstallPWA } from "@/components/InstallPWA";

export const Route = createFileRoute("/admin")({
  beforeLoad: async ({ location }) => {
    if (location.pathname === "/admin/login" || location.pathname === "/admin/signup") return;
    // Only check auth in the browser — SSR has no session and would redirect-loop.
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/admin/login" });
  },
  component: AdminLayout,
});

type Scope = "appointments" | "clients" | "services" | "offers" | "gallery" | "invoices" | "finance" | "discounts" | "products" | "attendance" | "reports";

const NAV: { to: string; icon: typeof Calendar; label: string; scope?: Scope; adminOnly?: boolean }[] = [
  { to: "/admin", icon: Calendar, label: "nav.appointments", scope: "appointments" },
  { to: "/admin/clients", icon: Users, label: "nav.clients", scope: "clients" },
  { to: "/admin/services", icon: Sparkles, label: "nav.services", scope: "services" },
  { to: "/admin/offers", icon: Percent, label: "nav.offers", scope: "offers" },
  { to: "/admin/gallery", icon: ImageIcon, label: "nav.gallery", scope: "gallery" },
  { to: "/admin/invoices", icon: ScrollText, label: "nav.invoices", scope: "invoices" },
  { to: "/admin/finance", icon: Wallet, label: "nav.finance", scope: "finance" },
  { to: "/admin/products", icon: Package, label: "nav.products", scope: "products" },
  { to: "/admin/attendance", icon: UserCheck, label: "nav.attendance", scope: "attendance" },
  { to: "/admin/reports", icon: FileText, label: "nav.reports", scope: "reports" },
  { to: "/admin/staff", icon: UserCog, label: "nav.staff", adminOnly: true },
  { to: "/admin/activity", icon: ClipboardList, label: "nav.activity", adminOnly: true },
  { to: "/admin/settings", icon: SettingsIcon, label: "nav.settings", adminOnly: true },
];

function AdminLayout() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const loc = useLocation();
  const navigate = useNavigate();
  const meFn = useServerFn(me);
  const meQ = useQuery({ queryKey: ["me"], queryFn: () => meFn(), retry: false });
  const [open, setOpen] = useState(false);

  // Skip layout chrome on /admin/login and /admin/signup
  if (loc.pathname === "/admin/login" || loc.pathname === "/admin/signup") return <Outlet />;

  useEffect(() => { if (meQ.isError) navigate({ to: "/admin/login" }); }, [meQ.isError, navigate]);

  const allowed = (item: { scope?: Scope; adminOnly?: boolean }) => {
    if (item.adminOnly) return !!meQ.data?.isAdmin;
    if (!item.scope) return true;
    if (meQ.data?.isAdmin) return true;
    return (meQ.data?.perms ?? []).some((p) => p.scope === item.scope && (p.action === "view" || p.action === "edit"));
  };

  const signOut = async () => { await supabase.auth.signOut(); navigate({ to: "/admin/login" }); };

  return (
    <div className={`min-h-screen bg-background flex ${isAr ? "flex-row-reverse" : ""}`}>
      {/* Mobile backdrop */}
      {open && <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => setOpen(false)} />}

      {/* Sidebar */}
      <aside className={`${open ? "translate-x-0" : isAr ? "translate-x-full" : "-translate-x-full"} md:translate-x-0 fixed md:sticky top-0 z-40 h-screen w-64 shrink-0 border-e bg-sidebar text-sidebar-foreground transition-transform`}>
        <div className="flex h-16 items-center gap-3 border-b px-4">
          <Logo size={36} />
          <div className="flex-1">
            <div className="font-display text-sm text-primary leading-tight">{t("brand.name")}</div>
            <div className="text-[10px] text-muted-foreground">{meQ.data?.displayName ?? "—"}</div>
          </div>
          <button className="md:hidden" onClick={() => setOpen(false)}><X className="h-5 w-5" /></button>
        </div>
        <nav className="p-2 grid gap-1 overflow-y-auto h-[calc(100vh-4rem-3.5rem)]">
          {NAV.filter((n) => allowed(n)).map((n) => {
            const active = loc.pathname === n.to || (n.to !== "/admin" && loc.pathname.startsWith(n.to));
            return (
              <Link key={n.to} to={n.to} onClick={() => setOpen(false)} className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${active ? "bg-primary text-primary-foreground" : "hover:bg-sidebar-accent"}`}>
                <n.icon className="h-4 w-4" />
                <span>{t(n.label)}</span>
              </Link>
            );
          })}
        </nav>
        <div className="border-t p-2">
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={signOut}><LogOut className="h-4 w-4 me-2" />{t("nav.logout")}</Button>
        </div>
      </aside>

      <div className="flex-1 min-w-0">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-2 border-b bg-card/95 backdrop-blur px-4">
          <button className="md:hidden" onClick={() => setOpen(true)}><Menu className="h-5 w-5" /></button>
          <div className="font-display text-primary">{t("admin.overview")}</div>
          <div className="flex items-center gap-2">
            <InstallPWA variant="admin" />
            <LangSwitcher />
          </div>
        </header>
        <main className="p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
