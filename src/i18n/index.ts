import { createContext, useContext } from "react";
import type { LocaleCode, Translations } from "./types";
import zhCN from "./locales/zh-CN";
import en from "./locales/en";

export type { LocaleCode, Translations };

export const LOCALE_STORAGE_KEY = "focusd-island-locale";

export const TRANSLATIONS: Record<LocaleCode, Translations> = {
  "zh-CN": zhCN,
  en,
};

export const LOCALE_CODES = Object.keys(TRANSLATIONS) as LocaleCode[];

/** The project is Chinese-first, so an unrecognized system locale stays on zh-CN. */
export const FALLBACK_LOCALE: LocaleCode = "zh-CN";

export function isLocaleCode(value: unknown): value is LocaleCode {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(TRANSLATIONS, value)
  );
}

function detectLocale(): LocaleCode {
  const candidates = [
    ...(navigator.languages ?? []),
    navigator.language ?? "",
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (isLocaleCode(candidate)) {
      return candidate;
    }

    const base = candidate.split("-")[0]?.toLowerCase();

    if (base === "zh") {
      return "zh-CN";
    }

    if (isLocaleCode(base)) {
      return base;
    }
  }

  return FALLBACK_LOCALE;
}

export function loadLocale(): LocaleCode {
  const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);

  return isLocaleCode(stored) ? stored : detectLocale();
}

export function saveLocale(locale: LocaleCode) {
  window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
}

const TranslationContext = createContext<Translations>(zhCN);

export const TranslationProvider = TranslationContext.Provider;

export function useTranslation() {
  return useContext(TranslationContext);
}
