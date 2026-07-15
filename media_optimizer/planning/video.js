/*
 * Media Optimizer Video Planning Library
 * Created by: Freohrskulblaka
 * Created on: 2026-06-30
 * Description: Builds video processing decisions from normalized analysis and video profile settings.
 * Updates:
 * - 2026-06-30 - Freohrskulblaka:
 *   - Created first-pass video planning helper for copy/transcode/remove decisions.
 *   - Added image-stream classification and primary playback stream selection.
 * - 2026-07-01 - Freohrskulblaka:
 *   - Added HDR, resolution class, and target bitrate planning facts.
 *   - Updated bitrate planning to consume normalized analysis facts.
 * - 2026-07-06 - Freohrskulblaka:
 *   - Limited target bitrate planning to the primary playback video stream.
 *   - Nested bitrate options and selected bitrate profile.
 *   - Refactored video decisions to return planned track objects.
 *   - Mirrored current 4K, HDR signaling, NVENC rate-control, and pixel-format planning.
 */

function planVideo(context) {
  const videoStreams = context.analysis.streams.video.items;
  const tracks = [];
  const reasons = [];

  if (videoStreams.length === 0) {
    reasons.push('No video streams were found.');
    return { tracks, reasons, shouldProcess: false };
  }

  const primaryVideoStream = selectPrimaryVideoStream(videoStreams);

  if (!primaryVideoStream) {
    reasons.push('No playback video streams were found.');
    return { tracks, reasons, shouldProcess: false };
  }

  videoStreams.forEach((stream, streamIndex) => {
    const isPrimaryVideo = primaryVideoStream && stream.index === primaryVideoStream.index;
    const track = createVideoTrack(context, stream, streamIndex, isPrimaryVideo);
    const trackDecision = applyVideoTrackDecision(track, context, isPrimaryVideo);

    tracks.push(trackDecision);
    reasons.push(...trackDecision.reasons);
  });

  const shouldProcess = tracks.some((track) => track.action !== 'copy');
  const videoPlan = {
    tracks,
    reasons,
    shouldProcess,
  };

  return videoPlan;
}

function selectPrimaryVideoStream(videoStreams) {
  const getPixelCount = (stream) => {
    const streamFacts = stream.analysis || {};
    const width = Number(streamFacts.width || 0);
    const height = Number(streamFacts.height || 0);
    const pixelCount = width * height;

    return pixelCount;
  };
  const playbackStreams = videoStreams.filter((stream) => !stream.analysis?.isImageStream);
  const sortedStreams = playbackStreams.slice().sort((left, right) => {
    const pixelCompare = getPixelCount(right) - getPixelCount(left);

    if (pixelCompare !== 0) {
      return pixelCompare;
    }

    const defaultCompare = Number(right.disposition?.default || 0) - Number(left.disposition?.default || 0);

    if (defaultCompare !== 0) {
      return defaultCompare;
    }

    return Number(left.index || 0) - Number(right.index || 0);
  });
  const primaryStream = sortedStreams[0] || null;

  return primaryStream;
}

function createVideoTrack(context, stream, outputIndex, isPrimaryVideo) {
  const streamFacts = stream.analysis || {};
  const bitrateInfo = streamFacts.bitRate || { value: 0, source: 'missing', isEstimated: true };
  const frameRateInfo = streamFacts.frameRate || { value: 0, source: 'missing' };
  const sourceCodec = stream.codec_name || 'unknown';
  const bitrate = isPrimaryVideo
    ? createBitratePlan({
      width: streamFacts.width || 0,
      height: streamFacts.height || 0,
      frameRate: frameRateInfo.value,
      bitRate: bitrateInfo.value,
      bitrateSource: bitrateInfo.source,
      frameRateSource: frameRateInfo.source,
      isEstimated: bitrateInfo.isEstimated,
      settings: context.settings.video,
    })
    : null;
  const track = {
    sourceIndex: stream.index,
    outputIndex,
    codec: normalizeVideoCodec(sourceCodec),
    sourceCodec,
    targetCodec: normalizeVideoCodec(context.settings.video.targetCodec),
    encoder: context.settings.video.encoder,
    language: stream.tags?.language || context.settings.languageOrder.video,
    width: streamFacts.width || 0,
    height: streamFacts.height || 0,
    frameRate: frameRateInfo.value,
    bitrate,
    resolution: streamFacts.resolution || {},
    hdr: streamFacts.hdr || {},
    isImageStream: Boolean(streamFacts.isImageStream),
    action: isPrimaryVideo ? 'copy' : 'remove',
    default: isPrimaryVideo,
    reasons: [],
    ffmpeg: {
      map: `0:${stream.index}`,
      codec: 'copy',
      filters: [],
      args: [],
    },
  };

  return track;
}

function applyVideoTrackDecision(track, context, isPrimaryVideo) {
  const settings = context.settings.video;

  if (track.isImageStream) {
    return Object.assign({}, track, {
      action: 'remove',
      reasons: ['Video stream is image-like cover/artwork content and will not be treated as playback video.'],
    });
  }

  if (!isPrimaryVideo) {
    return Object.assign({}, track, {
      action: 'remove',
      reasons: ['Additional video stream is not part of the target output plan.'],
    });
  }

  if (settings.targetCodec === 'copy' || settings.mode === 'copy') {
    return Object.assign({}, track, {
      action: 'copy',
      reasons: ['Video profile is configured to copy video.'],
    });
  }

  const trackDecision = applyVideoCompatibilityDecision(track, context);

  return trackDecision;
}

function applyVideoCompatibilityDecision(track, context) {
  const settings = context.settings.video;
  const ffmpeg = {
    map: track.ffmpeg.map,
    codec: track.ffmpeg.codec,
    filters: track.ffmpeg.filters.slice(),
    args: track.ffmpeg.args.slice(),
  };
  const bitrate = Object.assign({}, track.bitrate);
  const reasons = [];
  let action = track.action;
  const codecMatches = normalizeVideoCodec(track.codec) === normalizeVideoCodec(settings.targetCodec);
  const shouldUpscale = settings.upscaleTo1080p && track.resolution.isLowRes;
  const shouldDownscale4k = !settings.preserve4k && track.resolution.is4k;
  const shouldPreserve4k = settings.preserve4k && track.resolution.is4k;

  bitrate.selected = selectVideoBitrateProfile({
    bitrate,
    shouldUpscale,
    shouldDownscale4k,
    shouldPreserve4k,
  });

  const shouldTranscodeForBitrate = !bitrate.current.isEstimated
    && bitrate.selected.maxKbps > 0
    && bitrate.current.kbps > bitrate.selected.maxKbps;

  if (!codecMatches) {
    action = 'transcode';
    reasons.push(`Video codec ${track.codec} does not match target ${settings.targetCodec}.`);
  }

  if (shouldUpscale) {
    action = 'transcode';
    reasons.push('Video is below 1080p and upscale-to-1080p is enabled.');
    ffmpeg.filters.push('scale=1920:1080:flags=lanczos');
  }

  if (shouldDownscale4k) {
    action = 'transcode';
    reasons.push('Video is 4K and the selected profile does not preserve 4K resolution.');
    ffmpeg.filters.push('scale=1920:1080:flags=lanczos');
  }

  if (shouldPreserve4k) {
    reasons.push('Video is 4K and will be kept at native 4K resolution.');
  }

  if (shouldTranscodeForBitrate && !shouldUpscale && !shouldDownscale4k) {
    action = 'transcode';
    reasons.push(`Video bitrate ${bitrate.current.kbps}k from ${bitrate.current.source} is above target maximum ${bitrate.selected.maxKbps}k.`);
  }

  if (bitrate.current.isEstimated) {
    reasons.push('Video bitrate is a file-level estimate; bitrate-only transcode decisions are skipped.');
  }

  if (action === 'transcode') {
    const encoderArgs = createVideoEncoderArgs({ track, settings, bitrate });

    if (track.hdr.isHdr && settings.hdrPolicy === 'preserveSignaling') {
      reasons.push('HDR was detected; basic HDR signaling will be written during transcode.');
    }

    ffmpeg.codec = settings.encoder;
    ffmpeg.args.push(...encoderArgs);
  } else {
    reasons.push('Video is compatible with the selected target codec and profile.');
  }

  const trackDecision = Object.assign({}, track, {
    action,
    bitrate,
    ffmpeg,
    reasons,
  });

  return trackDecision;
}

function selectVideoBitrateProfile({ bitrate, shouldUpscale, shouldDownscale4k, shouldPreserve4k }) {
  let selectedProfile = bitrate.native;

  if (shouldUpscale || shouldDownscale4k) {
    selectedProfile = bitrate.fullHd;
  } else if (shouldPreserve4k) {
    selectedProfile = bitrate.full4k;
  }

  return selectedProfile;
}

function createVideoEncoderArgs({ track, settings, bitrate }) {
  const args = [];
  const rateControlArgs = createVideoRateControlArgs({ settings, bitrate });
  const profileArgs = createVideoProfileArgs(settings);
  const hdrArgs = createVideoHdrArgs(track, settings);

  args.push(...rateControlArgs);

  if (settings.encoderFamily === 'nvidia') {
    args.push('-spatial_aq:v', '1');
    args.push('-aq-strength:v', '15');
    args.push('-temporal-aq', '1');
    args.push('-bf', '5');
    args.push('-preset:v', settings.encoderPreset);
    args.push('-tune:v', 'hq');
  } else if (settings.encoderFamily === 'amd') {
    args.push('-quality', resolveAmdQualityPreset(settings.encoderPreset));
  } else {
    args.push('-preset', settings.encoderPreset);
  }

  args.push(...profileArgs);
  args.push(...hdrArgs);

  return args;
}

function createVideoRateControlArgs({ settings, bitrate }) {
  const args = [];
  const selectedBitrate = bitrate.selected;
  const bufferSizeKbps = bitrate.current.kbps > 0 ? bitrate.current.kbps : selectedBitrate.maxKbps;

  if (settings.encoderFamily === 'nvidia') {
    args.push('-cq:v', '19');
    args.push('-b:v', `${selectedBitrate.targetKbps}k`);
    args.push('-minrate', `${selectedBitrate.minKbps}k`);
    args.push('-maxrate', `${selectedBitrate.maxKbps}k`);
    args.push('-bufsize', `${bufferSizeKbps}k`);
    args.push('-rc:v', 'vbr');
    args.push('-rc-lookahead:v', '32');
    return args;
  }

  args.push('-b:v', `${selectedBitrate.targetKbps}k`);
  args.push('-maxrate', `${selectedBitrate.maxKbps}k`);
  args.push('-bufsize', `${bufferSizeKbps}k`);

  if (settings.encoderFamily === 'cpu') {
    args.push('-minrate', `${selectedBitrate.minKbps}k`);
  }

  return args;
}

function resolveAmdQualityPreset(encoderPreset) {
  const qualityMap = {
    slow: 'quality',
    medium: 'balanced',
    fast: 'speed',
  };
  const qualityPreset = qualityMap[encoderPreset] || 'quality';

  return qualityPreset;
}

function createVideoProfileArgs(settings) {
  const args = [];
  const profileSettings = resolveVideoProfileArgs(settings);

  if (profileSettings.profile) {
    args.push('-profile:v', profileSettings.profile);
  }

  if (profileSettings.pixelFormat) {
    args.push('-pix_fmt', profileSettings.pixelFormat);
  }

  return args;
}

function resolveVideoProfileArgs(settings) {
  const encoderFamily = settings.encoderFamily || 'unknown';
  const targetCodec = settings.targetCodec || 'unknown';
  const wantsTenBit = settings.bitDepth === '10-Bit';
  const normalizedProfile = normalizeVideoProfile(settings.encodingProfile, targetCodec, wantsTenBit);
  const pixelFormat = resolveVideoPixelFormat({ encoderFamily, targetCodec, wantsTenBit });
  const profileSettings = {
    profile: normalizedProfile,
    pixelFormat,
  };

  return profileSettings;
}

function normalizeVideoProfile(profile, targetCodec, wantsTenBit) {
  const normalizedTargetCodec = normalizeVideoCodec(targetCodec);
  let normalizedProfile = profile || '';

  if (normalizedTargetCodec === 'hevc' && wantsTenBit) {
    normalizedProfile = 'main10';
  }

  if (normalizedTargetCodec === 'hevc' && normalizedProfile === 'high') {
    normalizedProfile = wantsTenBit ? 'main10' : 'main';
  }

  if (normalizedTargetCodec === 'h264' && normalizedProfile === 'main10') {
    normalizedProfile = 'high';
  }

  return normalizedProfile;
}

function resolveVideoPixelFormat({ encoderFamily, targetCodec, wantsTenBit }) {
  const hardwareEncoderFamilies = ['nvidia', 'intel', 'amd'];
  const normalizedTargetCodec = normalizeVideoCodec(targetCodec);
  let pixelFormat = '';

  if (wantsTenBit && normalizedTargetCodec === 'hevc' && hardwareEncoderFamilies.includes(encoderFamily)) {
    pixelFormat = 'p010le';
  }

  if (wantsTenBit && normalizedTargetCodec === 'hevc' && encoderFamily === 'cpu') {
    pixelFormat = 'yuv420p10le';
  }

  if (!wantsTenBit && normalizedTargetCodec === 'hevc') {
    pixelFormat = 'yuv420p';
  }

  if (!wantsTenBit && normalizedTargetCodec === 'h264') {
    pixelFormat = 'yuv420p';
  }

  return pixelFormat;
}

function normalizeVideoCodec(codec) {
  const value = String(codec || '').toLowerCase();
  const codecAliases = {
    h265: 'hevc',
    x265: 'hevc',
    avc: 'h264',
    x264: 'h264',
  };
  const normalizedCodec = codecAliases[value] || value;

  return normalizedCodec;
}

function createVideoHdrArgs(track, settings) {
  const args = [];
  const shouldPreserveHdr = track.hdr.isHdr && settings.hdrPolicy === 'preserveSignaling';

  if (shouldPreserveHdr) {
    args.push('-level', '5.1');
    args.push('-color_primaries', 'bt2020');
    args.push('-color_trc', 'smpte2084');
    args.push('-colorspace', 'bt2020nc');
  }

  return args;
}

function createBitratePlan({ width, height, frameRate, bitRate, bitrateSource, frameRateSource, isEstimated, settings }) {
  const createTargetProfile = (name, targetKbps) => {
    const targetProfile = {
      name,
      targetKbps,
      minKbps: roundToNearestHundred(targetKbps * 0.75),
      maxKbps: roundToNearestHundred(targetKbps * 1.25),
    };

    return targetProfile;
  };
  const targetCompressionRate = Number(settings.targetCompressionRate || 0);
  const adjustedCompressionRate = targetCompressionRate * (normalizeVideoCodec(settings.targetCodec) === 'hevc' ? 0.65 : 1);
  const currentKbps = Math.floor(bitRate / 1000);
  const native = createTargetProfile('native', calculateOptimalBitrate(width, height, frameRate, adjustedCompressionRate));
  const fullHd = createTargetProfile('fullHd', calculateOptimalBitrate(1920, 1080, frameRate, adjustedCompressionRate));
  const full4k = createTargetProfile('full4k', calculateOptimalBitrate(3840, 2160, frameRate, adjustedCompressionRate));
  const bitrate = {
    current: {
      kbps: currentKbps,
      source: bitrateSource,
      frameRateSource,
      isEstimated: Boolean(isEstimated),
    },
    native,
    fullHd,
    full4k,
    selected: native,
  };

  return bitrate;
}

function calculateOptimalBitrate(width, height, frameRate, targetCompressionRate) {
  const hasCalculationInputs = width > 0 && height > 0 && frameRate > 0 && targetCompressionRate > 0;

  if (!hasCalculationInputs) {
    return 0;
  }

  const optimalBitrate = roundToNearestHundred(((width * height * frameRate) * targetCompressionRate) / 1000);

  return optimalBitrate;
}

function roundToNearestHundred(value) {
  return Math.round(Number(value || 0) / 100) * 100;
}

module.exports = {
  planVideo,
};
