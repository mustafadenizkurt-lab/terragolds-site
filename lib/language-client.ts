"use client";

import { useEffect, useState } from "react";
import type { Language } from "./i18n";

const LANGUAGE_STORAGE_KEY = "terragolds-language";

export function readLanguage(): Language {
  const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  return stored === "en" ? "en" : "tr";
}

export function writeLanguage(language: Language) {
  window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  document.documentElement.lang = language;
  window.dispatchEvent(new Event("terragolds-storage"));
}

/**
 * Site-wide language preference, mirroring the favorite/compare pattern:
 * reads/writes the shared "terragolds-language" localStorage key and
 * "terragolds-storage" event rather than a React context, so every page's
 * header/footer independently stays in sync without a provider wrapping
 * the app. The homepage (home-client.tsx) predates this hook and manages
 * its own identical localStorage key directly - both read the same value.
 */
export function useLanguage(): [Language, (language: Language) => void] {
  // Always starts as "tr" to match the server-rendered markup - the real
  // localStorage value is only applied after mount (below), never during
  // the initial/hydrating render, otherwise a stored "en" preference makes
  // this render diverge from the server output and React throws a
  // hydration-mismatch error (#418).
  const [language, setLanguageState] = useState<Language>("tr");

  useEffect(() => {
    const refresh = () => setLanguageState(readLanguage());
    refresh();
    window.addEventListener("terragolds-storage", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("terragolds-storage", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const setLanguage = (next: Language) => {
    writeLanguage(next);
    setLanguageState(next);
  };

  return [language, setLanguage];
}
