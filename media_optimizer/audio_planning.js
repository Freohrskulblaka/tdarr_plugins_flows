/*
 * Media Optimizer Audio Planning Library
 * Created by: Freohrskulblaka
 * Created on: 2026-06-30
 * Description: Builds final audio track copy, removal, generation, ordering, and default decisions.
 * Updates:
 * - 2026-06-30 - Freohrskulblaka: Created first-pass audio planning helper for language and channel profile decisions.
 * - 2026-07-07 - Freohrskulblaka: Refined audio planning around language order, commentary removal, 7.1 fallback generation, title normalization, and deterministic defaults.
 */

const CHANNEL_RANK = {'7.1': 0, '5.1': 1, stereo: 2, other: 3};
const CODEC_QUALITY_RANK = {truehd: 0, dts: 1, eac3: 2, ac3: 3, flac: 4, opus: 5, aac: 6, mp3: 7};
const COMMENTARY_TITLE_PATTERNS = [
  /commentary|commentator|director.?s? comment|audio comment/,
  /descriptive|description|described video|narration|narrator/,
  /comentarios?|comentarios? del director|comentarios? de director|audio comentario|audiocomentario/,
  /audio descriptivo|audiodescripcion|descripcion de audio|narracion|narrador/,
];

function planAudio(context) {
  const audioStreams = context.analysis.streams.audio.items;
  const languageOrder = createFinalAudioLanguageOrder(context);
  const candidateTracks = audioStreams.map((stream, sourceOrder) => createAudioTrack(stream, sourceOrder, context));
  const eligibleSources = candidateTracks.filter((track) => isEligibleAudioSource(track, languageOrder, context));
  const selectedTracks = selectFinalAudioTracks(eligibleSources, context, languageOrder);
  const generatedTracks = createGeneratedAudioTracks(selectedTracks, eligibleSources, context, languageOrder);
  const finalTracks = orderAudioTracks([...selectedTracks, ...generatedTracks], languageOrder);
  const outputTracks = assignAudioOutputIndexes(finalTracks);
  const removedTracks = createRemovedAudioTracks(candidateTracks, outputTracks, languageOrder, context);
  const reasons = collectAudioReasons(outputTracks, removedTracks);
  const shouldProcess = shouldProcessAudio(candidateTracks, outputTracks, removedTracks, generatedTracks);

  return {languageOrder, tracks: outputTracks, removedTracks, generatedTracks, reasons, shouldProcess};
}

function createFinalAudioLanguageOrder(context) {
  const originalLanguage = normalizeLanguage(context.analysis.originalLanguage?.language || 'und');
  const configuredLanguages = context.settings.languageOrder.audio.map(normalizeLanguage);
  const desiredLanguages = new Set([originalLanguage, ...configuredLanguages]);
  const languageOrder = Array.from(desiredLanguages);

  return languageOrder;
}

function createAudioTrack(stream, sourceOrder, context) {
  const mediaInfoTrack = getAudioMediaInfoTrack(context, sourceOrder);
  const title = stream.tags?.title || '';
  const language = normalizeLanguage(stream.tags?.language || 'und');
  const languageVariant = detectAudioLanguageVariant(stream, mediaInfoTrack, language);
  const channels = Number(stream.channels || 0);
  const channelFamily = getChannelFamily(channels);
  const codec = normalizeCodec(stream.codec_name || 'unknown');
  const targetCodec = resolveTargetAudioCodec(codec, channelFamily, context);
  const action = targetCodec !== codec ? 'convert' : 'copy';
  const desiredTitle = createAudioTitle({channelFamily, targetCodec, profile: stream.profile || '', language, languageVariant});
  const currentDefault = Boolean(stream.disposition?.default);
  const isCommentary = isCommentaryAudioStream(stream);

  return {
    sourceIndex: stream.index,
    sourceOrder,
    outputIndex: null,
    codec,
    targetCodec,
    profile: stream.profile || '',
    language,
    languageVariant,
    channels,
    channelFamily,
    title,
    desiredTitle,
    titleNeedsUpdate: title !== desiredTitle,
    isCommentary,
    action,
    default: false,
    currentDefault,
    generated: false,
    sourceTrackIndex: stream.index,
    bitrate: parseBitrate(stream.bit_rate || stream.tags?.BPS),
    reasons: [],
  };
}

function isEligibleAudioSource(track, languageOrder, context) {
  const shouldRemoveCommentary = context.settings.audio.removeCommentary && track.isCommentary;

  return languageOrder.includes(track.language) && !shouldRemoveCommentary;
}

function selectFinalAudioTracks(eligibleSources, context, languageOrder) {
  if (isPreserveAudioProfile(context)) {
    return eligibleSources.map((track) => addTitleReason(track));
  }

  const selectedTracks = [];
  const allowedFamilies = createAllowedChannelFamilies(context);

  languageOrder.forEach((language) => {
    const languageSources = eligibleSources.filter((track) => track.language === language);
    const variantGroups = createLanguageVariantGroups(languageSources);

    variantGroups.forEach((languageVariant) => {
      allowedFamilies.forEach((channelFamily) => {
        const languageFamilyTracks = languageSources.filter((track) => {
          return track.languageVariant === languageVariant && track.channelFamily === channelFamily;
        });
        const bestTrack = chooseBestAudioSource(languageFamilyTracks);

        if (bestTrack) {
          selectedTracks.push(addTitleReason(bestTrack));
        }
      });
    });
  });

  return selectedTracks;
}

function createAllowedChannelFamilies(context) {
  const settings = context.settings.audio;
  const families = [];

  if (settings.keepSevenOne) {
    families.push('7.1');
  }

  if (settings.createMissingFiveOne || settings.keepSevenOne) {
    families.push('5.1');
  }

  if (settings.createMissingStereo || settings.keepSevenOne) {
    families.push('stereo');
  }

  return families;
}

function createGeneratedAudioTracks(selectedTracks, eligibleSources, context, languageOrder) {
  const generatedTracks = [];

  languageOrder.forEach((language) => {
    const languageSources = eligibleSources.filter((track) => track.language === language);
    const variantGroups = createLanguageVariantGroups(languageSources);

    variantGroups.forEach((languageVariant) => {
      const variantSources = languageSources.filter((track) => track.languageVariant === languageVariant);
      const bestSource = chooseBestAudioSource(variantSources);

      if (!bestSource) {
        return;
      }

      if (context.settings.audio.createMissingFiveOne && !hasChannelFamily(selectedTracks, language, '5.1', languageVariant)) {
        const sourceTrack = chooseBestAudioSource(variantSources.filter((track) => track.channelFamily === '7.1'));

        if (sourceTrack) {
          generatedTracks.push(createGeneratedAudioTrack(sourceTrack, language, 6, '5.1'));
        }
      }

      if (context.settings.audio.createMissingStereo && !hasChannelFamily(selectedTracks, language, 'stereo', languageVariant)) {
        generatedTracks.push(createGeneratedAudioTrack(bestSource, language, 2, 'stereo'));
      }
    });
  });

  return generatedTracks;
}

function createGeneratedAudioTrack(sourceTrack, language, channels, channelFamily) {
  const targetCodec = channelFamily === 'stereo' ? 'aac' : 'ac3';
  const languageVariant = sourceTrack.languageVariant || '';
  const title = createAudioTitle({channelFamily, targetCodec, profile: sourceTrack.profile, language, languageVariant});

  return {
    sourceIndex: sourceTrack.sourceIndex,
    sourceOrder: sourceTrack.sourceOrder,
    outputIndex: null,
    codec: sourceTrack.codec,
    targetCodec,
    profile: sourceTrack.profile,
    language,
    languageVariant,
    channels,
    channelFamily,
    title,
    desiredTitle: title,
    titleNeedsUpdate: false,
    action: 'generate',
    default: false,
    currentDefault: false,
    generated: true,
    sourceTrackIndex: sourceTrack.sourceIndex,
    bitrate: null,
    reasons: [`Missing ${channelFamily} audio will be generated from source track ${sourceTrack.sourceIndex}.`],
  };
}

function createRemovedAudioTracks(candidateTracks, outputTracks, languageOrder, context) {
  const keptSourceKeys = new Set(outputTracks.filter((track) => !track.generated).map(createTrackKey));

  return candidateTracks.reduce((removedTracks, track) => {
    if (keptSourceKeys.has(createTrackKey(track))) {
      return removedTracks;
    }

    removedTracks.push(Object.assign({}, track, {
      action: 'remove',
      reasons: createRemovalReasons(track, outputTracks, languageOrder, context),
    }));

    return removedTracks;
  }, []);
}

function createRemovalReasons(track, outputTracks, languageOrder, context) {
  const reasons = [];

  if (track.isCommentary && context.settings.audio.removeCommentary) {
    reasons.push('Audio track appears to be commentary, descriptive, narration, or director commentary.');
  }

  if (!languageOrder.includes(track.language)) {
    reasons.push(`Audio language ${track.language} is outside the target language order.`);
  }

  if (!context.settings.audio.keepSevenOne && track.channelFamily === '7.1') {
    const hasFiveOne = hasChannelFamily(outputTracks, track.language, '5.1', track.languageVariant);
    const hasStereo = hasChannelFamily(outputTracks, track.language, 'stereo', track.languageVariant);

    if (hasFiveOne && hasStereo) {
      reasons.push('7.1 audio is removed after 5.1 and stereo tracks are present or planned.');
    } else {
      reasons.push('7.1 audio is not kept by the selected audio profile.');
    }
  }

  if (reasons.length === 0 && !isPreserveAudioProfile(context)) {
    reasons.push(`A better ${track.channelFamily} ${createAudioLanguageLabel(track.language, track.languageVariant)} audio track was selected.`);
  }

  return reasons;
}

function orderAudioTracks(tracks, languageOrder) {
  return tracks.slice().sort((left, right) => {
    const channelCompare = CHANNEL_RANK[left.channelFamily] - CHANNEL_RANK[right.channelFamily];

    if (channelCompare !== 0) {
      return channelCompare;
    }

    const leftLanguageRank = languageOrder.indexOf(left.language);
    const rightLanguageRank = languageOrder.indexOf(right.language);
    const languageCompare = normalizeRank(leftLanguageRank) - normalizeRank(rightLanguageRank);

    if (languageCompare !== 0) {
      return languageCompare;
    }

    if (left.generated !== right.generated) {
      return left.generated ? 1 : -1;
    }

    return left.sourceOrder - right.sourceOrder;
  });
}

function assignAudioOutputIndexes(tracks) {
  return tracks.map((track, index) => Object.assign({}, track, {
    outputIndex: index,
    default: index === 0,
    title: track.desiredTitle,
    reasons: createFinalTrackReasons(track, index),
  }));
}

function createFinalTrackReasons(track, outputIndex) {
  const reasons = [...track.reasons];

  if (!track.generated && track.titleNeedsUpdate) {
    reasons.push(`Audio title will be standardized to "${track.desiredTitle}".`);
  }

  if (track.action === 'convert') {
    reasons.push(`Audio codec ${track.codec} will be converted to ${track.targetCodec}.`);
  }

  if (outputIndex === 0 && !track.currentDefault) {
    reasons.push('Audio track will be set as the only default track.');
  } else if (outputIndex > 0 && track.currentDefault) {
    reasons.push('Audio default flag will be disabled.');
  }

  return reasons;
}

function collectAudioReasons(outputTracks, removedTracks) {
  const reasons = [];

  outputTracks.forEach((track) => {
    reasons.push(...track.reasons);
  });

  removedTracks.forEach((track) => {
    reasons.push(...track.reasons);
  });

  return reasons;
}

function shouldProcessAudio(candidateTracks, outputTracks, removedTracks, generatedTracks) {
  const hasRemovedTracks = removedTracks.length > 0;
  const hasGeneratedTracks = generatedTracks.length > 0;
  const hasTrackOrderChanges = outputTracks.some((track, index) => track.sourceOrder !== index);
  const hasTrackUpdates = outputTracks.some((track) => {
    return track.generated || track.titleNeedsUpdate || track.action === 'convert' || track.default !== track.currentDefault;
  });
  const hasDefaultCleanup = candidateTracks.some((track) => {
    const outputTrack = outputTracks.find((candidate) => createTrackKey(candidate) === createTrackKey(track));

    return outputTrack ? outputTrack.default !== track.currentDefault : false;
  });

  return hasRemovedTracks || hasGeneratedTracks || hasTrackOrderChanges || hasTrackUpdates || hasDefaultCleanup;
}

function addTitleReason(track) {
  return Object.assign({}, track);
}

function chooseBestAudioSource(tracks) {
  const sortedTracks = tracks.slice().sort((left, right) => {
    const channelCompare = right.channels - left.channels;

    if (channelCompare !== 0) {
      return channelCompare;
    }

    const codecCompare = getCodecQualityRank(left.codec) - getCodecQualityRank(right.codec);

    if (codecCompare !== 0) {
      return codecCompare;
    }

    const bitrateCompare = (right.bitrate || 0) - (left.bitrate || 0);

    if (bitrateCompare !== 0) {
      return bitrateCompare;
    }

    return left.sourceOrder - right.sourceOrder;
  });

  return sortedTracks[0] || null;
}

function hasChannelFamily(tracks, language, channelFamily, languageVariant) {
  return tracks.some((track) => {
    return track.language === language
      && track.channelFamily === channelFamily
      && track.languageVariant === (languageVariant || '');
  });
}

function getChannelFamily(channels) {
  if (channels >= 8) {
    return '7.1';
  }

  if (channels >= 6) {
    return '5.1';
  }

  if (channels <= 2) {
    return 'stereo';
  }

  return 'other';
}

function resolveTargetAudioCodec(codec, channelFamily, context) {
  if (isPreserveAudioProfile(context)) {
    return codec;
  }

  if (channelFamily === 'stereo') {
    return 'aac';
  }

  if (channelFamily === '5.1') {
    return 'ac3';
  }

  return codec;
}

function isPreserveAudioProfile(context) {
  return context.settings.audio.keepSevenOne
    && !context.settings.audio.createMissingFiveOne
    && !context.settings.audio.createMissingStereo;
}

function isCommentaryAudioStream(stream) {
  const disposition = stream.disposition || {};
  const hasCommentaryDisposition = Boolean(disposition.comment || disposition.descriptions);
  const title = stream.tags?.title || stream.tags?.TITLE || '';
  const hasCommentaryTitle = isCommentaryTrack(title);

  return hasCommentaryDisposition || hasCommentaryTitle;
}

function isCommentaryTrack(title) {
  const normalizedTitle = normalizeVariantText(title);
  const isCommentary = COMMENTARY_TITLE_PATTERNS.some((pattern) => pattern.test(normalizedTitle));

  return isCommentary;
}

function createAudioTitle(track) {
  const channelLabel = createAudioChannelLabel(track.channelFamily);
  const codecLabel = createAudioCodecLabel(track.targetCodec, track.profile);
  const languageLabel = createAudioLanguageLabel(track.language, track.languageVariant);
  const finalTitle = `${channelLabel} - ${codecLabel} - ${languageLabel}`;

  return finalTitle;
}

function createAudioChannelLabel(channelFamily) {
  const label = channelFamily === 'stereo' ? 'Stereo' : `${channelFamily} Surround`;

  return label;
}

function createAudioCodecLabel(codec, profile) {
  const normalizedCodec = normalizeCodec(codec);
  const normalizedProfile = String(profile || '').trim().toLowerCase();

  if (normalizedCodec === 'dts' && normalizedProfile === 'dts-hd ma') {
    return 'dts-hd ma';
  }

  if (normalizedCodec === 'truehd' && normalizedProfile.includes('atmos')) {
    return 'truehd atmos';
  }

  return normalizedCodec;
}

function createAudioLanguageLabel(language, languageVariant) {
  const normalizedLanguage = normalizeLanguage(language);

  if (languageVariant) {
    return `${normalizedLanguage}-${languageVariant}`;
  }

  return normalizedLanguage;
}

function createLanguageVariantGroups(tracks) {
  const languageVariants = [];

  tracks.forEach((track) => {
    const languageVariant = track.languageVariant || '';

    if (!languageVariants.includes(languageVariant)) {
      languageVariants.push(languageVariant);
    }
  });

  return languageVariants;
}

function getAudioMediaInfoTrack(context, sourceOrder) {
  const mediaInfoTracks = context.analysis.media.tracks || [];
  const audioTracks = mediaInfoTracks.filter((track) => track['@type'] === 'Audio');
  const streamOrder = String(sourceOrder + 1);
  const mediaInfoTrack = audioTracks.find((track) => String(track.StreamOrder) === streamOrder) || audioTracks[sourceOrder] || null;

  return mediaInfoTrack;
}

function detectAudioLanguageVariant(stream, mediaInfoTrack, language) {
  if (language !== 'spa') {
    return '';
  }

  const languageFields = [
    stream.tags?.language,
    stream.tags?.LANGUAGE,
    mediaInfoTrack?.Language,
  ];
  const titleFields = [
    stream.tags?.title,
    stream.tags?.TITLE,
    mediaInfoTrack?.Title,
  ];
  const languageVariant = detectSpanishVariantFromLanguageCodes(languageFields)
    || detectSpanishVariantFromText(titleFields);

  return languageVariant;
}

function detectSpanishVariantFromLanguageCodes(languageCodes) {
  const normalizedCodes = languageCodes.map(normalizeVariantText);

  if (normalizedCodes.some((languageCode) => /(^|[-_])(es|spa)[-_]?(419|latam|latinoamerica)(\b|$)/.test(languageCode))) {
    return 'LatAm';
  }

  if (normalizedCodes.some((languageCode) => /(^|[-_])(es|spa)[-_]?(mx|mex)(\b|$)/.test(languageCode))) {
    return 'MX';
  }

  if (normalizedCodes.some((languageCode) => /(^|[-_])(es|spa)[-_]?es(\b|$)/.test(languageCode))) {
    return 'ES';
  }

  return '';
}

function detectSpanishVariantFromText(values) {
  const normalizedText = normalizeVariantText(values.join(' '));

  if (/spa[-_ ]?latam|es[-_ ]?419|latinoamerica|latin america|latam|latino/.test(normalizedText)) {
    return 'LatAm';
  }

  if (/spa[-_ ]?mx|es[-_ ]?mx|mexico|mexican/.test(normalizedText)) {
    return 'MX';
  }

  if (/spa[-_ ]?es|es[-_ ]?es|espana|spain|castilian|castellano/.test(normalizedText)) {
    return 'ES';
  }

  return '';
}

function normalizeVariantText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function normalizeCodec(codec) {
  return String(codec || 'unknown').trim().toLowerCase();
}

function normalizeLanguage(language) {
  return String(language || 'und').trim().toLowerCase() || 'und';
}

function parseBitrate(value) {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

function getCodecQualityRank(codec) {
  return CODEC_QUALITY_RANK[codec] ?? 999;
}

function createTrackKey(track) {
  return `${track.sourceIndex}:${track.sourceOrder}`;
}

function normalizeRank(rank) {
  return rank === -1 ? 999 : rank;
}

module.exports = {
  planAudio,
};
