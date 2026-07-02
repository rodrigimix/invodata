import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import pt from "./locales/pt.json";
import { getStoredLanguage } from "@/lib/api";

const supportedLanguages = ["en", "pt"];
const storedLanguage = getStoredLanguage();
const browserLanguage = typeof navigator !== "undefined" ? navigator.language.slice(0, 2) : "pt";
const initialLanguage = supportedLanguages.includes(storedLanguage || "")
  ? (storedLanguage as string)
  : (supportedLanguages.includes(browserLanguage) ? browserLanguage : "pt");

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      pt: { translation: pt },
    },
    lng: initialLanguage,
    fallbackLng: "pt",
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
