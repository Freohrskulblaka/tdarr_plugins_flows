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
            type: 'Number',
            defaultValue: 0.101,
            inputUI: {type:'dropdown', options: [0.07, 0.08, 0.09, 0.101, 0.11, 0.12]},
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

const plugin = (file, librarySettings, Inputs) => {
    const lib = require('../methods/lib')(); //load the library needed to read the inputs
    Inputs = lib.loadDefaultValues(Inputs, details); // load the default values from the inputs in details

    //Default Return object.
    var response = {processFile: false, preset: '',container: '.mkv', handBrakeMode: false, FFmpegMode: true, reQueueAfter: true, infoLog: ''}

    //Initiate the transcode process
    response.infoLog += `The Video Transcode Process has started.\n`;

    //This Plugin only works on video files
    let isVideoFile = true;

    //Check if file is a video. If it isn't then exit plugin.
    if(file.fileMedium !== 'video') {
        response.infoLog += '- Not a Valid Video File. \n';
        isVideoFile == false;
    }
    //Check if the file is an mkv file.
    if(file.container !== 'mkv') {
        response.infoLog += '- Not an MKV File. \n';
        isVideoFile == false;
    }
    // Exit the Plugin Otherwise. 
    if(isVideoFile === false) {
        return response;
    }
    
    if (isVideoFile === true){
        // Variables
        let fileStreams = file.ffProbeData.streams; //Grab Entire Stream Array
        let fileMediaInfo = file.mediaInfo.track; //Grab the mediaInfo track Array
        let videoStreams = fileStreams.filter(codec => codec.codec_type === 'video'); //Filter to only the video streams
        let videoInfo = fileMediaInfo.filter(r => r['@type'] === 'Video')[0];
   
        //Check to make sure we have the a valid video stream
        if(typeof videoStreams === 'undefined'){
            response.infoLog += '- No Video Stream Found';
            return response;
        }
        //Check to make sure we have a valid video Info data
        if(typeof videoInfo === 'undefined'){
            response.infoLog += '- No Video Info was extracted from the File Media Info';
            return response;
        }

        // Check that Stats are update for the file
        if (Inputs.UpdateFileStats){
            const proc = require('child_process');
            let currentfilename = file._id;
            let stats_are_current = false;
            let statsDate = Date.parse(new Date().toISOString());
            let videoDate = Date.parse(new Date(70, 1).toISOString());

            //Check if the file has stats at all.
            try {
                if(typeof videoStreams[0].tags['_STATISTICS_WRITING_DATE_UTC-eng'] !== 'undefined') {
                    statsDate = Date.parse(`${videoStreams[0].tags['_STATISTICS_WRITING_DATE_UTC-eng']} GMT`);
                }
            } catch (error) {
                response.infoLog += `- Missing File Stats. \n`;
            }

            //Check for my transcode Date and compare it to the Stat Date in the file
            try {               
                if (typeof fileMediaInfo[0].extra.VIDEO_OPTIMIZED_DATE !== 'undefined') {
                    videoDate = Date.parse(fileMediaInfo[0].extra.VIDEO_OPTIMIZED_DATE);
                    response.infoLog += `Encoded_Date: ${videoDate}, Stats_Date: ${statsDate}\n`;
                }
            } catch (error) {
                response.infoLog += `- Missing Optimization Stats. \n`;
            }

            // Check the two dates
            if(statsDate < videoDate) {
                response.infoLog += 'Stats need to be updated! \n';
                proc.execSync(`mkvpropedit --add-track-statistics-tags "${currentfilename}"`);
                response.reQueueAfter = true;
                return response;
            }
            else {
                stats_are_current = true;
            }
        }
        
        // The Video Transcoding Process Starts Here
        let videoDuration   = videoInfo.Duration * 0.0166667; //This gets us the duration in Minutes (113.8924729233736)
        let fileSize = file.file_size //This gets the Size of the File (10521.799980163574)
        let FileBitRate    = (fileSize / (videoDuration * 0.0075)); //( 10521.799980163574 / 0.854175)
        let targetCompRate = Inputs.TargetCompressionRate * 1;
        let topBoundary     = targetCompRate + 0.02;
        let lowBoundary     = targetCompRate - 0.02;
        let BitRateNominal  = (typeof videoInfo.BitRate_Nominal !== 'undefined') ? videoInfo.BitRate_Nominal : 0
        let BitRateVideo    = (typeof videoInfo.BitRate !== 'undefined') ? videoInfo.BitRate : 0
        let BitRate         =  Math.floor(((BitRateVideo > 0) ? BitRateVideo : (BitRateNominal > 0) ? BitRateNominal: FileBitRate)/1000);
        let videoHeight     = videoInfo.Height;
        let videoWidth      = videoInfo.Width;
        let OptimalVideoBitRate  = Math.floor(((videoHeight * videoWidth * videoInfo.FrameRate) * targetCompRate)/1000);
        let OptimalBitRate1080p = Math.floor(((1920 * 1080 * videoInfo.FrameRate) * targetCompRate)/1000);
        let minOptimalVideoBitRate = Math.floor(OptimalVideoBitRate * (1 + lowBoundary));
        let maxOptimalVideoBitRate = Math.floor(OptimalVideoBitRate * (1 + topBoundary) * 1.05);
        let hdrVideo        = (videoStreams[0].color_primaries !== 'undefined' ? (videoStreams[0].color_primaries === "bt2020" ? true : false) : false);
        let targetCodecs = { 'hevc_nvenc' : 'hevc', 'h264_nvenc' : 'h264', 'libx265' : 'hevc', 'libx264' : 'h264'}
        let codecMatches = file.video_codec_name === targetCodecs[Inputs.VideoEncoder];
        let is4KFile = file.video_resolution === "4KUHD";

        let videoNeedsProcessing = Inputs.TranscodeOverwrite || !codecMatches || Inputs.UpscaleVideo || Inputs.DownScale4K;
        let processFile = false;
        let scalingPreset = '';
        let vBitRate = 0;

        //Make Sure the BitRate is calculated.
        if(!BitRate > 0) {
            response.infoLog += `The bitrate could not be calculated. Skipping this plugin. \n`
            response.processFile = false;
            return response;
        }

        // Handel the video processing
        if (videoNeedsProcessing) {
            // 4K Downscaling, if the file is 4k and the bitRate is higher than we want. 
            if (Inputs.DownScale4K && is4KFile && BitRate > maxOptimalVideoBitRate && BitRate > OptimalBitRate1080p & !processFile){
                processFile = true;
                scalingPreset = '-vf "scale=1920:1080:flags=lanczos"';
                vBitRate = OptimalBitRate1080p;
                minOptimalVideoBitRate = Math.floor(OptimalBitRate1080p * (1 + lowBoundary));
                maxOptimalVideoBitRate = Math.floor(OptimalBitRate1080p * (1 + topBoundary) * 1.05);
                response.infoLog += '- Downscaling Video to 1080p';
            }

            // Upscale the Videos that are 720p or 480p to 1080p
            if (Inputs.UpscaleVideo && (file.video_resolution === "720p" || file.video_resolution === "480p") & !processFile & !is4KFile) {
                processFile = true;
                scalingPreset = '-vf "scale=1920:1080:flags=lanczos"';
                vBitRate = OptimalBitRate1080p;
                minOptimalVideoBitRate = Math.floor(OptimalBitRate1080p * (1 + lowBoundary));
                maxOptimalVideoBitRate = Math.floor(OptimalBitRate1080p * (1 + topBoundary) * 1.05);
                response.infoLog += `- Upscaling ${file.video_resolution} Video to 1080p`;
            }

            //Transcode files that are below the bitrate cutoff if the Overwrite is on, this will only use the bitrate needed for the file resolution.
            if(Inputs.TranscodeOverwrite && BitRate < minOptimalVideoBitRate & !processFile) {
                processFile = true;
                scalingPreset = `-vf "scale=${videoWidth}:${videoHeight}:flags=lanczos"`;
                vBitRate = OptimalVideoBitRate;
                minOptimalVideoBitRate = Math.floor(OptimalVideoBitRate * (1 + lowBoundary));
                maxOptimalVideoBitRate = Math.floor(OptimalVideoBitRate * (1 + topBoundary) * 1.05);
                response.infoLog += `- Transcoding Video to desired bitrate Settings`;
            }

            // Transcode Regular Files or if the file has the wrong codec
            if (BitRate > maxOptimalVideoBitRate || (Inputs.TranscodeOverwrite && !codecMatches) & !processFile) {
                processFile = true;
                vBitRate = OptimalVideoBitRate;
                response.infoLog += `- Transcoding Video with desired Settings`;
            }

            // Handle the Processing of the file
            if (processFile){
                //Put Together the code for the Profile.
                let NvidiaEncoders     = ['hevc_nvenc', 'h264_nvenc'];
                let CPUEncoders     = ['libx265', 'libx264'];
                let vProfilePreset = '';
                (NvidiaEncoders.includes(Inputs.VideoEncoder)) ? ((Inputs.EncodingProfile === 'high' && Inputs.BitColorDepth === '10-Bit') ? vProfilePreset = `-profile:v main -pix_fmt p010le ` : vProfilePreset = `-profile:v ${Inputs.EncodingProfile} -pix_fmt p010le `) : '';
                (CPUEncoders.includes(Inputs.VideoEncoder)) ? ((Inputs.EncodingProfile === 'main10' && Inputs.BitColorDepth === '10-Bit') ? vProfilePreset = `-profile:v high422 -pix_fmt yuv422p10le ` : vProfilePreset = `-profile:v ${Inputs.EncodingProfile} `) : '';

                // Check the HDR Settings
                let hdrPreset = '';
                if (hdrVideo) {
                    hdrPreset += `-level 5.1 -color_primaries bt2020 -color_trc smpte2084 -colorspace bt2020nc `
                }

                // Print to infoLog information for the file.
                response.infoLog += `File: ${file._id}  \n`;
                response.infoLog += `Current bitrate = ${BitRate} \n`;
                response.infoLog += 'Transcode settings: \n';
                response.infoLog += `Target bitrate = ${vBitRate} \n`;
                response.infoLog += `Target Compression Rate = ${targetCompRate} \n`;
                response.infoLog += `Minimum bitrate = ${minOptimalVideoBitRate} \n`;
                response.infoLog += `Maximum bitrate = ${maxOptimalVideoBitRate} \n`;
                response.infoLog += `Encoder = ${Inputs.VideoEncoder} \n`;
                response.infoLog += `Preset = ${Inputs.QualityPreset} \n`;
                response.infoLog += `BitColorDepth = ${Inputs.BitColorDepth} \n`;

                //Compile the transcode Code
                response.preset = `, -map 0:v -c:v ${Inputs.VideoEncoder} -cq:v 19 -qmin 1 -qmax 99 -b:v ${vBitRate}k -minrate:v ${minOptimalVideoBitRate}k -maxrate:v ${maxOptimalVideoBitRate}k -bufsize:v ${BitRate}k ${scalingPreset} -preset:v ${Inputs.QualityPreset} -tune:v hq ${vProfilePreset} ${hdrPreset}`;
                response.preset += `-rc:v vbr_hq -rc-lookahead:v 32 -spatial_aq:v 1 -aq-strength:v 15 -temporal-aq 1 -map 0:a? -c:a copy -map 0:s? -c:s copy -map 0:t? -c:t copy -max_muxing_queue_size 9999 `;
                response.preset += ` -map_chapters 0 -metadata "video_optimized_date=${new Date().toISOString()}" `;
                response.processFile = true;
                return response;
            }

            // No Work is needed on the file
            if (!processFile){
                response.infoLog += `The current File does not Require Work. Cancelling plugin. \n`;
                return response;
            }

        }   

        // No Processing is Needed
        if (!videoNeedsProcessing) {
            // Transcode Overwrite is not enabled and the bitrate is within range
            if(Inputs.TranscodeOverwrite === false && BitRate > minOptimalVideoBitRate && BitRate < maxOptimalVideoBitRate){
                response.infoLog += `The current bitrate ${BitRate} is within the range of lowBand = ${minOptimalVideoBitRate} and highBand = ${maxOptimalVideoBitRate}. Cancelling plugin. \n`;
                return response;
            }
            // Cancel the versions where the codec does not match.
            if(Inputs.TranscodeOverwrite === false && !codecMatches){
                response.infoLog += `The current file has the wrong Codec, Enable the Transcode Overwrite to conver it. Cancelling plugin. \n`;
                return response;
            }

            if(Inputs.TranscodeOverwrite === false && BitRate < minOptimalVideoBitRate){
                response.infoLog += `The current bitrate ${BitRate} is bellow the lowest possible allowed of ${minOptimalVideoBitRate}, Enable the Transcode Overwrite to conver it. Cancelling plugin. \n`;
                return response;
            }
        }

        // Video Transcoding Proccess Ends    
    }
};

module.exports.details = details;
module.exports.plugin = plugin;