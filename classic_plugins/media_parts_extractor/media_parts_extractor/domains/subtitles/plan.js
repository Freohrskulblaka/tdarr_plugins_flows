/*
 * Media Parts Extractor Subtitle Plan Library
 * Created by: Freohrskulblaka
 * Created on: 2026-09-18
 * Description: Selects donor subtitle tracks by type and language.
 */

const { buildSubtitleOutputPath } = require('./naming');
const { getSubtitleAnalysis } = require('./analyze');

function planSubtitles(context) {
  const mode = context.settings.subtitle.mode;
  const languages = context.settings.languageOrder.subtitle;
  const items = context.analysis.streams.subtitle.items
    .filter((stream) => shouldExtractSubtitle(stream, mode, languages))
    .map((stream) => {
      const subtitle = getSubtitleAnalysis(stream);

      return {
        sourceIndex: subtitle.sourceIndex,
        language: subtitle.language,
        languageVariant: subtitle.languageVariant,
        codec: subtitle.codec,
        subtitleType: subtitle.subtitleType,
        currentForced: subtitle.currentForced,
        accessibility: subtitle.accessibility,
        title: subtitle.title,
        outputPath: buildSubtitleOutputPath(context, stream),
      };
    });
  const reasons = [];

  if (mode === 'None') {
    reasons.push('Subtitle extraction disabled by input.');
  } else if (items.length === 0) {
    reasons.push('No subtitle streams matched the extraction inputs.');
  }

  return {
    mode,
    items,
    count: items.length,
    reasons,
  };
}

function shouldExtractSubtitle(stream, mode, languages) {
  const subtitle = getSubtitleAnalysis(stream);

  if (mode === 'None') {
    return false;
  }

  if (mode === 'Text Only') {
    return subtitle.subtitleType === 'text';
  }

  if (mode === 'Picture Only') {
    return subtitle.subtitleType === 'picture';
  }

  if (mode === 'Preferred Languages') {
    return languages.includes(subtitle.language);
  }

  return true;
}

module.exports = { planSubtitles };
