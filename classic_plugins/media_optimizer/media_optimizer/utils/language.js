/*
 * Media Optimizer Language Utility Library
 * Created by: Freohrskulblaka
 * Created on: 2026-07-10
 * Description: Normalizes language values, detects language variants, and builds language labels.
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

const LANGUAGE_ALIASES = Object.fromEntries([
  ['eng', 'en', 'english'],
  ['fre', 'fr', 'fra', 'french'],
  ['spa', 'es', 'spanish', 'spanish (latino)'],
  ['ger', 'de', 'deu', 'german'],
  ['ita', 'it', 'italian'],
  ['dan', 'da', 'danish'],
  ['dut', 'nl', 'nld', 'dutch', 'flemish'],
  ['jpn', 'ja', 'japanese'],
  ['ice', 'is', 'isl', 'icelandic'],
  ['chi', 'zh', 'zho', 'chinese'],
  ['rus', 'ru', 'russian'],
  ['pol', 'pl', 'polish'],
  ['vie', 'vi', 'vietnamese'],
  ['swe', 'sv', 'swedish'],
  ['nor', 'no', 'norwegian'],
  ['nob', 'nb', 'norwegian bokmal'],
  ['fin', 'fi', 'finnish'],
  ['tur', 'tr', 'turkish'],
  ['por', 'pt', 'portuguese', 'portuguese (brazil)'],
  ['gre', 'el', 'ell', 'greek'],
  ['kor', 'ko', 'korean'],
  ['hun', 'hu', 'hungarian'],
  ['heb', 'he', 'hebrew'],
  ['lit', 'lt', 'lithuanian'],
  ['cze', 'cs', 'ces', 'czech'],
  ['hin', 'hi', 'hindi'],
  ['rum', 'ro', 'ron', 'romanian'],
  ['tha', 'th', 'thai'],
  ['bul', 'bg', 'bulgarian'],
  ['ara', 'ar', 'arabic'],
  ['ukr', 'uk', 'ukrainian'],
  ['per', 'fa', 'fas', 'persian'],
  ['ben', 'bn', 'bengali'],
  ['slo', 'sk', 'slk', 'slovak'],
  ['lav', 'lv', 'latvian'],
  ['cat', 'ca', 'catalan'],
  ['hrv', 'hr', 'croatian'],
  ['srp', 'sr', 'serbian'],
  ['bos', 'bs', 'bosnian'],
  ['est', 'et', 'estonian'],
  ['tam', 'ta', 'tamil'],
  ['ind', 'id', 'indonesian'],
  ['tel', 'te', 'telugu'],
  ['mac', 'mk', 'mkd', 'macedonian'],
  ['slv', 'sl', 'slovenian'],
  ['mal', 'ml', 'malayalam'],
  ['kan', 'kn', 'kannada'],
  ['alb', 'sq', 'sqi', 'albanian'],
  ['afr', 'af', 'afrikaans'],
  ['mar', 'mr', 'marathi'],
  ['tgl', 'tl', 'tagalog'],
  ['urd', 'ur', 'urdu'],
  ['roh', 'rm', 'romansh'],
  ['mon', 'mn', 'mongolian'],
  ['geo', 'ka', 'kat', 'georgian'],
].flatMap(([canonical, ...aliases]) => {
  return [canonical, ...aliases].map((alias) => [alias, canonical]);
}));

function detectLanguageVariant(language, languageCodes = [], titleValues = []) {
  const normalizedLanguage = normalizeLanguageForVariant(language);
  const variantRules = LANGUAGE_VARIANT_RULES[normalizedLanguage] || [];

  if (variantRules.length === 0) {
    return '';
  }

  const normalizedSourceText = normalizeVariantText([...languageCodes, ...titleValues].join(' '))
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  const paddedSourceText = ` ${normalizedSourceText} `;
  const matchingRule = variantRules.find((rule) => {
    return rule.codes.some((code) => {
      const codeWords = code.replace(/[^a-z0-9]+/g, ' ');
      return paddedSourceText.includes(` ${codeWords} `);
    })
      || rule.patterns.some((pattern) => pattern.test(normalizedSourceText));
  });

  return matchingRule?.variant || '';
}

function createLanguageLabel(language, languageVariant) {
  const normalizedLanguage = normalizeLanguageForVariant(language);

  if (languageVariant) {
    return `${normalizedLanguage}-${languageVariant}`;
  }

  return normalizedLanguage;
}

function normalizeLanguageForVariant(language) {
  const normalizedLanguage = normalizeVariantText(language).trim().replace(/_/g, '-');
  const baseLanguage = normalizedLanguage.split('-')[0];
  const canonicalLanguage = LANGUAGE_ALIASES[normalizedLanguage]
    || LANGUAGE_ALIASES[baseLanguage]
    || (/^[a-z]{3}$/.test(baseLanguage) ? baseLanguage : 'und');

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
