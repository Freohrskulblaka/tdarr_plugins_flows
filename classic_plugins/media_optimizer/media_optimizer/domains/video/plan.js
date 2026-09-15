/*
 * Media Optimizer Video Planning Library
 * Created by: Freohrskulblaka
 * Created on: 2026-06-30
 * Description: Builds video processing decisions from normalized analysis and video profile settings.
 */

const H264_TO_HEVC_BITRATE_FACTOR = 0.65;

function planVideo(context) {
  const videoStreams = context.analysis.streams.video.items;
  const tracks = [];
  const reasons = [];
  let outputIndex = 0;

  if (videoStreams.length === 0) {
    reasons.push('No video streams were found.');
    return { tracks, reasons, shouldProcess: false };
  }

  const primaryVideoStream = selectPrimaryVideoStream(videoStreams);

  if (!primaryVideoStream) {
    reasons.push('No playback video streams were found.');
    return { tracks, reasons, shouldProcess: false };
  }

  videoStreams.forEach((stream) => {
    const isPrimaryVideo = primaryVideoStream && stream.index === primaryVideoStream.index;
    const track = createVideoTrack(context, stream, isPrimaryVideo);
    const trackDecision = applyVideoTrackDecision(track, context, isPrimaryVideo);

    if (trackDecision.action !== 'remove') {
      trackDecision.outputIndex = outputIndex;
      outputIndex += 1;
    }

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

function createVideoTrack(context, stream, isPrimaryVideo) {
  const streamFacts = stream.analysis || {};
  const bitrateInfo = streamFacts.bitRate || { value: 0, source: 'missing' };
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
      resolution: streamFacts.resolution || {},
      settings: context.settings.video,
    })
    : null;
  const track = {
    sourceIndex: stream.index,
    outputIndex: null,
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

  if (settings.targetCodec === 'copy') {
    return Object.assign({}, track, {
      action: 'copy',
      reasons: ['Video profile is configured to copy video.'],
    });
  }

  if (track.hdr.isHdr && settings.hdrPolicy === 'copyHdr') {
    return Object.assign({}, track, {
      action: 'copy',
      reasons: ['HDR handling is configured to copy HDR video without re-encoding it.'],
    });
  }

  if (track.hdr.hasDynamicMetadata) {
    return Object.assign({}, track, {
      action: 'copy',
      reasons: [`${track.hdr.type === 'dolbyVision' ? 'Dolby Vision' : 'HDR10+'} dynamic metadata requires a separate restoration workflow; the video will be copied so that metadata is not lost.`],
    });
  }

  const trackDecision = applyVideoCompatibilityDecision(track, context);

  return trackDecision;
}

function applyVideoCompatibilityDecision(track, context) {
  const settings = context.settings.video;
  const ffmpeg = {
    codec: track.ffmpeg.codec,
    filters: track.ffmpeg.filters.slice(),
    args: track.ffmpeg.args.slice(),
  };
  const bitrate = Object.assign({}, track.bitrate);
  const reasons = [];
  let action = track.action;
  const sourceCodec = normalizeVideoCodec(track.codec);
  const targetCodec = normalizeVideoCodec(settings.targetCodec);
  const codecMatches = sourceCodec === targetCodec;
  const shouldUpscale = settings.upscaleTo1080p && track.resolution.isLowRes;
  const shouldDownscale4k = settings.downscale4k && track.resolution.is4k;
  const selectedBitrate = shouldUpscale || shouldDownscale4k ? bitrate.fullHd : bitrate.native;

  bitrate.selected = Object.assign({}, selectedBitrate);

  if (sourceCodec === 'h264' && targetCodec === 'hevc' && !shouldUpscale && bitrate.current.kbps > 0) {
    const baselineKbps = Math.min(bitrate.selected.targetKbps, bitrate.current.kbps);
    const targetKbps = roundToNearestHundred(baselineKbps * H264_TO_HEVC_BITRATE_FACTOR);

    bitrate.selected = Object.assign({}, bitrate.selected, {
      targetKbps,
      maxKbps: roundToNearestHundred(targetKbps * 1.25),
      isHevcEfficiencyAdjusted: true,
      efficiencyBaselineKbps: baselineKbps,
      efficiencyFactor: H264_TO_HEVC_BITRATE_FACTOR,
    });
  } else if (!codecMatches && !shouldUpscale && bitrate.current.kbps > 0 && bitrate.selected.targetKbps > bitrate.current.kbps) {
    const cappedTargetKbps = roundToNearestHundred(bitrate.current.kbps);
    bitrate.selected = Object.assign({}, bitrate.selected, {
      targetKbps: cappedTargetKbps,
      maxKbps: roundToNearestHundred(cappedTargetKbps * 1.25),
      isSourceCapped: true,
    });
  }

  if (!bitrate.selected.isCalculable) {
    reasons.push('Video target bitrate could not be calculated; the video will be copied without codec or resolution changes.');
    return Object.assign({}, track, { action: 'copy', bitrate, ffmpeg, reasons });
  }

  const shouldTranscodeForBitrate = bitrate.current.kbps > bitrate.selected.maxKbps;

  if (!codecMatches) {
    action = 'transcode';
    reasons.push(`Video codec ${track.codec} does not match target ${settings.targetCodec}.`);
  }

  if (shouldUpscale) {
    action = 'transcode';
    reasons.push('Video is below 1080p and upscale-to-1080p is enabled.');
    ffmpeg.filters.push('scale=1920:1080:force_original_aspect_ratio=decrease:force_divisible_by=2:flags=lanczos');
    ffmpeg.filters.push('setsar=1');
  }

  if (shouldDownscale4k) {
    action = 'transcode';
    reasons.push('Video is 4K and the selected resolution policy limits output to 1080p.');
    ffmpeg.filters.push('scale=1920:1080:force_original_aspect_ratio=decrease:force_divisible_by=2:flags=lanczos');
    ffmpeg.filters.push('setsar=1');
  }

  if (shouldTranscodeForBitrate) {
    action = 'transcode';
    reasons.push(`Video bitrate ${bitrate.current.kbps}k from ${bitrate.current.source} is above target maximum ${bitrate.selected.maxKbps}k.`);
  }

  if (bitrate.selected.isSourceCapped) {
    reasons.push(`Video target was capped at the source video bitrate of ${bitrate.selected.targetKbps}k to prevent file growth.`);
  }

  if (bitrate.selected.isHevcEfficiencyAdjusted) {
    reasons.push(`H.264-to-HEVC target was set to ${bitrate.selected.targetKbps}k, or 65% of the lower ${bitrate.selected.efficiencyBaselineKbps}k profile/source bitrate baseline.`);
  }

  if (action === 'transcode') {
    const encoderArgs = createVideoEncoderArgs({ track, settings, bitrate });

    if (track.hdr.isHdr && settings.hdrPolicy === 'autoPreserve') {
      const hdrLabel = track.hdr.type === 'dolbyVision'
        ? `Dolby Vision Profile ${track.hdr.dolbyVisionProfile || 'unknown'}`
        : track.hdr.type.toUpperCase();
      reasons.push(`${hdrLabel} was detected; source color signaling will be written during transcode.`);
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

function createVideoEncoderArgs({ track, settings, bitrate }) {
  const selectedBitrate = bitrate.selected;
  const qualityMap = {
    slow: 'quality',
    medium: 'balanced',
    fast: 'speed',
  };
  const wantsTenBit = settings.bitDepth === '10-Bit';
  const familyArgs = {
    nvidia: ['-cq:v', '19', '-rc:v', 'vbr', '-rc-lookahead:v', '32', '-spatial_aq:v', '1', '-aq-strength:v', '15', '-temporal-aq', '1', '-bf', '5', '-preset:v', settings.encoderPreset, '-tune:v', 'hq'],
    intel: ['-preset:v', settings.encoderPreset],
    amd: ['-rc:v', 'vbr_peak', '-quality', qualityMap[settings.encoderPreset] || 'quality'],
    cpu: ['-preset:v', settings.encoderPreset],
  };
  const pixelFormat = wantsTenBit && settings.encoderFamily === 'cpu' ? 'yuv420p10le' : wantsTenBit ? 'p010le' : 'yuv420p';
  const args = [
    '-b:v', `${selectedBitrate.targetKbps}k`,
    '-maxrate', `${selectedBitrate.maxKbps}k`,
    '-bufsize', `${roundToNearestHundred(selectedBitrate.targetKbps * 2)}k`,
    ...(familyArgs[settings.encoderFamily] || []),
    '-profile:v', wantsTenBit ? 'main10' : 'main',
    '-pix_fmt', pixelFormat,
  ];
  const colorArgs = {
    colorPrimaries: '-color_primaries',
    colorTransfer: '-color_trc',
    colorSpace: '-colorspace',
  };

  if (settings.hdrPolicy === 'autoPreserve') {
    Object.entries(colorArgs).forEach(([property, option]) => {
      const value = track.hdr[property];

      if (value && !['unknown', 'unspecified', 'reserved'].includes(value)) {
        args.push(option, value);
      }
    });

    if (settings.encoderFamily === 'nvidia') {
      args.push('-extra_sei', '1');
    }
  }

  return args;
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

function createBitratePlan({ width, height, frameRate, bitRate, bitrateSource, frameRateSource, resolution, settings }) {
  const createTargetProfile = (name, targetWidth, targetHeight, compressionRate) => {
    const hasCalculationInputs = targetWidth > 0 && targetHeight > 0 && frameRate > 0 && compressionRate > 0;
    const targetKbps = hasCalculationInputs
      ? roundToNearestHundred(((targetWidth * targetHeight * frameRate) * compressionRate) / 1000)
      : 0;
    const targetProfile = {
      name,
      targetKbps,
      maxKbps: roundToNearestHundred(targetKbps * 1.25),
      isCalculable: targetKbps > 0,
    };

    return targetProfile;
  };
  const fullHdCompressionRate = Number(settings.fullHdCompressionRate || 0);
  const nativeCompressionRate = resolution.is4k
    ? Number(settings.fourKCompressionRate || 0)
    : fullHdCompressionRate;
  const currentKbps = Math.floor(bitRate / 1000);
  const native = createTargetProfile('native', width, height, nativeCompressionRate);
  const fullHd = createTargetProfile('fullHd', 1920, 1080, fullHdCompressionRate);
  const bitrate = {
    current: {
      kbps: currentKbps,
      source: bitrateSource,
      frameRateSource,
    },
    native,
    fullHd,
    selected: native,
  };

  return bitrate;
}

function roundToNearestHundred(value) {
  return Math.round(Number(value || 0) / 100) * 100;
}

module.exports = {
  planVideo,
};
