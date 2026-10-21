/** Locale negotiation is pure so it can be checked without a browser. */
export const SUPPORTED_LANGUAGES = Object.freeze(['fr', 'en']);
export const DEFAULT_LANGUAGE = 'en';
export const LANGUAGE_STORAGE_KEY = 'presence-language';

export function normalizeLanguage(value) {
  if (typeof value !== 'string') return null;
  const base = value.trim().toLowerCase().split(/[-_]/)[0];
  return SUPPORTED_LANGUAGES.includes(base) ? base : null;
}

export function resolveLanguage(savedLanguage, preferredLanguages = []) {
  const saved = normalizeLanguage(savedLanguage);
  if (saved) return saved;
  for (const preference of preferredLanguages) {
    const language = normalizeLanguage(preference);
    if (language) return language;
  }
  return DEFAULT_LANGUAGE;
}

export function readLanguage(storage) {
  try {
    return storage?.getItem(LANGUAGE_STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
}

export function rememberLanguage(storage, language) {
  if (!SUPPORTED_LANGUAGES.includes(language)) return false;
  try {
    storage?.setItem(LANGUAGE_STORAGE_KEY, language);
    return Boolean(storage);
  } catch {
    return false;
  }
}
