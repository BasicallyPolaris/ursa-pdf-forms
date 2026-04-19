import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";
import { setErrorBoundaryLabels } from "@/components/ui/error-boundary";
import de from "./de.json";
import en from "./en.json";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      de: { translation: de },
    },
    fallbackLng: "en",
    supportedLngs: ["en", "de"],
    partialBundledLanguages: true,
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: "i18nextLng",
    },
  });

function syncErrorBoundaryLabels() {
  setErrorBoundaryLabels({
    errorMessage: i18n.t("errorBoundary.message"),
    retry: i18n.t("errorBoundary.retry"),
  });
}

syncErrorBoundaryLabels();
i18n.on("languageChanged", syncErrorBoundaryLabels);

export default i18n;
