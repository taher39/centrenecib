import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download, Share, Smartphone, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import logo from "@/assets/logo.png";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isIOS() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const iOSUA = /iPad|iPhone|iPod/.test(ua);
  const iPadOS = ua.includes("Mac") && "ontouchend" in document;
  return iOSUA || iPadOS;
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  const mq = window.matchMedia?.("(display-mode: standalone)").matches;
  const ios = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return !!(mq || ios);
}

export function InstallPWA({ variant = "client" }: { variant?: "admin" | "client" }) {
  const { i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [installed, setInstalled] = useState<boolean>(false);
  const [iosOpen, setIosOpen] = useState(false);
  const ios = typeof window !== "undefined" && isIOS();

  useEffect(() => {
    if (typeof document === "undefined") return;
    const href = variant === "admin" ? "/manifest-admin.webmanifest" : "/manifest-client.webmanifest";
    let link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "manifest";
      document.head.appendChild(link);
    }
    link.href = href;
    const ensureMeta = (name: string, content: string) => {
      let m = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
      if (!m) { m = document.createElement("meta"); m.name = name; document.head.appendChild(m); }
      m.content = content;
    };
    ensureMeta("apple-mobile-web-app-capable", "yes");
    ensureMeta("apple-mobile-web-app-status-bar-style", "default");
    ensureMeta("apple-mobile-web-app-title", variant === "admin" ? "NECIB Admin" : "CENTRE NECIB");
    ensureMeta("theme-color", "#1f6a4d");
    let appleIcon = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');
    if (!appleIcon) { appleIcon = document.createElement("link"); appleIcon.rel = "apple-touch-icon"; document.head.appendChild(appleIcon); }
    appleIcon.href = "/apple-touch-icon.png";
  }, [variant]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandalone()) setInstalled(true);
    const onBIP = (e: Event) => { e.preventDefault(); setDeferred(e as BIPEvent); };
    const onInstalled = () => { setInstalled(true); setDeferred(null); };
    const mql = window.matchMedia("(display-mode: standalone)");
    const onMq = (ev: MediaQueryListEvent) => { if (ev.matches) setInstalled(true); };
    window.addEventListener("beforeinstallprompt", onBIP);
    window.addEventListener("appinstalled", onInstalled);
    mql.addEventListener?.("change", onMq);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP);
      window.removeEventListener("appinstalled", onInstalled);
      mql.removeEventListener?.("change", onMq);
    };
  }, []);

  if (installed) return null;
  if (!deferred && !ios) return null;

  const install = async () => {
    if (deferred) {
      await deferred.prompt();
      const r = await deferred.userChoice;
      if (r.outcome === "accepted") setInstalled(true);
      setDeferred(null);
    } else if (ios) {
      setIosOpen(true);
    }
  };

  const label = isAr ? "تثبيت التطبيق" : "Installer l'app";

  return (
    <>
      <button
        onClick={install}
        aria-label={label}
        className="group relative inline-flex items-center gap-2 rounded-full bg-gradient-to-br from-primary via-primary to-primary/85 px-3.5 py-1.5 text-primary-foreground shadow-[0_4px_14px_-2px_oklch(0.45_0.10_160/0.55)] ring-1 ring-primary/40 transition hover:shadow-[0_6px_22px_-4px_oklch(0.45_0.10_160/0.75)] hover:scale-[1.03] active:scale-95 overflow-hidden"
      >
        <span className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,white/30,transparent_60%)] opacity-40 pointer-events-none" />
        <span className="relative flex h-6 w-6 items-center justify-center rounded-full bg-white/95 ring-1 ring-white/60 shrink-0">
          <img src={logo} alt="" className="h-5 w-5 rounded-full object-cover" />
        </span>
        <span className="relative text-[12px] font-semibold tracking-wide hidden xs:inline sm:inline">{label}</span>
        <Download className="relative h-3.5 w-3.5 opacity-90" />
      </button>

      <Dialog open={iosOpen} onOpenChange={setIosOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary">
              <Smartphone className="h-5 w-5" />
              {isAr ? "تثبيت على iPhone" : "Installer sur iPhone"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 text-sm">
            <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 p-3">
              <img src={logo} alt="" className="h-12 w-12 rounded-full ring-2 ring-primary/30" />
              <div>
                <div className="font-semibold text-primary">CENTRE NECIB</div>
                <div className="text-xs text-muted-foreground">{isAr ? "أضف الموقع كتطبيق على شاشتك الرئيسية" : "Ajoutez le site à votre écran d'accueil"}</div>
              </div>
            </div>
            <ol className="grid gap-3">
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">1</span>
                <span className="flex items-center gap-2 flex-wrap pt-0.5">
                  {isAr ? "اضغط على زر المشاركة" : "Touchez le bouton Partager"}
                  <Share className="inline h-4 w-4 text-primary" />
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">2</span>
                <span className="flex items-center gap-2 flex-wrap pt-0.5">
                  {isAr ? "اختر «إضافة إلى الشاشة الرئيسية»" : "Choisissez « Sur l'écran d'accueil »"}
                  <Plus className="inline h-4 w-4 text-primary" />
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">3</span>
                <span className="pt-0.5">{isAr ? "اضغط «إضافة» في الأعلى" : "Appuyez sur « Ajouter » en haut"}</span>
              </li>
            </ol>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
