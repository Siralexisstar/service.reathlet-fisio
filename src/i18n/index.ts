import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'
import enGB from './locales/en-GB.json'
import esES from './locales/es-ES.json'
import caES from './locales/ca-ES.json'

export const supportedLanguages = ['ca-ES', 'fr-CH', 'fr-FR', 'fr-LU', 'es-ES', 'it-IT', 'nl-NL', 'nl-BE', 'de-DE', 'fr-BE', 'de-CH', 'en-GB', 'hu-HU', 'it-CH', 'pl-PL', 'de-AT', 'tr-TR'] as const

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { 'en-GB': { translation: enGB }, 'es-ES': { translation: esES }, 'ca-ES': { translation: caES } },
    supportedLngs: supportedLanguages,
    fallbackLng: 'es-ES',
    load: 'currentOnly',
    detection: { order: ['navigator'], caches: [] },
    interpolation: { escapeValue: false },
    returnNull: false,
  })

i18n.on('languageChanged', language => { document.documentElement.lang = language })

export default i18n
