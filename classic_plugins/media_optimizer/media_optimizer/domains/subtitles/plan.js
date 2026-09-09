/*
 * Media Optimizer Subtitle Planning Library
 * Created by: Freohrskulblaka
 * Created on: 2026-06-30
 * Description: Builds subtitle retention, removal, ordering, and default/forced disposition decisions.
 */

const { normalizeLanguageForVariant } = require('../../utils/language');

const SUBTITLE_LANGUAGE_TITLE_LABELS = { eng: 'English', spa: 'Spanish', fre: 'French', fra: 'French', por: 'Portuguese' };
const SUBTITLE_VARIANT_TITLE_LABELS = { LatAm: 'Latin America', ES: 'Spain', MX: 'Mexico', BR: 'Brazil', PT: 'Portugal', US: 'US' };
const PICTURE_FIRST_SUBTITLE_TYPE_RANK = { picture: 0, text: 1, other: 2 };
const TEXT_FIRST_SUBTITLE_TYPE_RANK = { text: 0, picture: 1, other: 2 };
const SUBTITLE_CONTENT_SCOPE_RANK = { full: 0, unknown: 1, sparse: 2, empty: 3 };

function planSubtitles(context) {
  const embeddedSubtitles = context.analysis.streams.subtitle.items;
  const configuredLanguages = context.settings.languageOrder.subtitle.map(normalizeLanguageForVariant);
  const originalLanguage = normalizeLanguageForVariant(context.analysis.originalLanguage?.language || '');
  const desiredLanguages = [...configuredLanguages, ...(context.settings.subtitle.includeOriginalLanguage ? [originalLanguage] : [])];
  const languageOrder = Array.from(new Set(desiredLanguages.filter(Boolean)));
  const embeddedTracks = embeddedSubtitles.map((subtitle) => createSubtitleTrack(subtitle));
  const externalDiscovery = discoverExternalSubtitleImports(context, embeddedTracks, languageOrder);
  const candidateTracks = [...embeddedTracks, ...externalDiscovery.imports];
  const keptTracks = selectSubtitleTracks(candidateTracks, context, languageOrder);
  const removedTracks = candidateTracks.filter((track) => track.action === 'remove');
  const outputTracks = assignSubtitleOutputIndexes(orderSubtitleTracks(keptTracks, context, languageOrder));
  const externalImports = outputTracks.filter((track) => track.sourceKind === 'external' && track.action === 'import');
  const reasons = [...outputTracks, ...removedTracks].flatMap((track) => track.reasons);
  const keptEmbeddedSourceOrder = outputTracks
    .filter((track) => track.sourceKind === 'embedded')
    .map((track) => track.sourceOrder);
  const hasEmbeddedOrderChanges = keptEmbeddedSourceOrder.some((sourceOrder, index) => {
    return index > 0 && sourceOrder < keptEmbeddedSourceOrder[index - 1];
  });
  const shouldProcess = removedTracks.some((track) => track.sourceKind === 'embedded')
    || externalImports.length > 0
    || hasEmbeddedOrderChanges;

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

function createSubtitleTrack(subtitleAnalysis, sourceOrderOverride) {
  const isExternal = subtitleAnalysis.sourceKind === 'external';
  const title = subtitleAnalysis.title;
  const desiredForced = isExternal ? subtitleAnalysis.titleIndicatesForced : subtitleAnalysis.currentForced || subtitleAnalysis.titleIndicatesForced;
  const desiredTitle = createSubtitleTitle(subtitleAnalysis, desiredForced);
  const track = {
    ...subtitleAnalysis,
    sourceOrder: sourceOrderOverride ?? subtitleAnalysis.sourceOrder,
    outputIndex: null,
    desiredTitle,
    titleNeedsUpdate: title !== desiredTitle,
    action: isExternal ? 'import' : 'copy',
    default: false,
    forced: desiredForced,
    currentDefault: isExternal ? false : subtitleAnalysis.currentDefault,
    currentForced: isExternal ? false : subtitleAnalysis.currentForced,
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

  return [...tracks].sort((left, right) => {
    const leftContentCount = Math.max(left.frameCount || 0, left.elementCount || 0);
    const rightContentCount = Math.max(right.frameCount || 0, right.elementCount || 0);
    const compare = [
      languageOrder.indexOf(left.language) - languageOrder.indexOf(right.language),
      typeRank[left.subtitleType] - typeRank[right.subtitleType],
      (SUBTITLE_CONTENT_SCOPE_RANK[left.contentScope] ?? SUBTITLE_CONTENT_SCOPE_RANK.unknown)
        - (SUBTITLE_CONTENT_SCOPE_RANK[right.contentScope] ?? SUBTITLE_CONTENT_SCOPE_RANK.unknown),
      rightContentCount - leftContentCount,
    ].find((value) => value !== 0);

    return compare || left.sourceOrder - right.sourceOrder;
  });
}

function assignSubtitleOutputIndexes(tracks) {
  return tracks.map((track, index) => {
    const defaultReason = index === 0 && !track.currentDefault ? 'Subtitle track will be set as the default subtitle track.' : index > 0 && track.currentDefault ? 'Subtitle default flag will be disabled.' : '';
    const forcedReason = track.forced && !track.currentForced ? 'Subtitle forced flag will be enabled.' : !track.forced && track.currentForced ? 'Subtitle forced flag will be disabled.' : '';

    const reasons = [
      ...track.reasons,
      track.action === 'import' ? `External subtitle file "${track.fileName}" will be imported.` : '',
      track.titleNeedsUpdate ? `Subtitle title will be standardized to "${track.desiredTitle}".` : '',
      defaultReason,
      forcedReason,
    ].filter(Boolean);

    return {
      ...track,
      outputIndex: index,
      title: track.desiredTitle,
      default: index === 0,
      reasons,
    };
  });
}

function discoverExternalSubtitleImports(context, embeddedSubtitleTracks, languageOrder) {
  const discovery = {imports: [], matchedExternalSubtitles: []};

  if (!context.settings.subtitle.importExternalSubtitles) {
    return discovery;
  }

  const externalSubtitles = context.analysis.externalSubtitles?.items || [];

  externalSubtitles.forEach((externalSubtitle) => {
    if (!languageOrder.includes(externalSubtitle.language)) {
      return;
    }

    const sourceOrder = embeddedSubtitleTracks.length + discovery.imports.length;
    const externalTrack = createSubtitleTrack(externalSubtitle, sourceOrder);
    const externalTitle = String(externalTrack.desiredTitle || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const embeddedMatch = embeddedSubtitleTracks.find((track) => {
      const sameLanguage = track.language === externalTrack.language;
      const sameVariant = (track.languageVariant || '') === (externalTrack.languageVariant || '');
      const usableSubtitle = !track.isEmpty && !track.isCommentary;
      const compatibleFormat = track.subtitleType === externalTrack.subtitleType && track.formatKey === externalTrack.formatKey;

      if (!sameLanguage || !sameVariant || !usableSubtitle || !compatibleFormat) {
        return false;
      }

      const metrics = compareSubtitleMetrics(track, externalTrack);

      if (metrics.hasCountConflict) {
        return false;
      }

      if (metrics.hasMatchingMetric) {
        return true;
      }

      const embeddedTitle = String(track.title || '').trim().toLowerCase().replace(/\s+/g, ' ');
      const sameTitle = Boolean(embeddedTitle && externalTitle && embeddedTitle === externalTitle);

      return sameTitle || !metrics.hasComparableMetric;
    });

    if (embeddedMatch) {
      discovery.matchedExternalSubtitles.push({
        sourcePath: externalSubtitle.sourcePath,
        fileName: externalSubtitle.fileName,
        language: externalSubtitle.language,
        languageVariant: externalSubtitle.languageVariant,
        matchedSourceIndex: embeddedMatch.sourceIndex,
        matchedTitle: embeddedMatch.title,
      });
      return;
    }

    discovery.imports.push(externalTrack);
  });

  return discovery;
}

function compareSubtitleMetrics(embeddedSubtitle, externalSubtitle) {
  const metrics = [
    {embedded: embeddedSubtitle.frameCount, external: externalSubtitle.frameCount, detectsConflict: true},
    {embedded: embeddedSubtitle.elementCount, external: externalSubtitle.elementCount, detectsConflict: true},
    {embedded: embeddedSubtitle.streamSize, external: externalSubtitle.streamSize, detectsConflict: false},
  ];
  const comparison = {
    hasMatchingMetric: false,
    hasCountConflict: false,
    hasComparableMetric: false,
  };

  metrics.forEach((metric) => {
    const embeddedExists = metric.embedded !== undefined && metric.embedded !== null && metric.embedded !== '';
    const externalExists = metric.external !== undefined && metric.external !== null && metric.external !== '';
    const bothExist = embeddedExists && externalExists;
    const valuesMatch = bothExist && Number(metric.embedded) === Number(metric.external);

    comparison.hasComparableMetric ||= bothExist;
    comparison.hasMatchingMetric ||= valuesMatch;
    comparison.hasCountConflict ||= metric.detectsConflict && bothExist && !valuesMatch;
  });

  return comparison;
}

function createSubtitleTitle(track, forced) {
  const existingTitle = String(track.title || '');

  if (existingTitle.trim()) {
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
