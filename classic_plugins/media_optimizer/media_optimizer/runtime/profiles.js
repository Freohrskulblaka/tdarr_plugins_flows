/*
 * Media Optimizer Runtime Profiles
 * Created by: Freohrskulblaka
 * Created on: 2026-08-06
 * Description: Resolves named Media Optimizer profiles into validated runtime settings.
 */

const VIDEO_PROFILES = {
  Balanced: {encoderPreset: 'slow', bitDepth: '10-Bit', fullHdCompressionRate: '0.101', fourKCompressionRate: '0.08'},
  'Archive Quality': {encoderPreset: 'slow', bitDepth: '10-Bit', fullHdCompressionRate: '0.12', fourKCompressionRate: '0.10'},
  'Smaller Files': {encoderPreset: 'medium', bitDepth: '10-Bit', fullHdCompressionRate: '0.08', fourKCompressionRate: '0.06'},
};

const VIDEO_RESOLUTION_PROFILES = {
  'Keep Native Resolution': {upscaleTo1080p: false, downscale4k: false},
  'Upscale Below 1080p': {upscaleTo1080p: true, downscale4k: false},
  'Downscale 4K to 1080p': {upscaleTo1080p: false, downscale4k: true},
  'Normalize to 1080p': {upscaleTo1080p: true, downscale4k: true},
};

const VIDEO_CODEC_PROFILES = {
  'H.265 / HEVC - NVIDIA GPU': {targetCodec: 'hevc', encoder: 'hevc_nvenc', encoderFamily: 'nvidia'},
  'H.265 / HEVC - CPU': {targetCodec: 'hevc', encoder: 'libx265', encoderFamily: 'cpu'},
  'H.265 / HEVC - Intel GPU': {targetCodec: 'hevc', encoder: 'hevc_qsv', encoderFamily: 'intel'},
  'H.265 / HEVC - AMD GPU': {targetCodec: 'hevc', encoder: 'hevc_amf', encoderFamily: 'amd'},
  'Copy Video': {targetCodec: 'copy', encoder: 'copy', encoderFamily: 'copy'},
};

const HDR_HANDLING_PROFILES = {
  'Auto Preserve HDR': {hdrPolicy: 'autoPreserve'},
  'Copy HDR Video': {hdrPolicy: 'copyHdr'},
  'Compress And Restore Dynamic HDR': {hdrPolicy: 'restoreDynamic'},
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
  const validationErrors = [];
  const resolveSelectedProfile = (profileMap, selectedName, inputName) => {
    const profile = profileMap[selectedName];

    if (!profile) {
      validationErrors.push(`Invalid ${inputName}: ${selectedName || '(empty)'}`);
      return {};
    }

    return {...profile};
  };

  const codecProfile = resolveSelectedProfile(VIDEO_CODEC_PROFILES, inputs.videoCodec, 'videoCodec');
  const qualityProfile = resolveSelectedProfile(VIDEO_PROFILES, inputs.videoQualityProfile, 'videoQualityProfile');
  const resolutionProfile = resolveSelectedProfile(VIDEO_RESOLUTION_PROFILES, inputs.videoResolution, 'videoResolution');
  const hdrProfile = resolveSelectedProfile(HDR_HANDLING_PROFILES, inputs.hdrHandling, 'hdrHandling');
  const audioProfile = resolveSelectedProfile(AUDIO_PROFILES, inputs.audioProfile, 'audioProfile');
  const subtitleProfile = resolveSelectedProfile(SUBTITLE_PROFILES, inputs.subtitleProfile, 'subtitleProfile');
  const metadataProfile = resolveSelectedProfile(METADATA_PROFILES, inputs.metadataProfile, 'metadataProfile');
  const videoProfile = {
    ...qualityProfile,
    ...resolutionProfile,
    ...codecProfile,
    ...hdrProfile,
    ...(codecProfile.targetCodec === 'copy' ? {
      encoderPreset: 'copy',
      bitDepth: 'source',
    } : {}),
  };

  return {
    messages: {validationErrors},
    settings: {
      video: videoProfile,
      audio: audioProfile,
      subtitle: subtitleProfile,
      metadata: metadataProfile,
    },
  };
}

module.exports = {
  createProfileConfig,
};
