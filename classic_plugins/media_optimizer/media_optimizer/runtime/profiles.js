/*
 * Media Optimizer Runtime Profiles
 * Created by: Freohrskulblaka
 * Created on: 2026-08-06
 * Description: Resolves named Media Optimizer profiles into validated runtime settings.
 */

const PROFILE_STATUS = {enabled: 'enabled', disabled: 'disabled', invalid: 'invalid'};

const VIDEO_PROFILES = {
  'Balanced 1080p': { status: PROFILE_STATUS.enabled, mode: 'balanced', encoderPreset: 'slow', encodingProfile: 'main10', bitDepth: '10-Bit', targetCompressionRate: '0.101', upscaleTo1080p: true, preserve4k: true, hdrPolicy: 'preserveSignaling' },
  'Archive Quality': { status: PROFILE_STATUS.enabled, mode: 'archive', encoderPreset: 'slow', encodingProfile: 'main10', bitDepth: '10-Bit', targetCompressionRate: '0.12', upscaleTo1080p: false, preserve4k: true, hdrPolicy: 'preserveSignaling' },
  'Smaller Files': { status: PROFILE_STATUS.enabled, mode: 'small', encoderPreset: 'medium', encodingProfile: 'main10', bitDepth: '10-Bit', targetCompressionRate: '0.08', upscaleTo1080p: false, preserve4k: true, hdrPolicy: 'preserveSignaling' },
  'Compress 4K Preserve HDR Signaling': { status: PROFILE_STATUS.enabled, mode: 'compress4k', encoderPreset: 'slow', encodingProfile: 'main10', bitDepth: '10-Bit', targetCompressionRate: '0.101', upscaleTo1080p: false, preserve4k: true, hdrPolicy: 'preserveSignaling' },
  'Compress 4K to SDR Experimental (Disabled)': { status: PROFILE_STATUS.disabled, disabledReasons: ['HDR to SDR tonemapping has not been implemented yet.'], mode: 'compress4kToSdr', encoderPreset: 'slow', encodingProfile: 'main10', bitDepth: '10-Bit', targetCompressionRate: '0.09', upscaleTo1080p: false, preserve4k: false, hdrPolicy: 'toneMapToSdr' },
  'Skip HDR Transcode (Disabled)': { status: PROFILE_STATUS.disabled, disabledReasons: ['HDR detection and skip behavior has not been implemented yet.'], mode: 'skipIfHdr', encoderPreset: 'copy', encodingProfile: 'copy', bitDepth: 'source', targetCompressionRate: '0.101', upscaleTo1080p: false, preserve4k: true, hdrPolicy: 'skipIfHdr' },
  'Copy When Compatible': { status: PROFILE_STATUS.enabled, mode: 'copyCompatible', encoderPreset: 'slow', encodingProfile: 'main10', bitDepth: '10-Bit', targetCompressionRate: '0.101', upscaleTo1080p: false, preserve4k: true, hdrPolicy: 'preserveSignaling' },
};

const VIDEO_CODEC_PROFILES = {
  'H.265 / HEVC - NVIDIA GPU': { status: PROFILE_STATUS.enabled, targetCodec: 'hevc', encoder: 'hevc_nvenc', encoderFamily: 'nvidia' },
  'H.265 / HEVC - CPU (Disabled)': { status: PROFILE_STATUS.disabled, disabledReasons: ['CPU HEVC encoding support has not been implemented yet.'], targetCodec: 'hevc', encoder: 'libx265', encoderFamily: 'cpu' },
  'H.265 / HEVC - Intel GPU (Disabled)': { status: PROFILE_STATUS.disabled, disabledReasons: ['Intel QSV HEVC encoding support has not been implemented yet.'], targetCodec: 'hevc', encoder: 'hevc_qsv', encoderFamily: 'intel' },
  'H.265 / HEVC - AMD GPU (Disabled)': { status: PROFILE_STATUS.disabled, disabledReasons: ['AMD AMF HEVC encoding support has not been implemented yet.'], targetCodec: 'hevc', encoder: 'hevc_amf', encoderFamily: 'amd' },
  'H.264 - NVIDIA GPU (Disabled)': { status: PROFILE_STATUS.disabled, disabledReasons: ['H.264 NVIDIA encoding support has not been implemented yet.'], targetCodec: 'h264', encoder: 'h264_nvenc', encoderFamily: 'nvidia' },
  'H.264 - CPU (Disabled)': { status: PROFILE_STATUS.disabled, disabledReasons: ['CPU H.264 encoding support has not been implemented yet.'], targetCodec: 'h264', encoder: 'libx264', encoderFamily: 'cpu' },
  'H.264 - Intel GPU (Disabled)': { status: PROFILE_STATUS.disabled, disabledReasons: ['Intel QSV H.264 encoding support has not been implemented yet.'], targetCodec: 'h264', encoder: 'h264_qsv', encoderFamily: 'intel' },
  'H.264 - AMD GPU (Disabled)': { status: PROFILE_STATUS.disabled, disabledReasons: ['AMD AMF H.264 encoding support has not been implemented yet.'], targetCodec: 'h264', encoder: 'h264_amf', encoderFamily: 'amd' },
  'Copy Video': { status: PROFILE_STATUS.enabled, targetCodec: 'copy', encoder: 'copy', encoderFamily: 'copy' },
};

const AUDIO_PROFILES = {
  'Keep 5.1 and Stereo': { keepSevenOne: false, createMissingFiveOne: true, createMissingStereo: true, removeCommentary: true },
  'Keep 7.1, 5.1, and Stereo': { keepSevenOne: true, createMissingFiveOne: true, createMissingStereo: true, removeCommentary: true },
  'Stereo Only': { keepSevenOne: false, createMissingFiveOne: false, createMissingStereo: true, removeCommentary: true },
  'Preserve Audio': { keepSevenOne: true, createMissingFiveOne: false, createMissingStereo: false, removeCommentary: true },
};

const SUBTITLE_PROFILES = {
  'Picture First + Text': { includeOriginalLanguage: false, pictureFirst: true, importExternalSubtitles: true },
  'Include Original Language': { includeOriginalLanguage: true, pictureFirst: true, importExternalSubtitles: true },
  'Text First': { includeOriginalLanguage: false, pictureFirst: false, importExternalSubtitles: true },
  'Text Only': { includeOriginalLanguage: false, pictureFirst: false, importExternalSubtitles: false, textOnly: true },
};

const METADATA_PROFILES = {
  Clean: {stripGlobalTags: true, removeExtraTagStreams: true, removeFileTitle: true, removeVideoTitles: true},
  Preserve: {stripGlobalTags: false, removeExtraTagStreams: false, removeFileTitle: false, removeVideoTitles: false},
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
  const audioProfile = resolveSelectedProfile(AUDIO_PROFILES, inputs.audioProfile, 'audioProfile');
  const subtitleProfile = resolveSelectedProfile(SUBTITLE_PROFILES, inputs.subtitleProfile, 'subtitleProfile');
  const metadataProfile = resolveSelectedProfile(METADATA_PROFILES, inputs.metadataProfile, 'metadataProfile');
  const invalidVideoReasons = [...qualityProfile.invalidReasons, ...codecProfile.invalidReasons];
  const disabledVideoReasons = [...qualityProfile.disabledReasons, ...codecProfile.disabledReasons];
  const resolvedStatus = disabledVideoReasons.length > 0 ? PROFILE_STATUS.disabled : PROFILE_STATUS.enabled;
  let videoProfile;

  if (invalidVideoReasons.length > 0) {
    videoProfile = {
      status: PROFILE_STATUS.invalid,
      invalidReasons: invalidVideoReasons,
      disabledReasons: [],
    };
  } else if (codecProfile.targetCodec === 'copy') {
    videoProfile = Object.assign({}, qualityProfile, codecProfile, {
      status: resolvedStatus,
      disabledReasons: disabledVideoReasons,
      mode: 'copy',
      encoderPreset: 'copy',
      encodingProfile: 'copy',
      bitDepth: 'source',
    });
  } else {
    videoProfile = Object.assign({}, qualityProfile, codecProfile, {
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
