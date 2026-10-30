import { getLocales } from "expo-localization";
import { I18nManager } from "react-native";
import { useAppSelector } from "@/store";

I18nManager.allowRTL(true);

export const supportedLocales = ["en", "hi"] as const;
export type SupportedLocale = (typeof supportedLocales)[number];

const en = {
  "nav.today": "Today",
  "nav.chat": "Chat",
  "nav.tasks": "Tasks",
  "nav.insights": "Insights",
  "nav.settings": "Settings",
};

type TranslationKey = keyof typeof en;

const hi: Record<TranslationKey, string> = {
  "nav.today": "आज",
  "nav.chat": "चैट",
  "nav.tasks": "काम",
  "nav.insights": "जानकारी",
  "nav.settings": "सेटिंग्स",
};

const dictionaries: Record<SupportedLocale, Record<TranslationKey, string>> = {
  en,
  hi,
};

function deviceLocale(): string {
  return getLocales()[0]?.languageCode ?? "en";
}

export function normalizeLocale(locale: string | null | undefined): SupportedLocale {
  const primary = (locale ?? deviceLocale()).toLowerCase().split(/[-_]/)[0];
  return primary === "hi" ? "hi" : "en";
}

export function translate(
  locale: string | null | undefined,
  key: TranslationKey
): string {
  return dictionaries[normalizeLocale(locale)][key];
}

export function textDirection(locale: string | null | undefined): "ltr" | "rtl" {
  return /^(ar|fa|he|ur)([-_]|$)/i.test(locale ?? "") ? "rtl" : "ltr";
}

export function useTranslation() {
  const locale = useAppSelector(state => state.auth.user?.locale);
  return {
    locale: normalizeLocale(locale),
    direction: textDirection(locale),
    t: (key: TranslationKey): string => translate(locale, key),
  };
}
