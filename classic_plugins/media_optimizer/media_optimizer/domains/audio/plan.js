/*
 * Media Optimizer Audio Planning Library
 * Created by: Freohrskulblaka
 * Created on: 2026-06-30
 * Description: Builds final audio track copy, removal, generation, ordering, and default decisions.
 * Updates:
 * - 2026-06-30 - Freohrskulblaka: Created first-pass audio planning helper for language and channel profile decisions.
 * - 2026-07-07 - Freohrskulblaka: Refined audio planning around language order, commentary removal, 7.1 fallback generation, title normalization, and deterministic defaults.
 * - 2026-07-10 - Freohrskulblaka: Moved source audio classification into the audio analysis library.
 * - 2026-08-05 - Freohrskulblaka: Retag undetermined-language audio to the resolved original or first configured language.
 */

const {
  createLanguageLabel: createAudioLanguageLabel,
  normalizeLanguageForVariant: normalizeAudioLanguage,
} = require('../../utils/language');

const CHANNEL_RANK = {'7.1': 0, '5.1': 1, stereo: 2, other: 3};
const AUDIO_QUALITY_RANK = {atmos: 0, 'dts-hd ma': 1, dts: 2, ac3: 3, aac: 4};
const AUDIO_ROLE_RANK = {native: 0, original: 0, compatibility: 1, descriptive: 2, commentary: 3};

function planAudio(context) {
  const audioStreams = context.analysis.streams.audio.items;
  const originalLanguage = normalizeAudioLanguage(context.analysis.originalLanguage?.language || 'und');
  const configuredLanguages = context.settings.languageOrder.audio.map(normalizeAudioLanguage);
  const configuredLanguageOrder = Array.from(new Set([
    ...(originalLanguage && originalLanguage !== 'und' ? [originalLanguage] : []),
    ...configuredLanguages,
  ]));
  const candidateTracks = audioStreams.map((stream, sourceOrder) => createAudioTrack(stream, sourceOrder, context));
  const primaryTracks = candidateTracks.filter((track) => !track.isCommentary && !track.isDescriptive);
  const hasTargetLanguageAudio = primaryTracks.some((track) => configuredLanguageOrder.includes(track.language));
  const hasUndeterminedAudio = primaryTracks.some((track) => track.language === 'und');
  const languageOrder = !hasTargetLanguageAudio && hasUndeterminedAudio && !configuredLanguageOrder.includes('und')
    ? [...configuredLanguageOrder, 'und']
    : configuredLanguageOrder;
  const eligibleSources = primaryTracks.filter((track) => languageOrder.includes(track.language));
  const sourceGroups = createAudioSourceGroups(eligibleSources, languageOrder);
  const selectedTracks = selectFinalAudioTracks(eligibleSources, sourceGroups, context);
  const generatedTracks = createGeneratedAudioTracks(selectedTracks, sourceGroups, context);
  const supplementalTracks = candidateTracks
    .filter((track) => languageOrder.includes(track.language))
    .filter((track) => {
      return track.isCommentary
        ? context.settings.audio.keepCommentary
        : track.isDescriptive && context.settings.audio.keepDescriptive;
    })
    .map((track) => {
      const role = track.isCommentary ? 'commentary' : 'descriptive';
      const titleSuffix = track.isCommentary ? 'Commentary' : 'Audio Description';
      const desiredTitle = `${createAudioTitle(track)} - ${titleSuffix}`;

      return {...track, role, desiredTitle, titleNeedsUpdate: track.title !== desiredTitle};
    });
  const finalTracks = orderAudioTracks([...selectedTracks, ...generatedTracks, ...supplementalTracks], languageOrder);
  const outputTracks = assignAudioOutputIndexes(finalTracks);
  const removedTracks = createRemovedAudioTracks(candidateTracks, outputTracks, languageOrder, context);
  const reasons = [...outputTracks, ...removedTracks].flatMap((track) => track.reasons);
  const shouldProcess = removedTracks.length > 0 || outputTracks.some((track, index) => {
    return track.sourceOrder !== index
      || track.generated
      || track.titleNeedsUpdate
      || track.languageNeedsUpdate
      || track.default !== track.currentDefault;
  });

  return {languageOrder, tracks: outputTracks, removedTracks, reasons, shouldProcess};
}

function createAudioTrack(stream, sourceOrder, context) {
  const audioAnalysis = stream.analysis.audio;
  const title = audioAnalysis.title;
  const currentLanguage = audioAnalysis.language;
  const normalizedLanguage = normalizeAudioLanguage(currentLanguage || 'und');
  const originalLanguage = normalizeAudioLanguage(context.analysis.originalLanguage?.language || '');
  const fallbackLanguage = originalLanguage && originalLanguage !== 'und'
    ? originalLanguage
    : normalizeAudioLanguage(context.settings.languageOrder.audio[0] || 'und');
  const language = normalizedLanguage !== 'und' ? normalizedLanguage : fallbackLanguage;
  const languageVariant = language === currentLanguage ? audioAnalysis.languageVariant : '';
  const languageLabel = createAudioLanguageLabel(language, languageVariant);
  const channels = audioAnalysis.channels;
  const channelFamily = audioAnalysis.channelFamily;
  const codec = audioAnalysis.codec;
  const formatKey = audioAnalysis.formatKey || codec;
  const desiredTitle = createAudioTitle({channelFamily, codec, targetCodec: codec, formatKey, languageLabel});

  return {
    sourceIndex: stream.index,
    sourceOrder,
    outputIndex: null,
    codec,
    targetCodec: codec,
    formatKey,
    qualityRank: AUDIO_QUALITY_RANK[formatKey] ?? 999,
    profile: audioAnalysis.profile,
    language,
    languageVariant,
    languageLabel,
    currentLanguage,
    languageNeedsUpdate: language !== currentLanguage,
    channels,
    channelFamily,
    title,
    desiredTitle,
    titleNeedsUpdate: title !== desiredTitle,
    isCommentary: audioAnalysis.isCommentary,
    isDescriptive: audioAnalysis.isDescriptive,
    commentaryReasons: audioAnalysis.commentaryReasons,
    descriptiveReasons: audioAnalysis.descriptiveReasons,
    action: 'copy',
    role: 'source',
    default: false,
    currentDefault: audioAnalysis.currentDefault,
    generated: false,
    bitrate: audioAnalysis.bitrate,
    reasons: [],
  };
}

function selectFinalAudioTracks(eligibleSources, sourceGroups, context) {
  const settings = context.settings.audio;

  if (settings.preserveOriginals) {
    return eligibleSources.map((track) => ({...track, role: 'original'}));
  }

  const selectedTracks = [];

  sourceGroups.forEach(({sources}) => {
    if (settings.keepBestSurround) {
      const bestNativeTrack = chooseBestAudioSource(sources.filter((track) => {
        return track.channelFamily === settings.keepBestSurround && track.qualityRank <= AUDIO_QUALITY_RANK.dts;
      }));

      if (bestNativeTrack) {
        selectedTracks.push({...bestNativeTrack, role: 'native'});
      }
    }

    if (settings.createMissingFiveOne) {
      const fiveOneTrack = chooseBestAudioSource(sources.filter((track) => {
        return track.channelFamily === '5.1' && track.codec === 'ac3';
      }));

      if (fiveOneTrack) {
        selectedTracks.push({...fiveOneTrack, role: 'compatibility'});
      }
    }

    if (settings.createMissingStereo) {
      const stereoTrack = chooseBestAudioSource(sources.filter((track) => {
        return track.channelFamily === 'stereo' && track.codec === 'aac';
      }));

      if (stereoTrack) {
        selectedTracks.push({...stereoTrack, role: 'compatibility'});
      }
    }
  });

  return selectedTracks;
}

function createAudioSourceGroups(eligibleSources, languageOrder) {
  return languageOrder.flatMap((language) => {
    const languageSources = eligibleSources.filter((track) => track.language === language);
    const languageVariants = Array.from(new Set(languageSources.map((track) => track.languageVariant || '')));

    return languageVariants.map((languageVariant) => ({
      language,
      languageVariant,
      sources: languageSources.filter((track) => track.languageVariant === languageVariant),
    }));
  });
}

function createGeneratedAudioTracks(selectedTracks, sourceGroups, context) {
  const generatedTracks = [];

  sourceGroups.forEach(({language, languageVariant, sources}) => {
    const bestSource = chooseBestAudioSource(sources);

    if (!bestSource) {
      return;
    }

    if (context.settings.audio.createMissingFiveOne && !hasAudioFormat(selectedTracks, language, languageVariant, '5.1', 'ac3')) {
      const sourceTrack = chooseBestAudioSource(sources.filter((track) => {
        return track.channelFamily === '7.1' || track.channelFamily === '5.1';
      }));

      if (sourceTrack) {
        generatedTracks.push(createGeneratedAudioTrack(sourceTrack, language, 6, '5.1'));
      }
    }

    if (context.settings.audio.createMissingStereo && !hasAudioFormat(selectedTracks, language, languageVariant, 'stereo', 'aac')) {
      generatedTracks.push(createGeneratedAudioTrack(bestSource, language, 2, 'stereo'));
    }
  });

  return generatedTracks;
}

function createGeneratedAudioTrack(sourceTrack, language, channels, channelFamily) {
  const targetCodec = channelFamily === 'stereo' ? 'aac' : 'ac3';
  const languageVariant = sourceTrack.languageVariant || '';
  const languageLabel = sourceTrack.languageLabel;
  const title = createAudioTitle({channelFamily, codec: sourceTrack.codec, targetCodec, formatKey: targetCodec, languageLabel});

  return {
    sourceIndex: sourceTrack.sourceIndex,
    sourceOrder: sourceTrack.sourceOrder,
    outputIndex: null,
    codec: sourceTrack.codec,
    targetCodec,
    formatKey: targetCodec,
    qualityRank: AUDIO_QUALITY_RANK[targetCodec],
    profile: sourceTrack.profile,
    language,
    languageVariant,
    languageLabel,
    channels,
    channelFamily,
    title,
    desiredTitle: title,
    titleNeedsUpdate: false,
    action: 'generate',
    role: 'compatibility',
    default: false,
    currentDefault: false,
    generated: true,
    bitrate: null,
    reasons: [`Missing ${channelFamily} audio will be generated from source track ${sourceTrack.sourceIndex}.`],
  };
}

function createRemovedAudioTracks(candidateTracks, outputTracks, languageOrder, context) {
  const keptSourceIndexes = new Set(outputTracks.filter((track) => !track.generated).map((track) => track.sourceIndex));

  return candidateTracks
    .filter((track) => !keptSourceIndexes.has(track.sourceIndex))
    .map((track) => {
      const commentaryReasons = track.commentaryReasons || [];
      const descriptiveReasons = track.descriptiveReasons || [];
      const removesSevenOne = !context.settings.audio.preserveOriginals
        && context.settings.audio.keepBestSurround !== '7.1'
        && track.channelFamily === '7.1';
      const hasCompatibilityTracks = removesSevenOne
        && hasAudioFormat(outputTracks, track.language, track.languageVariant, '5.1', 'ac3')
        && hasAudioFormat(outputTracks, track.language, track.languageVariant, 'stereo', 'aac');
      const commentaryReason = track.isCommentary && !context.settings.audio.keepCommentary
        ? commentaryReasons.length === 0
          ? 'Audio track appears to be commentary or director commentary.'
          : `Audio track appears to be commentary or director commentary (${commentaryReasons.join(', ')}).`
        : '';
      const descriptiveReason = !track.isCommentary && track.isDescriptive && !context.settings.audio.keepDescriptive
        ? descriptiveReasons.length === 0
          ? 'Audio track appears to be descriptive audio or narration.'
          : `Audio track appears to be descriptive audio or narration (${descriptiveReasons.join(', ')}).`
        : '';
      const sevenOneReason = removesSevenOne
        ? hasCompatibilityTracks
          ? '7.1 audio is removed after 5.1 and stereo tracks are present or planned.'
          : '7.1 audio is not kept by the selected audio profile.'
        : '';
      const reasons = [
        commentaryReason,
        descriptiveReason,
        !languageOrder.includes(track.language) ? `Audio language ${track.language} is outside the target language order.` : '',
        sevenOneReason,
      ].filter(Boolean);

      if (reasons.length === 0) {
        reasons.push(`The selected audio profile does not retain this ${track.channelFamily} ${track.languageLabel} track.`);
      }

      return {...track, action: 'remove', reasons};
    });
}

function orderAudioTracks(tracks, languageOrder) {
  return tracks.slice().sort((left, right) => {
    const leftLanguageRank = languageOrder.indexOf(left.language);
    const rightLanguageRank = languageOrder.indexOf(right.language);
    const comparisons = [
      (AUDIO_ROLE_RANK[left.role] ?? 999) - (AUDIO_ROLE_RANK[right.role] ?? 999),
      CHANNEL_RANK[left.channelFamily] - CHANNEL_RANK[right.channelFamily],
      (leftLanguageRank === -1 ? 999 : leftLanguageRank) - (rightLanguageRank === -1 ? 999 : rightLanguageRank),
      Number(left.generated) - Number(right.generated),
      left.sourceOrder - right.sourceOrder,
    ];

    return comparisons.find((comparison) => comparison !== 0) || 0;
  });
}

function assignAudioOutputIndexes(tracks) {
  return tracks.map((track, index) => {
    const isDefault = index === 0 && !track.isCommentary && !track.isDescriptive;
    const reasons = [
      ...track.reasons,
      !track.generated && track.titleNeedsUpdate ? `Audio title will be standardized to "${track.desiredTitle}".` : '',
      !track.generated && track.languageNeedsUpdate ? `Audio language will be set to ${track.language}.` : '',
      isDefault && !track.currentDefault ? 'Audio track will be set as the only default track.' : '',
      !isDefault && track.currentDefault ? 'Audio default flag will be disabled.' : '',
    ].filter(Boolean);

    return {
      ...track,
      outputIndex: index,
      default: isDefault,
      title: track.desiredTitle,
      reasons,
    };
  });
}

function chooseBestAudioSource(tracks) {
  const sortedTracks = tracks.slice().sort((left, right) => {
    const comparisons = [
      right.channels - left.channels,
      left.qualityRank - right.qualityRank,
      (right.bitrate || 0) - (left.bitrate || 0),
      left.sourceOrder - right.sourceOrder,
    ];

    return comparisons.find((comparison) => comparison !== 0) || 0;
  });

  return sortedTracks[0] || null;
}

function hasAudioFormat(tracks, language, languageVariant, channelFamily, codec) {
  return tracks.some((track) => {
    return track.language === language
      && track.languageVariant === (languageVariant || '')
      && track.channelFamily === channelFamily
      && track.targetCodec === codec;
  });
}

function createAudioTitle(track) {
  const channelLabel = track.channelFamily === 'stereo' ? 'Stereo' : `${track.channelFamily} Surround`;
  const codecLabel = track.targetCodec !== track.codec
    ? track.targetCodec
    : track.formatKey || track.targetCodec || track.codec || 'unknown';

  return `${channelLabel} - ${codecLabel} - ${track.languageLabel}`;
}

module.exports = {
  planAudio,
};
