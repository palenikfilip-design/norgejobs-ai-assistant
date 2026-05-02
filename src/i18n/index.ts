import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./locales/en.json";
import cs from "./locales/cs.json";
import sk from "./locales/sk.json";
import de from "./locales/de.json";
import pl from "./locales/pl.json";

export const SUPPORTED_LANGUAGES = [
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "cs", label: "Čeština", flag: "🇨🇿" },
  { code: "sk", label: "Slovenčina", flag: "🇸🇰" },
  { code: "de", label: "Deutsch", flag: "🇩🇪" },
  { code: "pl", label: "Polski", flag: "🇵🇱" },
] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]["code"];

/**
 * Resolve the initial language:
 *  - persisted choice in localStorage("leslieLanguage") wins
 *  - else inspect navigator.language: sk → sk, en → en, anything else → cs
 *  - SSR / no navigator → cs
 */
function resolveInitialLanguage(): LanguageCode {
  try {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem("leslieLanguage") : null;
    if (stored && SUPPORTED_LANGUAGES.some((l) => l.code === stored)) {
      return stored as LanguageCode;
    }
  } catch {
    /* ignore */
  }
  const nav = typeof navigator !== "undefined" ? navigator.language?.toLowerCase() ?? "" : "";
  if (nav.startsWith("sk")) return "sk";
  if (nav.startsWith("en")) return "en";
  if (nav.startsWith("de")) return "de";
  if (nav.startsWith("pl")) return "pl";
  return "cs";
}

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      cs: { translation: cs },
      sk: { translation: sk },
      de: { translation: de },
      pl: { translation: pl },
    },
    lng: resolveInitialLanguage(),
    fallbackLng: "cs",
    supportedLngs: SUPPORTED_LANGUAGES.map((l) => l.code),
    interpolation: { escapeValue: false },
  });

// Persist any future language change
if (typeof window !== "undefined") {
  i18n.on("languageChanged", (lng) => {
    try {
      window.localStorage.setItem("leslieLanguage", lng);
    } catch {
      /* ignore */
    }
  });
}

export default i18n;
