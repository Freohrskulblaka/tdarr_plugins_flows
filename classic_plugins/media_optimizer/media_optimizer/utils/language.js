/*
 * Media Optimizer Language Utility Library
 * Created by: Freohrskulblaka
 * Created on: 2026-07-10
 * Description: Normalizes language values, detects language variants, and builds language labels.
 * Updates:
 * - 2026-07-10 - Freohrskulblaka: Added table-driven language variant rules.
 */

const LANGUAGE_VARIANT_RULES = {
  eng: [
    { variant: 'US', codes: ['en-us', 'eng-us'], patterns: [/american english|united states english|english \(us\)|english us/] },
    { variant: 'GB', codes: ['en-gb', 'eng-gb', 'en-uk', 'eng-uk'], patterns: [/british english|uk english|english \(uk\)|english \(gb\)|english gb/] },
  ],
  fre: [
    { variant: 'CA', codes: ['fr-ca', 'fre-ca', 'fra-ca'], patterns: [/canadian french|french canada|francais canada|quebec|quebecois/] },
    { variant: 'FR', codes: ['fr-fr', 'fre-fr', 'fra-fr'], patterns: [/france french|french france|francais france|parisian/] },
  ],
  por: [
    { variant: 'BR', codes: ['pt-br', 'por-br'], patterns: [/portugues brasil|portuguese brazil|brazilian portuguese|brasil|brazil/] },
    { variant: 'PT', codes: ['pt-pt', 'por-pt'], patterns: [/portugues portugal|portuguese portugal|european portuguese|portugal/] },
  ],
  spa: [
    { variant: 'LatAm', codes: ['es-419', 'spa-419', 'es-latam', 'spa-latam', 'es-latinoamerica', 'spa-latinoamerica'], patterns: [/spa[-_ ]?latam|es[-_ ]?419|latinoamerica|latin america|latam|latino/] },
    { variant: 'MX', codes: ['es-mx', 'spa-mx', 'es-mex', 'spa-mex'], patterns: [/spa[-_ ]?mx|es[-_ ]?mx|mexico|mexican/] },
    { variant: 'ES', codes: ['es-es', 'spa-es'], patterns: [/spa[-_ ]?es|es[-_ ]?es|espana|spain|castilian|castellano/] },
  ],
};

function detectLanguageVariant(language, languageCodes, titleValues) {
  const normalizedLanguage = normalizeLanguageForVariant(language);
  const variantRules = LANGUAGE_VARIANT_RULES[normalizedLanguage] || [];

  if (variantRules.length === 0) {
    return '';
  }

  const normalizedLanguageCodes = languageCodes.map(normalizeVariantText);
  const normalizedTitle = normalizeVariantText(titleValues.join(' '));
  const codeMatch = variantRules.find((rule) => {
    return rule.codes.some((code) => normalizedLanguageCodes.includes(code));
  });

  if (codeMatch) {
    return codeMatch.variant;
  }

  const titleMatch = variantRules.find((rule) => {
    return rule.patterns.some((pattern) => pattern.test(normalizedTitle));
  });

  return titleMatch?.variant || '';
}

function createLanguageLabel(language, languageVariant) {
  const normalizedLanguage = normalizeLanguageForVariant(language);

  if (languageVariant) {
    return `${normalizedLanguage}-${languageVariant}`;
  }

  return normalizedLanguage;
}

function normalizeLanguageForVariant(language) {
  const normalizedLanguage = String(language || 'und').trim().toLowerCase();
  const languageAliases = {
    en: 'eng',
    es: 'spa',
    fr: 'fre',
    fra: 'fre',
    pt: 'por',
  };
  const canonicalLanguage = languageAliases[normalizedLanguage] || normalizedLanguage || 'und';

  return canonicalLanguage;
}

function normalizeVariantText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

module.exports = {
  createLanguageLabel,
  detectLanguageVariant,
  normalizeLanguageForVariant,
  normalizeVariantText,
};
