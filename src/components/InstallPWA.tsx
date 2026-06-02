import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download, Share } from "lucide-react";
import { useTranslation } from "react-i18next";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isIOS() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const iOSUA = /iPad|iPhone|iPod/.test(ua);
  // iPadOS 13+ reports as Mac with touch
  const iPadOS = ua.includes("Mac") && "ontouchend" in document;
  return iOSUA || iPadOS;
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  const mq = window.matchMedia?.("(display-mode: standalone)").matches;
  // iOS legacy
  const ios = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return !!(mq || ios);
}

export function InstallPWA({ variant = "client" }: { variant?: "admin" | "client" }) {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [installed, setInstalled] = useState<boolean>(false);
  const [iosOpen, setIosOpen] = useState(false);
  const ios = typeof window !== "undefined" && isIOS();

  // Swap manifest link based on variant
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
    // iOS hints
    const ensureMeta = (name: string, content: string) => {
      let m = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
      if (!m) { m = document.createElement("meta"); m.name = name; document.head.appendChild(m); }
      m.content = content;
    };
    ensureMeta("apple-mobile-web-app-capable", "yes");
    ensureMeta("apple-mobile-web-app-status-bar-style", "default");
    ensureMeta("apple-mobile-web-app-title", variant === "admin" ? "NECIB Admin" : "CENTRE NECIB");
    let appleIcon = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');
    if (!appleIcon) { appleIcon = document.createElement("link"); appleIcon.rel = "apple-touch-icon"; document.head.appendChild(appleIcon); }
    appleIcon.href = "/app-icon.png";
  }, [variant]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandalone()) setInstalled(true);
    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
    };
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
      <Button onClick={install} size="sm" variant="outline" className="gap-1 border-primary/40">
        <Download className="h-4 w-4" />
        <span className="hidden sm:inline">{label}</span>
      </Button>
      <Dialog open={iosOpen} onOpenChange={setIosOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{isAr ? "تثبيت على iPhone" : "Installer sur iPhone"}</DialogTitle></DialogHeader>
          <div className="grid gap-3 text-sm">
            <p>{isAr ? "لإضافة التطبيق إلى الشاشة الرئيسية على iPhone/iPad:" : "Pour ajouter l'application à l'écran d'accueil sur iPhone/iPad :"}</p>
            <ol className="list-decimal ps-5 grid gap-2">
              <li className="flex items-center gap-2">
                {isAr ? "اضغط على زر المشاركة" : "Appuyez sur le bouton Partager"}
                <Share className="h-4 w-4 text-primary" />
                {isAr ? "في الأسفل" : "en bas"}
              </li>
              <li>{isAr ? "اختر «إضافة إلى الشاشة الرئيسية»" : "Choisissez « Sur l'écran d'accueil »"}</li>
              <li>{isAr ? "اضغط «إضافة»" : "Appuyez sur « Ajouter »"}</li>
            </ol>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
