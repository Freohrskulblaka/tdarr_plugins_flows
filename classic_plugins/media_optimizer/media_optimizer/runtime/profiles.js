/*
 * Media Optimizer Runtime Profiles
 * Created by: Freohrskulblaka
 * Created on: 2026-08-06
 * Description: Resolves named Media Optimizer profiles into validated runtime settings.
 */

const PROFILE_STATUS = {enabled: 'enabled', disabled: 'disabled', invalid: 'invalid'};

const VIDEO_PROFILES = {
  Balanced: { status: PROFILE_STATUS.enabled, encoderPreset: 'slow', bitDepth: '10-Bit', fullHdCompressionRate: '0.101', fourKCompressionRate: '0.08', hdrPolicy: 'preserveSignaling' },
  'Archive Quality': { status: PROFILE_STATUS.enabled, encoderPreset: 'slow', bitDepth: '10-Bit', fullHdCompressionRate: '0.12', fourKCompressionRate: '0.10', hdrPolicy: 'preserveSignaling' },
  'Smaller Files': { status: PROFILE_STATUS.enabled, encoderPreset: 'medium', bitDepth: '10-Bit', fullHdCompressionRate: '0.08', fourKCompressionRate: '0.06', hdrPolicy: 'preserveSignaling' },
};

const VIDEO_RESOLUTION_PROFILES = {
  'Keep Native Resolution': { status: PROFILE_STATUS.enabled, upscaleTo1080p: false, downscale4k: false },
  'Upscale Below 1080p': { status: PROFILE_STATUS.enabled, upscaleTo1080p: true, downscale4k: false },
  'Downscale 4K to 1080p': { status: PROFILE_STATUS.enabled, upscaleTo1080p: false, downscale4k: true },
  'Normalize to 1080p': { status: PROFILE_STATUS.enabled, upscaleTo1080p: true, downscale4k: true },
};

const VIDEO_CODEC_PROFILES = {
  'H.265 / HEVC - NVIDIA GPU': { status: PROFILE_STATUS.enabled, targetCodec: 'hevc', encoder: 'hevc_nvenc', encoderFamily: 'nvidia' },
  'H.265 / HEVC - CPU': { status: PROFILE_STATUS.enabled, targetCodec: 'hevc', encoder: 'libx265', encoderFamily: 'cpu' },
  'H.265 / HEVC - Intel GPU': { status: PROFILE_STATUS.enabled, targetCodec: 'hevc', encoder: 'hevc_qsv', encoderFamily: 'intel' },
  'H.265 / HEVC - AMD GPU': { status: PROFILE_STATUS.enabled, targetCodec: 'hevc', encoder: 'hevc_amf', encoderFamily: 'amd' },
  'Copy Video': { status: PROFILE_STATUS.enabled, targetCodec: 'copy', encoder: 'copy', encoderFamily: 'copy' },
};

const AUDIO_PROFILES = {
  'Compatibility 5.1 + Stereo': { preserveOriginals: false, keepBestSurround: '', createMissingFiveOne: true, createMissingStereo: true },
  'Best 5.1 + Compatibility': { preserveOriginals: false, keepBestSurround: '5.1', createMissingFiveOne: true, createMissingStereo: true },
  'Best 7.1 + Compatibility': { preserveOriginals: false, keepBestSurround: '7.1', createMissingFiveOne: true, createMissingStereo: true },
  'Preserve All + Compatibility': { preserveOriginals: true, keepBestSurround: '', createMissingFiveOne: true, createMissingStereo: true },
  'Stereo Only': { preserveOriginals: false, keepBestSurround: '', createMissingFiveOne: false, createMissingStereo: true },
  'Preserve Original Audio': { preserveOriginals: true, keepBestSurround: '', createMissingFiveOne: false, createMissingStereo: false },
};

const SUBTITLE_PROFILES = {
  'Picture First + Text': { includeOriginalLanguage: false, pictureFirst: true, importExternalSubtitles: true },
  'Include Original Language': { includeOriginalLanguage: true, pictureFirst: true, importExternalSubtitles: true },
  'Text First': { includeOriginalLanguage: false, pictureFirst: false, importExternalSubtitles: true },
  'Text Only': { includeOriginalLanguage: false, pictureFirst: false, importExternalSubtitles: false, textOnly: true },
};

const METADATA_PROFILES = {
  Clean: {stripGlobalTags: true, removeExtraTagStreams: true, removeFileTitle: true, removeVideoTitles: true, generateMissingChapters: true},
  Preserve: {stripGlobalTags: false, removeExtraTagStreams: false, removeFileTitle: false, removeVideoTitles: false, generateMissingChapters: false},
};

function createProfileConfig(inputs) {
  const resolvedProfiles = resolveProfiles(inputs);
  const profileSettings = createProfileSettings(resolvedProfiles.profiles);
  const profileConfig = {
    profiles: resolvedProfiles.profiles,
    messages: {
      validationErrors: resolvedProfiles.validationErrors,
      disabledReasons: resolvedProfiles.disabledReasons,
    },
    settings: profileSettings,
  };

  return profileConfig;
}

function resolveProfiles(inputs) {
  const resolveSelectedProfile = (profileMap, selectedName, inputName) => {
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
      disabledReasons: profile.disabledReasons || [],
    });

    return resolvedProfile;
  };

  const codecProfile = resolveSelectedProfile(VIDEO_CODEC_PROFILES, inputs.videoCodec, 'videoCodec');
  const qualityProfile = resolveSelectedProfile(VIDEO_PROFILES, inputs.videoQualityProfile, 'videoQualityProfile');
  const resolutionProfile = resolveSelectedProfile(VIDEO_RESOLUTION_PROFILES, inputs.videoResolution, 'videoResolution');
  const audioProfile = resolveSelectedProfile(AUDIO_PROFILES, inputs.audioProfile, 'audioProfile');
  const subtitleProfile = resolveSelectedProfile(SUBTITLE_PROFILES, inputs.subtitleProfile, 'subtitleProfile');
  const metadataProfile = resolveSelectedProfile(METADATA_PROFILES, inputs.metadataProfile, 'metadataProfile');
  const invalidVideoReasons = [...qualityProfile.invalidReasons, ...resolutionProfile.invalidReasons, ...codecProfile.invalidReasons];
  const disabledVideoReasons = [...qualityProfile.disabledReasons, ...resolutionProfile.disabledReasons, ...codecProfile.disabledReasons];
  const resolvedStatus = disabledVideoReasons.length > 0 ? PROFILE_STATUS.disabled : PROFILE_STATUS.enabled;
  let videoProfile;

  if (invalidVideoReasons.length > 0) {
    videoProfile = {
      status: PROFILE_STATUS.invalid,
      invalidReasons: invalidVideoReasons,
      disabledReasons: [],
    };
  } else if (codecProfile.targetCodec === 'copy') {
    videoProfile = Object.assign({}, qualityProfile, resolutionProfile, codecProfile, {
      status: resolvedStatus,
      disabledReasons: disabledVideoReasons,
      encoderPreset: 'copy',
      bitDepth: 'source',
    });
  } else {
    videoProfile = Object.assign({}, qualityProfile, resolutionProfile, codecProfile, {
      status: resolvedStatus,
      invalidReasons: invalidVideoReasons,
      disabledReasons: disabledVideoReasons,
    });
  }

  const profiles = {
    video: videoProfile,
    audio: audioProfile,
    subtitle: subtitleProfile,
    metadata: metadataProfile,
  };
  const validationErrors = [...videoProfile.invalidReasons, ...audioProfile.invalidReasons, ...subtitleProfile.invalidReasons, ...metadataProfile.invalidReasons];
  const disabledReasons = [...videoProfile.disabledReasons, ...audioProfile.disabledReasons, ...subtitleProfile.disabledReasons, ...metadataProfile.disabledReasons];

  const resolvedProfiles = {
    profiles,
    validationErrors,
    disabledReasons,
  };

  return resolvedProfiles;
}

function createProfileSettings(profiles) {
  const settings = {};
  const profileStateKeys = ['status', 'invalidReasons', 'disabledReasons'];

  Object.keys(profiles || {}).forEach((profileName) => {
    const profile = profiles[profileName] || {};
    const profileSettings = {};

    Object.keys(profile).forEach((key) => {
      const isProfileState = profileStateKeys.includes(key);

      if (!isProfileState) {
        profileSettings[key] = profile[key];
      }
    });

    settings[profileName] = profileSettings;
  });

  return settings;
}

module.exports = {
  createProfileConfig,
};
