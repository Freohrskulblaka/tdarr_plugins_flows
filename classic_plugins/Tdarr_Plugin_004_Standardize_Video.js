const details = () => ({
    id: "Tdarr_Plugin_004_Standardize_Video",
    Name: "Standardize Video Track - (Transcode video)",
    Stage: "Pre-processing",
    Type: "Video",
    Operation: "Transcode",
    Description: "Transcode video based on your selected options, the final file container will be an mkv file.",
    Version: "2.0",
    Tags: "pre-processing, ffmpeg, video only, nvenc, configurable",
    Inputs: [
        {
            name: 'VideoEncoder',
            type: 'string',
            defaultValue: 'hevc_nvenc',
            inputUI:{type:'dropdown', options: ['hevc_nvenc', 'h264_nvenc', 'libx265', 'libx264']},
            tooltip: 'Select the video encoder that you want to use.',
        },
        {
            name: 'QualityPreset',
            type: 'string',
            defaultValue: 'slow',
            inputUI:{type: 'dropdown', options: ['slow', 'medium', 'fast']},
            tooltip: 'The default is slow because it provides the best looking image.',
        },
        {
            name: 'EncodingProfile',
            type: 'string',
            defaultValue: 'main10',
            inputUI: {type:'dropdown', options: ['high', 'main', 'main10']},
            tooltip: 'You can select from the high or main profile, the default is Main10.',
        },
        {
            name: 'BitColorDepth',
            type: 'string',
            defaultValue: '10-Bit',
            inputUI:{type: 'dropdown', options: ['8-Bit', '10-Bit']},
            tooltip: `Select from the three available Color Depths currently in use, the default value is 10-Bit since most displays can't handle more than that.`,
        },
        {
            name: 'TargetCompressionRate',
            type: 'string',
            defaultValue: '0.101',
            inputUI: {type:'dropdown', options: ['0.07', '0.08', '0.09', '0.101', '0.11', '0.12']},
            tooltip: 'This is the target compression Rate for video. The low and high end are calculated as follow: lowEnd = TCR-0.02, highEnd = TCR + 0.02',
        },
        {
            name:'UpdateFileStats',
            type: 'boolean',
            defaultValue: true,
            inputUI: { type: 'dropdown', options: ['false', 'true'] },
            tooltip: `This makes sure that the stats on the file are updated.`
        },
        {
            name:'TranscodeOverwrite',
            type: 'boolean',
            defaultValue: true,
            inputUI: { type: 'dropdown', options: ['false', 'true'] },
            tooltip: `This makes sure that your codec matches, so if the file is in a different codec and the bitrate is bellow the optimal, it will transcode it to your optimal settings.`
        },
        {
            name: 'UpscaleVideo',
            type: 'boolean',
            defaultValue: true,
            inputUI: { type: 'dropdown', options: ['false', 'true'] },
            tooltip: `This will upscale video to 1080p at the optimal BitRate that it calculates.`
        },
        {
            name: 'DownScale4K',
            type: 'boolean',
            defaultValue: true,
            inputUI: { type: 'dropdown', options: ['false', 'true'] },
            tooltip: `This will downscale the 4k file to a 1080p version using the Optimal Bitrate.`
        }
    ]
});

// Custom rounding function to round to the nearest hundred
function roundToNearestHundred(value) {
    return Math.round(value / 100) * 100;
}

const plugin = (file, librarySettings, Inputs) => {
    const lib = require('../methods/lib')(); //load the library needed to read the inputs
    Inputs = lib.loadDefaultValues(Inputs, details); // load the default values from the inputs in details

    //Default Return object.
    var response = {processFile: false, preset: '',container: '.mkv', handBrakeMode: false, FFmpegMode: true, reQueueAfter: false, infoLog: ''}

    //Initiate the video stardardization process
    response.infoLog += `-> Starting the Video Standardization Process for file ${file._id}. \n`;

    //Check if the file is a video file otherwise exit the plugin.
    if(file.fileMedium !== 'video') {
        response.infoLog += `x-> The File is not a video file. \n`;
        response.infoLog += `x-> Cancelling Plugin. \n`;
        return response;
    } else {
        response.infoLog += `-> The File is a valid video file. \n`;
    }

    // Lets check if the file is an mkv file. If not run the cleanup process which will take care of it.
    if(file.container !== 'mkv') {
        response.infoLog += `x-> The File is not an mkv file. Run the cleanup process to convert it to an mkv file. \n`;
        response.infoLog += `x-> Cancelling Plugin. \n`;
        return response;
    } else {
        response.infoLog += `-> The file is an mkv file. \n`
    }

    // The file is a video file and it is an mkv file. Lets start the video standardization process.
    // Lets start by grabbing the video streams and the media info track data.
    let fileStreams = file.ffProbeData.streams; //Grab Entire Stream Array
    let fileMediaInfo = file.mediaInfo.track; //Grab the mediaInfo track Array
    let videoStreams = fileStreams.filter(codec => codec.codec_type === 'video'); //Filter to only the video streams
    let videoInfo = fileMediaInfo.filter(r => r['@type'] === 'Video')[0];

    // Check to make sure we have a valid video stream data, if not exit the plugin.
    if(typeof videoStreams === 'undefined'){
        response.infoLog += 'x-> No Video Streams were extracted from the File Media Info. \n';
        response.infoLog += `x-> Cancelling Plugin. \n`;
        return response;
    }

    //Check to make sure we have a valid video Info data
    if(typeof videoInfo === 'undefined'){
        response.infoLog += 'x-> No Video Info was extracted from the File Media Info. \n';
        response.infoLog += `x-> Cancelling Plugin. \n`;
        return response;
    }
        
    // Check that Stats are update for the file
    if (Inputs.UpdateFileStats){
        const proc = require('child_process'); // Load the child process module
        let statsDate = Date.parse(new Date().toISOString()); // Set the stats date to the current date
        let videoDate = Date.parse(new Date(70, 1).toISOString()); // Set the video date to the default date

        // Check for the Stats Date in the file
        let statsWritingDate = videoStreams[0]?.tags['_STATISTICS_WRITING_DATE_UTC-eng']; // Check for the Stats Writing Date
        let transcodeDate = fileMediaInfo[0]?.extra?.VIDEO_OPTIMIZED_DATE; // Check for the Transcode Date

        if (typeof statsWritingDate !== 'undefined') {
            statsDate = Date.parse(`${statsWritingDate} GMT`);
        }
        //Check for my transcode Date and compare it to the Stat Date in the file
        if (typeof transcodeDate !== 'undefined') {
            videoDate = Date.parse(transcodeDate);
            response.infoLog += `-> The file was optimized on: ${videoDate}. \n`;
        } 

        // Check if the Stats Date is older than the Video Date, if so update the stats.
        if (statsDate < videoDate) {
            response.infoLog += `-> The File Stats are older than the Video Optimization Date. \n`;
            response.infoLog += `-> Updating the Stats for the File. \n`;
            proc.execSync(`mkvpropedit --add-track-statistics-tags "${file._id}"`);
            response.reQueueAfter = true;
            return response;
        } else {
            response.infoLog += `-> The File has the most recent Stats. \n`;
        }
    }
        
    // The Video Transcoding Process Starts Here
    let targetCodecs = { 'hevc_nvenc': 'hevc', 'h264_nvenc': 'h264', 'libx265': 'hevc', 'libx264': 'h264' };
    let videoDuration = videoInfo.Duration * 0.0166667; // This gets us the duration in Minutes
    let fileSize = file.file_size; // This gets the Size of the File
    let FileBitRate = (fileSize / (videoDuration * 0.0075)); // Calculate File Bitrate in kbps
    let targetCompRate = parseFloat(Inputs.TargetCompressionRate) * (targetCodecs[Inputs.VideoEncoder] ==='hevc' ? 0.65 : 1); // Target Compression Rate

    // Define boundaries for the bitrate range based on TCR
    let topBoundary = 1.25;
    let lowBoundary = 0.75;

    // Determine the nominal or actual bitrate
    let BitRateNominal = (typeof videoInfo.BitRate_Nominal !== 'undefined') ? videoInfo.BitRate_Nominal : 0;
    let BitRateVideo = (typeof videoInfo.BitRate !== 'undefined') ? videoInfo.BitRate : 0;
    let BitRate = Math.floor(((BitRateVideo > 0) ? BitRateVideo : (BitRateNominal > 0) ? BitRateNominal : FileBitRate) / 1000); // Bitrate in kbps

    // Grab the video Height and Width
    let videoHeight = videoInfo.Height;
    let videoWidth = videoInfo.Width;
    let videoFrameRate = videoInfo.FrameRate;

    // Validate videoFrameRate
    if (!videoFrameRate || isNaN(videoFrameRate)) {
        response.infoLog += `x-> Invalid frame rate: ${videoFrameRate}. Cannot calculate bitrate. \n`;
        response.processFile = false;
        return response;
    }

    // Calculate optimal bitrate based on resolution and frame rate
    let OptimalVideoBitRate = roundToNearestHundred(((videoHeight * videoWidth * videoFrameRate) * targetCompRate) / 1000);
    let OptimalBitRate1080p = roundToNearestHundred(((1920 * 1080 * videoFrameRate) * targetCompRate) / 1000);

    // Define min and max optimal bitrate boundaries using lowBoundary and topBoundary
    let minOptimalVideoBitRate = roundToNearestHundred(OptimalVideoBitRate * lowBoundary); // Using lowBoundary
    let maxOptimalVideoBitRate = roundToNearestHundred(OptimalVideoBitRate * topBoundary); // Using topBoundary
    let minOptimalVideoBitRate1080p = roundToNearestHundred(OptimalBitRate1080p * lowBoundary); // Using lowBoundary
    let maxOptimalVideoBitRate1080p = roundToNearestHundred(OptimalBitRate1080p * topBoundary); // Using topBoundary
        
    // Determine if HDR video
    let hdrVideo = (typeof videoStreams[0].color_primaries !== 'undefined' ? (videoStreams[0].color_primaries === "bt2020" ? true : false) : false);

    // Target codecs mapping
    let codecMatches = file.video_codec_name === targetCodecs[Inputs.VideoEncoder];

    // Determine if file is 4K
    let is4KFile = file.video_resolution === "4KUHD";

    // At this point we have all the information needed to determine if the file needs to be transcoded.
    response.infoLog += `-> The data needed for the transcoding process has been collected. Determining if the file needs to be transcoded. \n`;

    // Variables to be used in the transcoding process
    let scalingPreset = '';
    let vBitRate = 0;

    //Make Sure the BitRate is calculated.
    if(!BitRate > 0) {
        response.infoLog += `x-> The bitrate could not be calculated. Skipping this plugin. \n`
        response.processFile = false;
        return response;
    }

    // Log resolution and UpscaleVideo setting for debugging
    response.infoLog += `-> File video_resolution: ${file.video_resolution}. \n`;
    response.infoLog += `-> File dimensions: ${videoWidth}x${videoHeight}. \n`;
    response.infoLog += `-> UpscaleVideo setting: ${Inputs.UpscaleVideo}. \n`;

    // Lets Start with a Resolution Check From Largest to Smallest
    let is1080p = (videoHeight >= 972 && videoHeight <= 1080 && videoWidth >= 1728 && videoWidth <= 1920);
    let isLowRes = (videoHeight < 972 || videoWidth < 1728) && !is1080p;

    if (is4KFile && Inputs.DownScale4K) {
        response.infoLog += is4KFile ? `-> The file has a resolution of 4k. \n` : ``;
        response.infoLog += `-> The Downscale 4k setting is on. The file will be downscaled to 1080p. \n`;
        response.infoLog += BitRate > OptimalBitRate1080p ? `-> The current bitrate ${BitRate} is optimal for downscaling to 1080p. \n` : `The current bitrate ${BitRate} is lower than the optimal bitrate needed to downscale to 1080p. \n`;
        response.processFile = true;
        response.reQueueAfter = false;
        scalingPreset = '-vf "scale=1920:1080:flags=lanczos"';
        vBitRate = OptimalBitRate1080p;
        minOptimalVideoBitRate = minOptimalVideoBitRate1080p;
        maxOptimalVideoBitRate = maxOptimalVideoBitRate1080p;
    } else if (is1080p || (is4KFile && !Inputs.DownScale4K)) {
        // --- Native-res path for 1080p and 4K-without-downscale ---
        const resLabel = `${videoWidth}x${videoHeight}`;
        response.infoLog += `-> The file will be kept at native resolution (${resLabel}).\n`;
        
        // Check if bitrate or codec requires transcoding
        if (BitRate > maxOptimalVideoBitRate || (!codecMatches && Inputs.TranscodeOverwrite)) {
            response.infoLog += BitRate > maxOptimalVideoBitRate ? `-> The current bitrate ${BitRate}k is above the maximum optimal bitrate of ${maxOptimalVideoBitRate}k. \n` : ``;
            response.infoLog += BitRate < minOptimalVideoBitRate && Inputs.TranscodeOverwrite ? `-> The current bitrate ${BitRate}k is below the minimum optimal bitrate of ${minOptimalVideoBitRate}k and TranscodeOverwrite is on. \n` : ``;
            response.infoLog += !codecMatches && BitRate >= minOptimalVideoBitRate && BitRate <= maxOptimalVideoBitRate ? `-> The current codec does not match the target codec of ${targetCodecs[Inputs.VideoEncoder]}. \n` : ``;
            response.processFile = true;
            response.reQueueAfter = false;
            vBitRate = OptimalVideoBitRate;
            scalingPreset = `-vf "scale=${videoWidth}:${videoHeight}:flags=lanczos"`;
        } else {
            response.infoLog += `-> The file is within optimal bitrate and codec. No transcoding needed. \n`;
            response.processFile = false;
        }
    } else if (isLowRes && Inputs.UpscaleVideo) {
        response.infoLog += `-> The file has a low resolution (${videoWidth}x${videoHeight}). \n`;
        response.infoLog += Inputs.UpscaleVideo ? `-> The Upscale Video setting is on. \n` : ``;
        response.infoLog += `-> The file will be upscaled to 1080p at a bitrate of ${OptimalBitRate1080p}. \n`;
        response.processFile = true;
        response.reQueueAfter = false;
        scalingPreset = '-vf "scale=1920:1080:flags=lanczos"';
        vBitRate = OptimalBitRate1080p;
        minOptimalVideoBitRate = minOptimalVideoBitRate1080p;
        maxOptimalVideoBitRate = maxOptimalVideoBitRate1080p;
    } else {
        response.infoLog += `-> The file resolution (${videoWidth}x${videoHeight}) is not 4K, 1080p, or low-res, or UpscaleVideo is off. No transcoding needed. \n`;
        response.processFile = false;
    }

    // Handle the Processing of the file
    if (response.processFile === true){
        // Put Together the code for the Profile.
        let NvidiaEncoders = ['hevc_nvenc', 'h264_nvenc'];
        let CPUEncoders = ['libx265', 'libx264'];
        let vProfilePreset = '';
        (NvidiaEncoders.includes(Inputs.VideoEncoder)) ? ((Inputs.EncodingProfile === 'high' && Inputs.BitColorDepth === '10-Bit') ? vProfilePreset = `-profile:v main -pix_fmt p010le ` : vProfilePreset = `-profile:v ${Inputs.EncodingProfile} -pix_fmt p010le `) : '';               
        (CPUEncoders.includes(Inputs.VideoEncoder)) ? ((Inputs.EncodingProfile === 'main10' && Inputs.BitColorDepth === '10-Bit') ? vProfilePreset = `-profile:v high422 -pix_fmt yuv422p10le ` : vProfilePreset = `-profile:v ${Inputs.EncodingProfile} `) : '';

        // Check the HDR Settings
        let hdrPreset = '';
        if (hdrVideo) {
            hdrPreset += `-level 5.1 -color_primaries bt2020 -color_trc smpte2084 -colorspace bt2020nc `
        }

        // Lets record the information for the file that will be transcoded.
        response.infoLog += `-> The File size is ${fileSize} and the duration is ${videoDuration} minutes. \n`;
        response.infoLog += `-> The File resolution is ${videoWidth}x${videoHeight} and the frame rate is ${videoFrameRate}. \n`;
        response.infoLog += `-> The File will be encoded using ${Inputs.VideoEncoder} with a ${Inputs.EncodingProfile} profile, a ${Inputs.QualityPreset} preset and a ${Inputs.BitColorDepth} color depth. \n`;
        response.infoLog += hdrVideo ? `-> The file has HDR. \n` : ``;
        response.infoLog += `-> The File will be transcoded to a bitrate of ${vBitRate}k, with a minimum of ${minOptimalVideoBitRate}k and a maximum of ${maxOptimalVideoBitRate}k. \n`;

        // Lets compile the ffmpeg command for the file.
        response.preset += `, -map 0:v -c:v ${Inputs.VideoEncoder} -cq:v 19 -b:v ${vBitRate}k `; // Video Settings
        response.preset += `-minrate ${minOptimalVideoBitRate}k -maxrate ${maxOptimalVideoBitRate}k -bufsize ${BitRate}k `; // Rate Control Settings
        response.preset += `-rc:v vbr -rc-lookahead:v 32 -spatial_aq:v 1 -aq-strength:v 15 -temporal-aq 1 -bf 5 `; // Rate Control Settings and AQ Settings
        response.preset += `${scalingPreset} -preset:v ${Inputs.QualityPreset} -tune:v hq ${vProfilePreset} ${hdrPreset} `; // Scaling Settings, Quality Preset, Profile Settings, and HDR Settings
        response.preset += `-map 0:a? -c:a copy -map 0:s? -c:s copy -map 0:t? -c:t copy -map_chapters 0 `; // Copy Audio, Subtitles, Attachments, and Chapters
        response.preset += `-metadata "video_optimized_date=${new Date().toISOString()}" -max_muxing_queue_size 9999 `; // Add Metadata to the file and Max Muxing Queue Size 
        return response;
    }

    // If we reach this point, the file does not need to be transcoded.
    return response;
};

module.exports.details = details;
module.exports.plugin = plugin;