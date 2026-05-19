import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import ar from "./locales/ar";
import fr from "./locales/fr";
import en from "./locales/en";

if (!i18n.isInitialized) {
  i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources: { ar: { t: ar }, fr: { t: fr }, en: { t: en } },
      fallbackLng: "fr",
      supportedLngs: ["ar", "fr", "en"],
      defaultNS: "t",
      interpolation: { escapeValue: false },
      detection: { order: ["localStorage", "navigator"], caches: ["localStorage"] },
    });
}

export const RTL_LANGS = new Set(["ar"]);
export const applyDirection = (lng: string) => {
  if (typeof document === "undefined") return;
  const dir = RTL_LANGS.has(lng) ? "rtl" : "ltr";
  document.documentElement.setAttribute("dir", dir);
  document.documentElement.setAttribute("lang", lng);
};

if (typeof window !== "undefined") {
  applyDirection(i18n.language || "fr");
  i18n.on("languageChanged", applyDirection);
}

export default i18n;
