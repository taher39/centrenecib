import { useTranslation } from "react-i18next";
import { Check, Globe } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const LANGS = [
  { code: "ar", label: "العربية", flag: "🇩🇿", native: "AR" },
  { code: "fr", label: "Français", flag: "🇫🇷", native: "FR" },
  { code: "en", label: "English", flag: "🇬🇧", native: "EN" },
];

export function LangSwitcher() {
  const { i18n, t } = useTranslation();
  const current = LANGS.find((l) => l.code === i18n.language) ?? LANGS[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label={t("common.language")}
          className="group inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-card/90 backdrop-blur px-3 py-1.5 text-foreground shadow-sm transition hover:border-primary hover:shadow-md hover:bg-primary/5 active:scale-95"
        >
          <Globe className="h-3.5 w-3.5 text-primary" />
          <span className="text-base leading-none">{current.flag}</span>
          <span className="text-[11px] font-bold uppercase tracking-widest text-primary">{current.native}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[10rem] rounded-xl border-primary/20 p-1.5 shadow-xl">
        {LANGS.map((l) => {
          const active = l.code === i18n.language;
          return (
            <DropdownMenuItem
              key={l.code}
              onClick={() => i18n.changeLanguage(l.code)}
              className={`flex items-center gap-2 rounded-lg px-2.5 py-2 cursor-pointer ${active ? "bg-primary/10 text-primary font-semibold" : ""}`}
            >
              <span className="text-lg leading-none">{l.flag}</span>
              <span className="flex-1 text-sm">{l.label}</span>
              {active && <Check className="h-3.5 w-3.5 text-primary" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
