import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { Logo } from "./Logo";
import { LangSwitcher } from "./LangSwitcher";
import { InstallPWA } from "./InstallPWA";
import { ShieldCheck } from "lucide-react";
import { Button } from "./ui/button";

export function SiteHeader({ variant = "client" }: { variant?: "client" | "admin" }) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === "ar";

  return (
    <header className="mx-auto flex max-w-6xl items-center justify-between px-3 py-3 sm:px-4 sm:py-4">
      <div className={`flex items-center gap-2 sm:gap-3 min-w-0 ${isRtl ? "flex-row-reverse" : ""}`}>
        <Link to="/" className="shrink-0">
          <Logo size={40} className="sm:size-12" />
        </Link>
        <div className={`min-w-0 ${isRtl ? "text-right" : "text-left"}`}>
          <div className="truncate font-display text-sm font-semibold text-primary sm:text-lg md:text-xl">
            {t("brand.name")}
          </div>
          <div className="hidden truncate text-[10px] text-muted-foreground sm:block sm:text-xs">
            {t("brand.tagline")}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
        <InstallPWA variant={variant} />
        <LangSwitcher />
        <Link to="/admin/login" className="hidden sm:inline-flex">
          <Button variant="ghost" size="sm" className="gap-1 text-xs sm:text-sm">
            <ShieldCheck className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden md:inline">{t("admin.login")}</span>
          </Button>
        </Link>
      </div>
    </header>
  );
}
