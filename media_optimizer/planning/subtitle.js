/*
 * Media Optimizer Subtitle Planning Library
 * Created by: Freohrskulblaka
 * Created on: 2026-06-30
 * Description: Builds subtitle retention, removal, ordering, and default/forced disposition decisions.
 * Updates:
 * - 2026-06-30 - Freohrskulblaka: Created first-pass subtitle planning helper for language and type profile decisions.
 * - 2026-07-09 - Freohrskulblaka: Added v1 default/forced cleanup, external SRT import planning, and broader commentary detection.
 * - 2026-07-10 - Freohrskulblaka:
 *   - Reused shared commentary text detection helpers.
 *   - Moved embedded subtitle source facts into subtitle analysis.
 * - 2026-07-11 - Freohrskulblaka: Set the first planned subtitle track as the only default subtitle.
 * - 2026-07-13 - Freohrskulblaka:
 *   - Consumed external subtitle source inventory from analysis.
 *   - Ordered fuller subtitle tracks ahead of sparse variants within each language and type.
 *   - Added conservative subtitle title standardization while preserving anime subtitle titles.
 */

const {
  createLanguageLabel: createSubtitleLanguageLabel,
  normalizeLanguageForVariant: normalizeSubtitleLanguage,
} = require('../shared/media_text');

const SUBTITLE_LANGUAGE_TITLE_LABELS = {
  eng: 'English',
  spa: 'Spanish',
  fre: 'French',
  fra: 'French',
  por: 'Portuguese',
};
const SUBTITLE_VARIANT_TITLE_LABELS = {
  'LatAm': 'Latin America',
  ES: 'Spain',
  MX: 'Mexico',
  BR: 'Brazil',
  PT: 'Portugal',
  US: 'US',
};

function planSubtitles(context) {
  const subtitleStreams = context.analysis.streams.subtitle.items;
  const languageOrder = createFinalSubtitleLanguageOrder(context);
  const preserveExistingTitles = shouldPreserveExistingSubtitleTitles(context);
  const embeddedTracks = subtitleStreams.map((stream, sourceOrder) => createSubtitleTrack(stream, sourceOrder, preserveExistingTitles));
  const externalTracks = discoverExternalSrtImports(context, languageOrder, preserveExistingTitles);
  const candidateTracks = [...embeddedTracks, ...externalTracks];
  const keptTracks = selectSubtitleTracks(candidateTracks, context, languageOrder);
  const removedTracks = candidateTracks.filter((track) => track.action === 'remove');
  const outputTracks = assignSubtitleOutputIndexes(orderSubtitleTracks(keptTracks, context, languageOrder));
  const externalImports = outputTracks.filter((track) => track.sourceKind === 'external' && track.action === 'import');
  const reasons = collectSubtitleReasons(outputTracks, removedTracks);
  const shouldProcess = shouldProcessSubtitles(embeddedTracks, outputTracks, removedTracks, externalImports);

  return {
    languageOrder,
    tracks: outputTracks,
    removedTracks,
    externalImports,
    reasons,
    shouldProcess,
  };
}

function createFinalSubtitleLanguageOrder(context) {
  const originalLanguage = normalizeSubtitleLanguage(context.analysis.originalLanguage?.language || '');
  const configuredLanguages = context.settings.languageOrder.subtitle.map(normalizeSubtitleLanguage);
  const languageOrder = [];

  configuredLanguages.forEach((language) => {
    if (language && !languageOrder.includes(language)) {
      languageOrder.push(language);
    }
  });

  if (context.settings.subtitle.includeOriginalLanguage && originalLanguage && !languageOrder.includes(originalLanguage)) {
    languageOrder.push(originalLanguage);
  }

  return languageOrder;
}

function createSubtitleTrack(stream, sourceOrder, preserveExistingTitles) {
  const subtitleAnalysis = stream.analysis.subtitle;
  const title = subtitleAnalysis.title;
  const codec = subtitleAnalysis.codec;
  const isCommentary = subtitleAnalysis.isCommentary;
  const desiredTitle = createSubtitleTitle({
    title,
    language: subtitleAnalysis.language,
    languageVariant: subtitleAnalysis.languageVariant,
    languageLabel: subtitleAnalysis.languageLabel,
    formatLabel: subtitleAnalysis.formatLabel,
    accessibility: subtitleAnalysis.accessibility,
    contentScope: subtitleAnalysis.contentScope,
    currentForced: subtitleAnalysis.currentForced,
  }, preserveExistingTitles);
  const track = {
    sourceKind: 'embedded',
    sourceIndex: stream.index,
    sourcePath: '',
    sourceOrder,
    outputIndex: null,
    codec,
    formatLabel: subtitleAnalysis.formatLabel,
    language: subtitleAnalysis.language,
    languageVariant: subtitleAnalysis.languageVariant,
    languageLabel: subtitleAnalysis.languageLabel,
    subtitleType: subtitleAnalysis.subtitleType,
    title,
    desiredTitle,
    titleNeedsUpdate: title !== desiredTitle,
    action: 'copy',
    default: false,
    forced: false,
    currentDefault: subtitleAnalysis.currentDefault,
    currentForced: subtitleAnalysis.currentForced,
    isCommentary,
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

  if (isCommentary) {
    track.action = 'remove';
    track.reasons.push(createCommentaryRemovalReason(track));
  }

  return track;
}

function createExternalSubtitleTrack(externalSubtitle, sourceOrder, preserveExistingTitles) {
  const fileName = externalSubtitle.fileName;
  const desiredTitle = createSubtitleTitle(externalSubtitle, preserveExistingTitles);
  const track = {
    sourceKind: 'external',
    sourceIndex: null,
    sourcePath: externalSubtitle.sourcePath,
    sourceOrder,
    fileName,
    outputIndex: null,
    codec: externalSubtitle.codec,
    formatLabel: externalSubtitle.formatLabel,
    language: externalSubtitle.language,
    languageVariant: externalSubtitle.languageVariant,
    languageLabel: externalSubtitle.languageLabel || createSubtitleLanguageLabel(externalSubtitle.language, externalSubtitle.languageVariant),
    subtitleType: externalSubtitle.subtitleType,
    title: externalSubtitle.title,
    desiredTitle,
    titleNeedsUpdate: externalSubtitle.title !== desiredTitle,
    action: 'import',
    default: false,
    forced: false,
    currentDefault: false,
    currentForced: false,
    isCommentary: externalSubtitle.isCommentary,
    isEmpty: externalSubtitle.isEmpty,
    contentScope: externalSubtitle.contentScope,
    accessibility: externalSubtitle.accessibility,
    frameCount: externalSubtitle.frameCount,
    elementCount: externalSubtitle.elementCount,
    streamSize: externalSubtitle.streamSize,
    bitRate: externalSubtitle.bitRate,
    reasons: [],
  };

  return track;
}

function selectSubtitleTracks(candidateTracks, context, languageOrder) {
  const keptTracks = [];

  candidateTracks.forEach((track) => {
    if (track.action === 'remove') {
      return;
    }

    if (!languageOrder.includes(track.language)) {
      track.action = 'remove';
      track.reasons.push(`Subtitle language ${track.languageLabel} is outside the target language order.`);
      return;
    }

    if (track.isEmpty) {
      track.action = 'remove';
      track.reasons.push('Subtitle track is empty.');
      return;
    }

    if (context.settings.subtitle.textOnly && track.subtitleType !== 'text') {
      track.action = 'remove';
      track.reasons.push('Subtitle profile is text-only.');
      return;
    }

    keptTracks.push(track);
  });

  return keptTracks;
}

function orderSubtitleTracks(tracks, context, languageOrder) {
  const typeRank = context.settings.subtitle.pictureFirst
    ? { picture: 0, text: 1, other: 2 }
    : { text: 0, picture: 1, other: 2 };
  const orderedTracks = tracks.sort((left, right) => {
    const languageCompare = normalizeRank(languageOrder.indexOf(left.language))
      - normalizeRank(languageOrder.indexOf(right.language));

    if (languageCompare !== 0) {
      return languageCompare;
    }

    const typeCompare = typeRank[left.subtitleType] - typeRank[right.subtitleType];

    if (typeCompare !== 0) {
      return typeCompare;
    }

    const scopeCompare = getSubtitleContentScopeRank(left) - getSubtitleContentScopeRank(right);

    if (scopeCompare !== 0) {
      return scopeCompare;
    }

    const countCompare = getSubtitleContentCount(right) - getSubtitleContentCount(left);

    if (countCompare !== 0) {
      return countCompare;
    }

    return left.sourceOrder - right.sourceOrder;
  });

  return orderedTracks;
}

function assignSubtitleOutputIndexes(tracks) {
  const outputTracks = tracks.map((track, index) => Object.assign({}, track, {
    outputIndex: index,
    title: track.desiredTitle,
    default: index === 0,
    forced: false,
    reasons: createFinalSubtitleReasons(track, index),
  }));

  return outputTracks;
}

function createFinalSubtitleReasons(track, outputIndex) {
  const reasons = [...track.reasons];

  if (track.action === 'import') {
    reasons.push(`External SRT file "${track.fileName}" will be imported.`);
  }

  if (track.titleNeedsUpdate) {
    reasons.push(`Subtitle title will be standardized to "${track.desiredTitle}".`);
  }

  if (outputIndex === 0 && !track.currentDefault) {
    reasons.push('Subtitle track will be set as the default subtitle track.');
  } else if (outputIndex > 0 && track.currentDefault) {
    reasons.push('Subtitle default flag will be disabled.');
  }

  if (track.currentForced) {
    reasons.push('Subtitle forced flag will be disabled until a forced-subtitle policy is defined.');
  }

  return reasons;
}

function collectSubtitleReasons(outputTracks, removedTracks) {
  const reasons = [];

  outputTracks.forEach((track) => {
    reasons.push(...track.reasons);
  });

  removedTracks.forEach((track) => {
    reasons.push(...track.reasons);
  });

  return reasons;
}

function createCommentaryRemovalReason(track) {
  const commentaryReasons = track.commentaryReasons || [];

  if (commentaryReasons.length === 0) {
    return 'Subtitle track appears to be commentary, descriptive, narration, or director commentary.';
  }

  return `Subtitle track appears to be commentary, descriptive, narration, or director commentary (${commentaryReasons.join(', ')}).`;
}

function discoverExternalSrtImports(context, languageOrder, preserveExistingTitles) {
  if (!context.settings.subtitle.importExternalSrt) {
    return [];
  }

  const imports = (context.analysis.externalSubtitles || []).reduce((plannedImports, externalSubtitle) => {
    if (!languageOrder.includes(externalSubtitle.language)) {
      return plannedImports;
    }

    const sourceOrder = context.analysis.streams.subtitle.items.length + plannedImports.length;
    plannedImports.push(createExternalSubtitleTrack(externalSubtitle, sourceOrder, preserveExistingTitles));

    return plannedImports;
  }, []);

  return imports;
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
  const hasDefaultChanges = outputTracks.some((track) => {
    return track.sourceKind === 'embedded' && track.default !== track.currentDefault;
  });
  const hasTitleChanges = outputTracks.some((track) => {
    return track.sourceKind === 'embedded' && track.titleNeedsUpdate;
  });
  const hasForcedCleanup = embeddedTracks.some((track) => {
    return track.currentForced;
  });

  return hasRemovedTracks || hasExternalImports || hasEmbeddedOrderChanges || hasDefaultChanges || hasTitleChanges || hasForcedCleanup;
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

function shouldPreserveExistingSubtitleTitles(context) {
  const file = context.analysis.file || {};
  const media = context.analysis.media || {};
  const pathText = [
    file.id,
    file.directory,
    file.nameNoExtension,
    media.name,
  ].join(' ').toLowerCase();

  return pathText.includes('anime');
}

function createSubtitleTitle(track, preserveExistingTitle) {
  const existingTitle = String(track.title || '').trim();

  if (preserveExistingTitle && existingTitle) {
    return existingTitle;
  }

  const titleParts = [createSubtitleLanguageTitleLabel(track)];
  const accessibility = String(track.accessibility || '').trim();

  if (accessibility && accessibility !== 'regular') {
    titleParts.push(accessibility);
  }

  if (track.currentForced) {
    titleParts.push('Forced');
  } else if (track.contentScope === 'sparse') {
    titleParts.push('Partial');
  }

  titleParts.push(track.formatLabel || track.codec || 'unknown');

  return titleParts.filter(Boolean).join(' - ');
}

function createSubtitleLanguageTitleLabel(track) {
  const baseLabel = SUBTITLE_LANGUAGE_TITLE_LABELS[track.language] || track.languageLabel || track.language || 'und';
  const variantLabel = createSubtitleVariantTitleLabel(track.languageVariant);

  if (!variantLabel) {
    return baseLabel;
  }

  return `${baseLabel} ${variantLabel}`;
}

function createSubtitleVariantTitleLabel(languageVariant) {
  const variantText = String(languageVariant || '');
  const variant = variantText.includes('-') ? variantText.split('-').slice(1).join('-') : variantText;

  if (!variant) {
    return '';
  }

  return SUBTITLE_VARIANT_TITLE_LABELS[variant] || variant;
}

module.exports = {
  planSubtitles,
};
