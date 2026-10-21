import en from './locales/en.json' with { type: 'json' };
import fr from './locales/fr.json' with { type: 'json' };
import {
  DEFAULT_LANGUAGE,
  SUPPORTED_LANGUAGES,
  readLanguage,
  rememberLanguage,
  resolveLanguage,
} from './language.js';

export const messages = Object.freeze({ en, fr });
let language = DEFAULT_LANGUAGE;
const listeners = new Set();
let storage;
let savedLanguage = null;

export function getLanguage() {
  return language;
}

export function t(key, values = {}) {
  const message = messages[language][key] ?? messages.en[key];
  if (message === undefined) throw new Error(`Missing translation: ${key}`);
  return message.replace(/\{(\w+)\}/g, (match, name) => values[name] ?? match);
}

export function onLanguageChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function translateDocument() {
  document.documentElement.lang = language;
  document.querySelectorAll('[data-i18n]').forEach((node) => {
    node.textContent = t(node.dataset.i18n);
  });
  // HTML comes exclusively from the two bundled, reviewed catalogs. Never interpolate user input here.
  document.querySelectorAll('[data-i18n-html]').forEach((node) => {
    node.innerHTML = t(node.dataset.i18nHtml);
  });
  for (const attribute of ['aria-label', 'content']) {
    document.querySelectorAll(`[data-i18n-${attribute}]`).forEach((node) => {
      node.setAttribute(attribute, t(node.getAttribute(`data-i18n-${attribute}`)));
    });
  }
  document.querySelectorAll('[data-language]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.language === language));
  });
}

export function setLanguage(next, { persist = true, announce = true } = {}) {
  if (!SUPPORTED_LANGUAGES.includes(next)) return;
  if (persist) {
    savedLanguage = next;
    rememberLanguage(storage, next);
  }
  language = next;
  translateDocument();
  for (const listener of listeners) listener(language);
  if (announce) document.querySelector('#language-status').textContent = t('language.changed');
}

export function initializeLanguage() {
  // Access to localStorage itself can throw in restricted/private browser contexts.
  try {
    storage = window.localStorage;
  } catch {
    storage = undefined;
  }
  savedLanguage = readLanguage(storage);
  const preferred = () =>
    navigator.languages?.length ? navigator.languages : [navigator.language];
  setLanguage(resolveLanguage(savedLanguage, preferred()), { persist: false, announce: false });
  document.querySelectorAll('[data-language]').forEach((button) => {
    button.addEventListener('click', () => setLanguage(button.dataset.language));
  });
  window.addEventListener('languagechange', () => {
    setLanguage(resolveLanguage(savedLanguage, preferred()), { persist: false, announce: false });
  });
}
