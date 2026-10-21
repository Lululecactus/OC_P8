import definitions from './projects.json' with { type: 'json' };
import en from '../i18n/locales/projects.en.json' with { type: 'json' };
import fr from '../i18n/locales/projects.fr.json' with { type: 'json' };
import { getLanguage } from '../i18n/index.js';

export const projects = Object.freeze(definitions);
const copy = { en, fr };

export function getProject(index, language = getLanguage()) {
  const definition = projects[index];
  if (!definition) throw new RangeError(`Unknown project index: ${index}`);
  const content = copy[language]?.[definition.id] ?? en[definition.id];
  return {
    ...definition,
    ...content,
    ...(definition.url ? { link: { url: definition.url, label: content.linkLabel } } : {}),
  };
}
