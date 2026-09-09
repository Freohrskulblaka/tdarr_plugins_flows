/*
 * Media Optimizer Subtitle Planning Library
 * Created by: Freohrskulblaka
 * Created on: 2026-06-30
 * Description: Builds subtitle retention, removal, ordering, and default/forced disposition decisions.
 */

const { createLanguageLabel, normalizeLanguageForVariant } = require('../../utils/language');

const SUBTITLE_LANGUAGE_TITLE_LABELS = { eng: 'English', spa: 'Spanish', fre: 'French', fra: 'French', por: 'Portuguese' };
const SUBTITLE_VARIANT_TITLE_LABELS = { LatAm: 'Latin America', ES: 'Spain', MX: 'Mexico', BR: 'Brazil', PT: 'Portugal', US: 'US' };
const PICTURE_FIRST_SUBTITLE_TYPE_RANK = { picture: 0, text: 1, other: 2 };
const TEXT_FIRST_SUBTITLE_TYPE_RANK = { text: 0, picture: 1, other: 2 };
const SUBTITLE_FORMAT_KEY_ALIASES = { hdmv_pgs_subtitle: 'pgs', pgs: 'pgs', srt: 'srt', subrip: 'srt' };

function planSubtitles(context) {
  const embeddedSubtitles = context.analysis.streams.subtitle.items;
  const configuredLanguages = context.settings.languageOrder.subtitle.map(normalizeLanguageForVariant);
  const originalLanguage = normalizeLanguageForVariant(context.analysis.originalLanguage?.language || '');
  const desiredLanguages = [...configuredLanguages, ...(context.settings.subtitle.includeOriginalLanguage ? [originalLanguage] : [])];
  const languageOrder = Array.from(new Set(desiredLanguages.filter(Boolean)));
  const preserveExistingTitles = Boolean(context.analysis.streams.subtitle.preserveExistingTitles);
  const embeddedTracks = embeddedSubtitles.map((subtitle) => createSubtitleTrack(subtitle, preserveExistingTitles));
  const externalDiscovery = discoverExternalSubtitleImports(context, embeddedTracks, languageOrder, preserveExistingTitles);
  const externalTracks = externalDiscovery.imports;
  const candidateTracks = [...embeddedTracks, ...externalTracks];
  const keptTracks = selectSubtitleTracks(candidateTracks, context, languageOrder);
  const removedTracks = candidateTracks.filter((track) => track.action === 'remove');
  const outputTracks = assignSubtitleOutputIndexes(orderSubtitleTracks(keptTracks, context, languageOrder));
  const externalImports = outputTracks.filter((track) => track.sourceKind === 'external' && track.action === 'import');
  const reasons = [...outputTracks, ...removedTracks].flatMap((track) => track.reasons);
  const shouldProcess = shouldProcessSubtitles(embeddedTracks, outputTracks, removedTracks, externalImports);

  return {
    languageOrder,
    tracks: outputTracks,
    removedTracks,
    externalImports,
    matchedExternalSubtitles: externalDiscovery.matchedExternalSubtitles,
    reasons,
    shouldProcess,
  };
}

function createSubtitleTrack(subtitleAnalysis, preserveExistingTitles, sourceOrderOverride) {
  const isExternal = subtitleAnalysis.sourceKind === 'external';
  const title = subtitleAnalysis.title;
  const desiredForced = isExternal ? subtitleAnalysis.titleIndicatesForced : subtitleAnalysis.currentForced || subtitleAnalysis.titleIndicatesForced;
  const desiredTitle = createSubtitleTitle(subtitleAnalysis, preserveExistingTitles, desiredForced);
  const track = {
    sourceKind: subtitleAnalysis.sourceKind,
    sourceIndex: subtitleAnalysis.sourceIndex,
    sourcePath: subtitleAnalysis.sourcePath,
    sourceOrder: sourceOrderOverride ?? subtitleAnalysis.sourceOrder,
    fileName: subtitleAnalysis.fileName,
    outputIndex: null,
    codec: subtitleAnalysis.codec,
    formatLabel: subtitleAnalysis.formatLabel,
    inputFormat: subtitleAnalysis.inputFormat,
    textEncoding: subtitleAnalysis.textEncoding,
    language: subtitleAnalysis.language,
    languageVariant: subtitleAnalysis.languageVariant,
    languageLabel: subtitleAnalysis.languageLabel || createLanguageLabel(subtitleAnalysis.language, subtitleAnalysis.languageVariant),
    subtitleType: subtitleAnalysis.subtitleType,
    title,
    desiredTitle,
    titleNeedsUpdate: title !== desiredTitle,
    action: isExternal ? 'import' : 'copy',
    default: false,
    forced: desiredForced,
    currentDefault: isExternal ? false : subtitleAnalysis.currentDefault,
    currentForced: isExternal ? false : subtitleAnalysis.currentForced,
    titleIndicatesForced: subtitleAnalysis.titleIndicatesForced,
    isCommentary: subtitleAnalysis.isCommentary,
    isEmpty: subtitleAnalysis.isEmpty,
    contentScope: subtitleAnalysis.contentScope,
    accessibility: subtitleAnalysis.accessibility,
    frameCount: subtitleAnalysis.frameCount,
    elementCount: subtitleAnalysis.elementCount,
    streamSize: subtitleAnalysis.streamSize,
    bitRate: subtitleAnalysis.bitRate,
    commentaryReasons: subtitleAnalysis.commentaryReasons,
    reasons: [],
  };

  if (track.isCommentary) {
    const commentaryReasons = track.commentaryReasons || [];
    const reason = commentaryReasons.length === 0
      ? 'Subtitle track appears to be commentary, descriptive, narration, or director commentary.'
      : `Subtitle track appears to be commentary, descriptive, narration, or director commentary (${commentaryReasons.join(', ')}).`;

    track.action = 'remove';
    track.reasons.push(reason);
  }

  return track;
}

function selectSubtitleTracks(candidateTracks, context, languageOrder) {
  const keptTracks = [];

  candidateTracks.forEach((track) => {
    const removalReason = track.action === 'remove' ? '' :
      !languageOrder.includes(track.language) ? `Subtitle language ${track.languageLabel} is outside the target language order.` :
      track.isEmpty ? 'Subtitle track is empty.' :
      context.settings.subtitle.textOnly && track.subtitleType !== 'text' ? 'Subtitle profile is text-only.' : '';

    if (removalReason) {
      track.action = 'remove';
      track.reasons.push(removalReason);
      return;
    }

    keptTracks.push(track);
  });

  return keptTracks;
}

function orderSubtitleTracks(tracks, context, languageOrder) {
  const typeRank = context.settings.subtitle.pictureFirst ? PICTURE_FIRST_SUBTITLE_TYPE_RANK : TEXT_FIRST_SUBTITLE_TYPE_RANK;

  const orderedTracks = tracks.sort((left, right) => {
    const compare = [
      normalizeRank(languageOrder.indexOf(left.language)) - normalizeRank(languageOrder.indexOf(right.language)),
      typeRank[left.subtitleType] - typeRank[right.subtitleType],
      getSubtitleContentScopeRank(left) - getSubtitleContentScopeRank(right),
      getSubtitleContentCount(right) - getSubtitleContentCount(left),
    ].find((value) => value !== 0);

    return compare || left.sourceOrder - right.sourceOrder;
  });

  return orderedTracks;
}

function assignSubtitleOutputIndexes(tracks) {
  const outputTracks = tracks.map((track, index) => {
    const defaultReason = index === 0 && !track.currentDefault ? 'Subtitle track will be set as the default subtitle track.' :  index > 0 && track.currentDefault ? 'Subtitle default flag will be disabled.' : '';
    const forcedReason = track.forced && !track.currentForced ? 'Subtitle forced flag will be enabled.' : !track.forced && track.currentForced ? 'Subtitle forced flag will be disabled.' : '';

    const reasons = [
      ...track.reasons,
      track.action === 'import' ? `External subtitle file "${track.fileName}" will be imported.` : '',
      track.titleNeedsUpdate ? `Subtitle title will be standardized to "${track.desiredTitle}".` : '',
      defaultReason,
      forcedReason,
    ].filter(Boolean);

    return Object.assign({}, track, {
      outputIndex: index,
      title: track.desiredTitle,
      default: index === 0,
      forced: track.forced,
      reasons,
    });
  });

  return outputTracks;
}

function discoverExternalSubtitleImports(context, embeddedSubtitleTracks, languageOrder, preserveExistingTitles) {
  const discovery = {imports: [], matchedExternalSubtitles: []};
  const shouldImport = context.settings.subtitle.importExternalSubtitles;

  if (!shouldImport) {
    return discovery;
  }

  const externalSubtitles = context.analysis.externalSubtitles?.items || [];

  externalSubtitles.forEach((externalSubtitle) => {
    const plannedExternalSubtitle = planExternalSubtitleDiscovery({
      externalSubtitle,
      embeddedSubtitleTracks,
      existingImportCount: discovery.imports.length,
      languageOrder,
      preserveExistingTitles,
    });

    if (!plannedExternalSubtitle) {
      return;
    }

    if (plannedExternalSubtitle.type === 'matched') {
      discovery.matchedExternalSubtitles.push(plannedExternalSubtitle.subtitle);
      return;
    }

    discovery.imports.push(plannedExternalSubtitle.subtitle);
  });

  return discovery;
}

function planExternalSubtitleDiscovery({externalSubtitle, embeddedSubtitleTracks, existingImportCount, languageOrder, preserveExistingTitles}) {
  if (!languageOrder.includes(externalSubtitle.language)) {
    return null;
  }

  const embeddedMatch = embeddedSubtitleTracks.find((track) => {
    const sameLanguage = track.language === externalSubtitle.language;
    const sameVariant = (track.languageVariant || '') === (externalSubtitle.languageVariant || '');
    const usableSubtitle = !track.isEmpty && !track.isCommentary;
    const compatibleFormat = subtitleFormatsAreCompatible(track, externalSubtitle);
    const sameSubtitle = subtitleIdentityMatches(track, externalSubtitle, preserveExistingTitles);

    return sameLanguage && sameVariant && usableSubtitle && compatibleFormat && sameSubtitle;
  });

  if (embeddedMatch) {
    return {
      type: 'matched',
      subtitle: createMatchedExternalSubtitle(externalSubtitle, embeddedMatch),
    };
  }

  const sourceOrder = embeddedSubtitleTracks.length + existingImportCount;
  return {
    type: 'import',
    subtitle: createSubtitleTrack(externalSubtitle, preserveExistingTitles, sourceOrder),
  };
}

function subtitleFormatsAreCompatible(embeddedSubtitle, externalSubtitle) {
  const getSubtitleFormatKey = (subtitle) => {
    const codec = String(subtitle.codec || '').toLowerCase();
    const format = String(subtitle.formatLabel || '').toLowerCase();
    const formatKey = SUBTITLE_FORMAT_KEY_ALIASES[codec] || SUBTITLE_FORMAT_KEY_ALIASES[format] || codec || format || 'unknown';
    return formatKey;
  };

  if (embeddedSubtitle.subtitleType !== externalSubtitle.subtitleType) {
    return false;
  }

  const embeddedFormat = getSubtitleFormatKey(embeddedSubtitle);
  const externalFormat = getSubtitleFormatKey(externalSubtitle);

  return embeddedFormat === externalFormat;
}

function subtitleIdentityMatches(embeddedSubtitle, externalSubtitle, preserveExistingTitles) {
  if (subtitleMetricsMatch(embeddedSubtitle, externalSubtitle)) {
    return true;
  }

  if (subtitleCountMetricsConflict(embeddedSubtitle, externalSubtitle)) {
    return false;
  }

  const desiredExternalTitle = createSubtitleTitle(externalSubtitle, preserveExistingTitles, externalSubtitle.titleIndicatesForced);
  const embeddedTitle = normalizeSubtitleIdentityText(embeddedSubtitle.title);
  const externalTitle = normalizeSubtitleIdentityText(desiredExternalTitle);

  return Boolean(embeddedTitle && externalTitle && embeddedTitle === externalTitle)
    || !hasComparableSubtitleMetrics(embeddedSubtitle, externalSubtitle);
}

function subtitleMetricsMatch(embeddedSubtitle, externalSubtitle) {
  const metricPairs = getSubtitleMetricPairs(embeddedSubtitle, externalSubtitle);

  return metricPairs.some(([embeddedMetric, externalMetric]) => {
    const bothMetricsExist = hasSubtitleMetric(embeddedMetric) && hasSubtitleMetric(externalMetric);
    const metricsMatch = Number(embeddedMetric) === Number(externalMetric);

    return bothMetricsExist && metricsMatch;
  });
}

function subtitleCountMetricsConflict(embeddedSubtitle, externalSubtitle) {
  const metricPairs = getSubtitleCountMetricPairs(embeddedSubtitle, externalSubtitle);

  return metricPairs.some(([embeddedMetric, externalMetric]) => {
    const bothMetricsExist = hasSubtitleMetric(embeddedMetric) && hasSubtitleMetric(externalMetric);
    const metricsConflict = Number(embeddedMetric) !== Number(externalMetric);

    return bothMetricsExist && metricsConflict;
  });
}

function getSubtitleMetricPairs(embeddedSubtitle, externalSubtitle) {
  return [
    [embeddedSubtitle.frameCount, externalSubtitle.frameCount],
    [embeddedSubtitle.elementCount, externalSubtitle.elementCount],
    [embeddedSubtitle.streamSize, externalSubtitle.streamSize],
  ];
}

function hasComparableSubtitleMetrics(embeddedSubtitle, externalSubtitle) {
  return getSubtitleMetricPairs(embeddedSubtitle, externalSubtitle)
    .some(([embeddedMetric, externalMetric]) => hasSubtitleMetric(embeddedMetric) || hasSubtitleMetric(externalMetric));
}

function getSubtitleCountMetricPairs(embeddedSubtitle, externalSubtitle) {
  return [
    [embeddedSubtitle.frameCount, externalSubtitle.frameCount],
    [embeddedSubtitle.elementCount, externalSubtitle.elementCount],
  ];
}

function hasSubtitleMetric(value) {
  return value !== undefined && value !== null && value !== '';
}

function normalizeSubtitleIdentityText(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function createMatchedExternalSubtitle(externalSubtitle, embeddedMatch) {
  return {
    sourcePath: externalSubtitle.sourcePath,
    fileName: externalSubtitle.fileName,
    language: externalSubtitle.language,
    languageVariant: externalSubtitle.languageVariant,
    matchedSourceIndex: embeddedMatch.sourceIndex,
    matchedTitle: embeddedMatch.title,
  };
}

function shouldProcessSubtitles(embeddedTracks, outputTracks, removedTracks, externalImports) {
  const hasRemovedTracks = removedTracks.some((track) => track.sourceKind === 'embedded');
  const hasExternalImports = externalImports.length > 0;
  const keptEmbeddedTracks = outputTracks.filter((track) => track.sourceKind === 'embedded');
  const keptEmbeddedSourceOrder = keptEmbeddedTracks
    .map((track) => track.sourceOrder)
    .sort((left, right) => left - right);
  const hasEmbeddedOrderChanges = keptEmbeddedTracks.some((track, index) => {
    return track.sourceOrder !== keptEmbeddedSourceOrder[index];
  });

  return hasRemovedTracks || hasExternalImports || hasEmbeddedOrderChanges;
}

function normalizeRank(rank) {
  return rank === -1 ? 999 : rank;
}

function getSubtitleContentScopeRank(track) {
  const ranks = {
    full: 0,
    unknown: 1,
    sparse: 2,
    empty: 3,
  };

  return ranks[track.contentScope] ?? ranks.unknown;
}

function getSubtitleContentCount(track) {
  return Math.max(track.frameCount || 0, track.elementCount || 0);
}

function createSubtitleTitle(track, preserveExistingTitle, forced) {
  const existingTitle = String(track.title || '').trim();

  if (preserveExistingTitle && existingTitle) {
    return existingTitle;
  }

  const baseLanguage = SUBTITLE_LANGUAGE_TITLE_LABELS[track.language] || track.languageLabel || track.language || 'und';
  const variantText = String(track.languageVariant || '');
  const variant = variantText.includes('-') ? variantText.split('-').slice(1).join('-') : variantText;
  const variantLabel = SUBTITLE_VARIANT_TITLE_LABELS[variant] || variant;
  const languageTitle = [baseLanguage, variantLabel].filter(Boolean).join(' ');
  const accessibility = String(track.accessibility || '').trim();
  const titleParts = [languageTitle];

  if (accessibility && accessibility !== 'regular') {
    titleParts.push(accessibility);
  }

  if (forced) {
    titleParts.push('Forced');
  } else if (track.contentScope === 'sparse') {
    titleParts.push('Partial');
  }

  titleParts.push(track.formatLabel || track.codec || 'unknown');

  return titleParts.filter(Boolean).join(' - ');
}

module.exports = {
  planSubtitles,
};
