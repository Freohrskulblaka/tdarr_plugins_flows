/*
 * Media Optimizer Config Library
 * Created by: Freohrskulblaka
 * Created on: 2026-06-29
 * Description: Loads Tdarr inputs, resolves profile settings, validates disabled or invalid selections, and creates runtime context.
 * Updates:
 * - 2026-06-29 - Freohrskulblaka: Created configuration and context helpers for the media optimizer workflow.
 */

const { createLog } = require('./logging');

const PROFILE_STATUS = {enabled: 'enabled', disabled: 'disabled', invalid: 'invalid'};

const VIDEO_PROFILES = {
  'Balanced 1080p': { status: PROFILE_STATUS.enabled, mode: 'balanced', encoderPreset: 'slow', encodingProfile: 'main10', bitDepth: '10-Bit', targetCompressionRate: '0.101', upscaleTo1080p: true, preserve4k: true, hdrPolicy: 'preserveSignaling' },
  'Archive Quality': { status: PROFILE_STATUS.enabled, mode: 'archive', encoderPreset: 'slow', encodingProfile: 'main10', bitDepth: '10-Bit', targetCompressionRate: '0.12', upscaleTo1080p: false, preserve4k: true, hdrPolicy: 'preserveSignaling' },
  'Smaller Files': { status: PROFILE_STATUS.enabled, mode: 'small', encoderPreset: 'medium', encodingProfile: 'main10', bitDepth: '10-Bit', targetCompressionRate: '0.08', upscaleTo1080p: false, preserve4k: true, hdrPolicy: 'preserveSignaling' },
  'Compress 4K Preserve HDR Signaling': { status: PROFILE_STATUS.enabled, mode: 'compress4k', encoderPreset: 'slow', encodingProfile: 'main10', bitDepth: '10-Bit', targetCompressionRate: '0.101', upscaleTo1080p: false, preserve4k: true, hdrPolicy: 'preserveSignaling' },
  'Compress 4K to SDR Experimental (Disabled)': { status: PROFILE_STATUS.disabled, disabledReason: 'HDR to SDR tonemapping has not been implemented yet.', mode: 'compress4kToSdr', encoderPreset: 'slow', encodingProfile: 'main10', bitDepth: '10-Bit', targetCompressionRate: '0.09', upscaleTo1080p: false, preserve4k: false, hdrPolicy: 'toneMapToSdr' },
  'Skip HDR Transcode (Disabled)': { status: PROFILE_STATUS.disabled, disabledReason: 'HDR detection and skip behavior has not been implemented yet.', mode: 'skipIfHdr', encoderPreset: 'copy', encodingProfile: 'copy', bitDepth: 'source', targetCompressionRate: '0.101', upscaleTo1080p: false, preserve4k: true, hdrPolicy: 'skipIfHdr' },
  'Copy When Compatible': { status: PROFILE_STATUS.enabled, mode: 'copyCompatible', encoderPreset: 'slow', encodingProfile: 'main10', bitDepth: '10-Bit', targetCompressionRate: '0.101', upscaleTo1080p: false, preserve4k: true, hdrPolicy: 'preserveSignaling' },
};

const VIDEO_CODEC_PROFILES = {
  'H.265 / HEVC - NVIDIA GPU': { status: PROFILE_STATUS.enabled, targetCodec: 'hevc', encoder: 'hevc_nvenc', encoderFamily: 'nvidia' },
  'H.265 / HEVC - CPU (Disabled)': { status: PROFILE_STATUS.disabled, disabledReason: 'CPU HEVC encoding support has not been implemented yet.', targetCodec: 'hevc', encoder: 'libx265', encoderFamily: 'cpu' },
  'H.265 / HEVC - Intel GPU (Disabled)': { status: PROFILE_STATUS.disabled, disabledReason: 'Intel QSV HEVC encoding support has not been implemented yet.', targetCodec: 'hevc', encoder: 'hevc_qsv', encoderFamily: 'intel' },
  'H.265 / HEVC - AMD GPU (Disabled)': { status: PROFILE_STATUS.disabled, disabledReason: 'AMD AMF HEVC encoding support has not been implemented yet.', targetCodec: 'hevc', encoder: 'hevc_amf', encoderFamily: 'amd' },
  'H.264 - NVIDIA GPU (Disabled)': { status: PROFILE_STATUS.disabled, disabledReason: 'H.264 NVIDIA encoding support has not been implemented yet.', targetCodec: 'h264', encoder: 'h264_nvenc', encoderFamily: 'nvidia' },
  'H.264 - CPU (Disabled)': { status: PROFILE_STATUS.disabled, disabledReason: 'CPU H.264 encoding support has not been implemented yet.', targetCodec: 'h264', encoder: 'libx264', encoderFamily: 'cpu' },
  'H.264 - Intel GPU (Disabled)': { status: PROFILE_STATUS.disabled, disabledReason: 'Intel QSV H.264 encoding support has not been implemented yet.', targetCodec: 'h264', encoder: 'h264_qsv', encoderFamily: 'intel' },
  'H.264 - AMD GPU (Disabled)': { status: PROFILE_STATUS.disabled, disabledReason: 'AMD AMF H.264 encoding support has not been implemented yet.', targetCodec: 'h264', encoder: 'h264_amf', encoderFamily: 'amd' },
  'Copy Video': { status: PROFILE_STATUS.enabled, targetCodec: 'copy', encoder: 'copy', encoderFamily: 'copy' },
};

const AUDIO_PROFILES = {
  'Keep 5.1 and Stereo': { keepSevenOne: false, createMissingFiveOne: true, createMissingStereo: true, removeCommentary: true },
  'Keep 7.1, 5.1, and Stereo': { keepSevenOne: true, createMissingFiveOne: true, createMissingStereo: true, removeCommentary: true },
  'Stereo Only': { keepSevenOne: false, createMissingFiveOne: false, createMissingStereo: true, removeCommentary: true },
  'Preserve Audio': { keepSevenOne: true, createMissingFiveOne: false, createMissingStereo: false, removeCommentary: true },
};

const SUBTITLE_PROFILES = {
  'Picture First + Text': { includeOriginalLanguage: false, pictureFirst: true, importExternalSrt: true },
  'Include Original Language': { includeOriginalLanguage: true, pictureFirst: true, importExternalSrt: true },
  'Text First': { includeOriginalLanguage: false, pictureFirst: false, importExternalSrt: true },
  'Text Only': { includeOriginalLanguage: false, pictureFirst: false, importExternalSrt: false, textOnly: true },
};

const METADATA_PROFILES = {
  Clean: { stripGlobalTags: true, keepFontAttachments: true, removeNonFontAttachments: true },
  Preserve: { stripGlobalTags: false, keepFontAttachments: true, removeNonFontAttachments: false },
};

function loadInputs(inputs, details) {
  const lib = require('../methods/lib')();
  const userInputs = lib.loadDefaultValues(Object.assign({}, inputs || {}), details);
  return userInputs;
}

function resolveProfile(profileMap, selectedName, inputName) {
  const profile = profileMap[selectedName];

  if (!profile) {
    const invalidProfile = {
      status: PROFILE_STATUS.invalid,
      invalidReasons: [`Invalid ${inputName}: ${selectedName}`],
      disabledReasons: [],
    };

    return invalidProfile;
  }

  const resolvedProfile = Object.assign({}, profile, {
    invalidReasons: profile.invalidReasons || [],
    disabledReasons: profile.disabledReason ? [profile.disabledReason] : (profile.disabledReasons || []),
  });

  return resolvedProfile;
}

function resolveVideoProfile(inputs) {
  const codecProfile = resolveProfile(VIDEO_CODEC_PROFILES, inputs.videoCodec, 'videoCodec');
  const qualityProfile = resolveProfile(VIDEO_PROFILES, inputs.videoQualityProfile, 'videoQualityProfile');
  const invalidReasons = [];
  const disabledReasons = [];

  invalidReasons.push(...qualityProfile.invalidReasons);
  invalidReasons.push(...codecProfile.invalidReasons);
  disabledReasons.push(...qualityProfile.disabledReasons);
  disabledReasons.push(...codecProfile.disabledReasons);

  const resolvedStatus = disabledReasons.length > 0 ? PROFILE_STATUS.disabled : PROFILE_STATUS.enabled;

  if (invalidReasons.length > 0) {
    const invalidVideoProfile = {
      status: PROFILE_STATUS.invalid,
      invalidReasons,
      disabledReasons: [],
    };

    return invalidVideoProfile;
  }

  if (codecProfile.targetCodec === 'copy') {
    const copyVideoProfile = Object.assign({}, qualityProfile, codecProfile, {
      status: resolvedStatus,
      disabledReasons,
      mode: 'copy',
      encoderPreset: 'copy',
      encodingProfile: 'copy',
      bitDepth: 'source',
    });

    return copyVideoProfile;
  }

  const videoProfile = Object.assign({}, qualityProfile, codecProfile, {
    status: resolvedStatus,
    invalidReasons,
    disabledReasons,
  });

  return videoProfile;
}

function parseList(value) {
  const rawValue = String(value || '');
  const rawItems = rawValue.split(',');
  const normalizedItems = rawItems.map((item) => item.trim().toLowerCase());
  const parsedItems = normalizedItems.filter(Boolean);

  return parsedItems;
}

function getProfileReasons(profiles, reasonKey) {
  const reasons = [];

  if (!profiles || !reasonKey) {
    return reasons;
  }

  const profileList = Object.values(profiles || {});

  profileList.forEach((profile) => {
    if (!profile) {
      return;
    }

    const profileReasons = profile[reasonKey];

    if (!Array.isArray(profileReasons)) {
      return;
    }

    profileReasons.forEach((reason) => {
      if (reason) {
        reasons.push(reason);
      }
    });
  });

  return reasons;
}

function createSettingsFromProfile(profile) {
  const settings = {};
  const profileStateKeys = ['status', 'invalidReasons', 'disabledReason', 'disabledReasons'];

  Object.keys(profile || {}).forEach((key) => {
    const isProfileState = profileStateKeys.includes(key);

    if (!isProfileState) {
      settings[key] = profile[key];
    }
  });

  return settings;
}

function prepareConfig(inputs) {
  const videoProfile = resolveVideoProfile(inputs);
  const audioProfile = resolveProfile(AUDIO_PROFILES, inputs.audioProfile, 'audioProfile');
  const subtitleProfile = resolveProfile(SUBTITLE_PROFILES, inputs.subtitleProfile, 'subtitleProfile');
  const metadataProfile = resolveProfile(METADATA_PROFILES, inputs.metadataProfile, 'metadataProfile');
  const profiles = {
    video: videoProfile,
    audio: audioProfile,
    subtitle: subtitleProfile,
    metadata: metadataProfile,
  };
  const validationErrors = getProfileReasons(profiles, 'invalidReasons');
  const disabledReasons = getProfileReasons(profiles, 'disabledReasons');
  const audioLanguageOrder = parseList(inputs.audioLanguages);
  const subtitleLanguageOrder = parseList(inputs.subtitleLanguages);
  const videoSettings = createSettingsFromProfile(videoProfile);
  const audioSettings = createSettingsFromProfile(audioProfile);
  const subtitleSettings = createSettingsFromProfile(subtitleProfile);
  const metadataSettings = createSettingsFromProfile(metadataProfile);

  const config = {
    isInvalid: validationErrors.length > 0,
    messages: {
      validationErrors,
      disabledReasons,
    },
    settings: {
      logLevel: inputs.logLevel || 'normal',
      dryRun: inputs.dryRun === true || inputs.dryRun === 'true',
      originalLanguageLookup: inputs.originalLanguageLookup,
      output: {
        container: 'mkv',
      },
      languageOrder: {
        audio: audioLanguageOrder,
        subtitle: subtitleLanguageOrder,
        video: audioLanguageOrder[0] || 'und',
      },
      video: videoSettings,
      audio: audioSettings,
      subtitle: subtitleSettings,
      metadata: metadataSettings,
    },
  };

  return config;
}

function createContext(file, librarySettings, config, otherArguments) {
  const context = {
    file,
    librarySettings,
    otherArguments,
    settings: config.settings,
    messages: config.messages,
    isInvalid: config.isInvalid,
    response: {
      processFile: false,
      preset: '',
      container: '.mkv',
      handBrakeMode: false,
      FFmpegMode: true,
      reQueueAfter: false,
    },
    log: createLog(config.settings.logLevel),
    analysis: null,
    plan: null,
  };

  return context;
}

module.exports = {
  loadInputs,
  prepareConfig,
  createContext,
};
