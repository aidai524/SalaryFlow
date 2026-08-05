import { createContext, useContext } from "react";
import type { ReactNode } from "react";

export type Language = "en" | "zh";

interface LanguageContextValue {
  language: Language;
  text: (english: string, chinese: string) => string;
}

const LanguageContext = createContext<LanguageContextValue>({
  language: "en",
  text: (english) => english,
});

export function LanguageProvider({ language, children }: { language: Language; children: ReactNode }) {
  return (
    <LanguageContext.Provider value={{ language, text: (english, chinese) => language === "zh" ? chinese : english }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}

export function localized(language: Language, english: string, chinese: string) {
  return language === "zh" ? chinese : english;
}
