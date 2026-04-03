import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import nb from './nb.json';
import en from './en.json';

const deviceLang = getLocales()[0]?.languageCode ?? 'nb';
const isNorwegian = ['nb', 'nn', 'no'].includes(deviceLang);

// Also check navigator.language on web for better detection
const webLang = typeof navigator !== 'undefined' ? navigator.language?.slice(0, 2) : '';
const isWebNorwegian = ['nb', 'nn', 'no'].includes(webLang);

i18n.use(initReactI18next).init({
  resources: {
    nb: { translation: nb },
    en: { translation: en },
  },
  lng: (isNorwegian || isWebNorwegian) ? 'nb' : 'en',
  fallbackLng: 'nb',
  interpolation: { escapeValue: false },
});

export default i18n;
