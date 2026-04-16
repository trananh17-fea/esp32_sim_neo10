import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { translations, type Locale } from "./translations";

type TranslationType = typeof translations.vi | typeof translations.en;

interface I18nCtx {
  locale: Locale;
  t: TranslationType;
  setLocale: (l: Locale) => void;
  toggleLocale: () => void;
}

const I18nContext = createContext<I18nCtx>({
  locale: "vi",
  t: translations.vi,
  setLocale: () => {},
  toggleLocale: () => {},
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const saved = localStorage.getItem("basew-locale");
    if (saved === "en" || saved === "vi") return saved;
    return "vi";
  });

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    localStorage.setItem("basew-locale", l);
    document.documentElement.lang = l;
  }, []);

  const toggleLocale = useCallback(() => {
    setLocale(locale === "vi" ? "en" : "vi");
  }, [locale, setLocale]);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return (
    <I18nContext.Provider value={{ locale, t: translations[locale], setLocale, toggleLocale }}>
      {children}
    </I18nContext.Provider>
  );
}

export const useI18n = () => useContext(I18nContext);
