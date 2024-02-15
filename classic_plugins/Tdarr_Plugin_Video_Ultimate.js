function checkFileType (fileMedium, fileType) {
    // This function can be called to check if the file is the correct type.
    let res = {validFlag: true, message: ''};

    if (fileMedium !== fileType) {
        res.message += `- This is not a valid ${fileType} file. \n`;
        res.validFlag = false;
    }
    return res;
}

function checkFileExt (fileContainer, targetFileType) {
    // This function checks if the file is in the right extion
    let res = {processFile: false, preset:'', message:'', container:''};
    // Copy everything if target format is MKV, if the target is mp4 then we copy only copy video, audio, and chapters if target format is MP4.
    let commands = {mkv: ' -map 0 -c copy', mp4: ' -map 0:v? -c:v copy -map 0:a? -c:a copy -map 0:t? -c:t copy',}

    if (fileContainer !== targetFileType && fileContainer !== "avi"){
        res.processFile = true;
        res.preset += commands[targetFileType];
        res.message += `The file will be remuxed to ${targetFileType}. \n`;
    }

    if (fileContainer === "avi"){
        res.processFile = true;
        res.preset += commands.mp4;
        res.message += `The file will be remuxed to mp4. \n`;
        res.container = '.mp4';
    }

    return res;
}

function cleanFile(file, inputs) {
    function removeImages(file) {
        let res = { processFile: false, preset: '', message: '' };
        let nonVideoCodecs = ['mjpeg', 'png', 'gif', 'image/jpeg'];
        const fileStreams = file.ffProbeData.streams;
        const videoStreams = fileStreams.filter(stream => stream.codec_type === 'video');
    
        if (videoStreams && videoStreams.length > 0) {
            for (let i = 0; i < videoStreams.length; i++) {
                let codecName = videoStreams[i].codec_name;
                let tagsMime = videoStreams[i].tags?.['MIMETYPE'];
    
                if ((codecName && nonVideoCodecs.includes(codecName)) || (tagsMime && nonVideoCodecs.includes(tagsMime))) {
                    res.processFile = true;
                    res.preset += ` -map -v:${i} `;
                    res.message += `The ${codecName} track at index ${i} will be removed. \n`;
                }
            }
        }
    
        return res;
    }
    
    function removeAttachments(file) {
        let res = { processFile: false, preset: '', message: '' };
        const fileStreams = file.ffProbeData.streams; //Grab Entire Stream Array
        const attachmentStreams = fileStreams.filter(codec => codec.codec_type === 'attachment'); //Filter to only the attachment streams

        if (attachmentStreams && attachmentStreams.length > 0){
            for (let i = 0; i < attachmentStreams.length; i++) {
                let tagsMime = attachmentStreams[i].tags?.['MIMETYPE'];

                if (tagsMime && !tagsMime.startsWith('font')) {
                    res.processFile = true;
                    res.preset += ` -map -0:${i} `;
                    res.message += `The non-font attachment track at index ${i} will be removed. \n`;
                }
            }
        }
   
        return res;
    }

    function cleanTitles(file) { 
        let res = { processFile: false, preset: '', message: '' };
        const fileStreams = file.ffProbeData.streams; //Grab Entire Stream Array
        const fileMediaInfo = file.mediaInfo.track; //Grab the mediaInfo track Array
        const videoStreams = fileStreams.filter(codec => codec.codec_type === 'video'); //Filter to only the video streams
        const fileInfo = fileMediaInfo.filter(r => r['@type'] === 'General')[0];
        
        // Remove the Video Title
        if (videoStreams.length > 0 && videoStreams.some(vs => vs.tags && vs.tags.title && vs.tags.title.trim().length > 0)) {
            res.processFile = true;
            res.preset += ` -metadata:s:v title= `;
            res.message += `- Removing video title. \n`;
        }

        // Remove the File Title
        if(typeof fileInfo.Title !== 'undefined') {
            res.processFile = true;
            res.preset += ` -metadata title= `;
            res.message += '- Removing title from the file. \n';
        }
        
        return res;
    }

    function removeCommentary(file) {
        let res = { processFile: false, preset: '', message: '' };
        let commentaryIndicators  = ['commentary', 'comentarios', 'description', 'descripcion', 'director', 'narration', 'director', 'narracion'];
        const fileStreams = file.ffProbeData.streams; //Grab Entire Stream Array
        let commands = {audio : ' -map -0:a:', subtitle: ' -map -0:s:'};
        let trackIndex = {audio: 0, subtitle: 0};
        
        if (fileStreams && fileStreams.length > 0) {
            for (let i = 0; i < fileStreams.length; i++) {
                const stream = fileStreams[i];
                let description = stream.tags ? stream.tags.description : '';
                let language = stream.tags ? stream.tags.language : '';
                let streamType = (stream.codec_type === 'audio') ? 'audio': (stream.codec_type === 'subtitle' ? 'subtitle' : undefined);

                if (streamType && ((description && commentaryIndicators.some(tag => description.toLowerCase().includes(tag))) || 
                (language && commentaryIndicators.some(tag => language.toLowerCase().includes(tag))))) {
                    res.processFile = true;
                    res.preset += commands[streamType] + `${trackIndex[streamType]} `;
                    res.message += `The ${streamType} commentary track at index ${trackIndex[streamType]} will be removed. \n`;
                    trackIndex[streamType]++;
                }
            }
        }
    
        return res;
    }

    function processStreamLanguages(file, inputs) {
        let res = { processFile: false, preset: '', message: '' };
        const fileStreams = file.ffProbeData.streams;
        let commands = {
            remove: {audio: ' -map -0:a:', subtitle: ' -map -0:s:'},
            tag: {audio: ' -metadata:s:a:', subtitle: ' -metadata:s:s:'},
            index: {audio: 0, subtitle: 0}
        };
        let wantedLangs = {
            audio: inputs.audioLangList.split(',').map(lang => lang.toLowerCase()),
            subtitle: inputs.subtitleLangList.split(',').map(lang => lang.toLowerCase())
        };
    
        if (fileStreams && fileStreams.length > 0) {
            for (let i = 0; i < fileStreams.length; i++) {
                let stream = fileStreams[i];
                let streamType = (stream.codec_type === 'audio') ? 'audio' : (stream.codec_type === 'subtitle' ? 'subtitle' : undefined);
    
                if (streamType) {
                    let language = (stream.tags && stream.tags.language) ? stream.tags.language.toLowerCase() : 'und';
                    
                    if (language === 'und') {
                        res.processFile = true;
                        let defaultLang = wantedLangs[streamType][0]; // Choose the first language as the default
                        res.preset += `${commands.tag[streamType]}${commands.index[streamType]} language=${defaultLang} `;
                        res.message += `Tagging ${streamType} track at index ${commands.index[streamType]} with language ${defaultLang}. \n`;
                    } else if (!wantedLangs[streamType].includes(language)) {
                        res.processFile = true;
                        res.preset += `${commands.remove[streamType]}${commands.index[streamType]} `;
                        res.message += `The ${streamType} track at index ${commands.index[streamType]} will be removed. \n`;
                    }
                    commands.index[streamType]++;
                }
            }
        }
    
        return res;
    }
    
    // Variables needed for cleaning the file
    let res = {processFile: false, preset: '', message: ''};

    // Check the cleanFile flag.
    if (inputs.cleanFile){
        // 1 - Removes the video tracks that are embeded images.
        let imgRemoved = removeImages(file);
        res.message += imgRemoved.message;
        res.processFile = res.processFile || imgRemoved.processFile;
        res.preset += imgRemoved.preset;

        // 2- Removes the attachments from the file with the exception of fonts.\n
        let attchRemoved = removeAttachments(file);
        res.message += attchRemoved.message;
        res.processFile = res.processFile || attchRemoved.processFile;
        res.preset += attchRemoved.preset;

        // 3- Removes all video and file titles.
        let titlesCleaned = cleanTitles(file);
        res.message += titlesCleaned.message;
        res.processFile = res.processFile || titlesCleaned.processFile;
        res.preset += titlesCleaned.preset;

        // 4- Removes all the commentary audio and subtitle tracks.
        let comntRemoved = removeCommentary(file);
        res.message += comntRemoved.message;
        res.processFile = res.processFile || comntRemoved.processFile;
        res.preset += comntRemoved.preset;

        // 5- Remove Unwanted Audio and Subtitle Tracks and Tag the und tracks.
        let processedLangs = processStreamLanguages(file, inputs);
        res.message += processedLangs.message;
        res.processFile = res.processFile || processedLangs.processFile;
        res.preset += processedLangs.preset;
    }

    return res;
}

function optimizeAudioTracks(file, inputs) {
    function getAudioDetails(audioStreams) {
        let audioDetails = {};
    
        for (let stream of audioStreams) {
            let language = (typeof stream.tags.language !== 'undefined') ? stream.tags.language.toLowerCase() : 'eng';
            
            if (!(language in audioDetails)) {
                audioDetails[language] = {};
            }
    
            let channel = stream.channels.toString();
            if (!(channel in audioDetails[language])) {
                audioDetails[language][channel] = { 'count': 0, 'codec': null };
            }
    
            audioDetails[language][channel].count += 1;
            audioDetails[language][channel].codec = stream.codec_name;
        }
    
        return audioDetails;
    }

    let res = {processFile: false, preset: '', message: ''};

    if (inputs.optimizeAudio) {
        const fileStreams = file.ffProbeData.streams; //Grab Entire Stream Array
        const audioStreams = fileStreams.filter(codec => codec.codec_type === 'audio'); //Filter to only the audio streams


    }
    return res;
}

async function getVideoInfo (fileMediaInfo, file, videoStreams, pluginInputs){
    let videoInfo = fileMediaInfo.filter(r => r['@type'] === 'Video')[0];

    if (!videoInfo) {
        throw new Error("No video information found.");
    }

    // Main File Info
    let videoDuration = videoInfo.Duration * 0.0166667; //This gets us the duration in Minutes (113.8924729233736)
    let fileSize = file.file_size; //This gets the Size of the File (10521.799980163574)
    let fileBitRate = (fileSize / (videoDuration * 0.0075)); //( 10521.799980163574 / 0.854175)

    // Calculated BitRate
    let nominalBitRate = videoInfo.BitRate_Nominal || 0;
    let videoBitRate = videoInfo.BitRate || 0;
    let bitRate =  Math.floor(((videoBitRate > 0) ? videoBitRate : (nominalBitRate > 0) ? nominalBitRate: fileBitRate)/1000);

    // Compression Data information
    let targetCompRate = pluginInputs.TargetCompressionRate * 1;
    let topBoundary = targetCompRate + 0.02;
    let lowBoundary = targetCompRate - 0.02;

    // Video Dimension     
    let videoHeight = videoInfo.Height;
    let videoWidth = videoInfo.Width;

    // Optimal Calculations
    let optimalVideoBitRate  = Math.floor(((videoHeight * videoWidth * videoInfo.FrameRate) * targetCompRate)/1000);
    let minOptimalVideoBitRate = Math.floor(OptimalVideoBitRate * (1 + lowBoundary));
    let maxOptimalVideoBitRate = Math.floor(OptimalVideoBitRate * (1 + topBoundary) * 1.05);

    // Optimal Calculations for 1080p
    let optimalBitRate1080p = Math.floor(((1920 * 1080 * videoInfo.FrameRate) * targetCompRate)/1000);
    let minOptimalVideoBitRate1080p = Math.floor(OptimalBitRate1080p * (1 + lowBoundary));
    let maxOptimalVideoBitRate1080p = Math.floor(OptimalBitRate1080p * (1 + topBoundary) * 1.05);

    // Misc Information about Video
    let videoResolution = file.video_resolution;
    let videoCodec = file.video_codec_name;
    let is4KFile = videoResolution === "4KUHD";

    // HDR determination
    let hdrVideo = videoStreams[0].color_primaries === 'bt2020' && videoStreams[0].color_transfer === 'smpte2084' && videoStreams[0].color_space === 'bt2020nc'

    // Call getDetailedFrameData if the video has HDR
    let hdrMetadata = null;
    if (hdrVideo) {
        try {
            hdrMetadata = await getDetailedFrameData(file._id);
        } catch (error) {
            console.error("Error fetching detailed frame data:", error);
        }
    }
    let formattedHDRMetadata = formatHDRMetadata(hdrMetadata);

    // Video Processing
    let targetCodecs = { 'hevc_nvenc' : 'hevc', 'h264_nvenc' : 'h264', 'libx265' : 'hevc', 'libx264' : 'h264'}
    let codecMatches = videoCodec === targetCodecs[pluginInputs.VideoEncoder];
    let transcodeOverwrite = pluginInputs.TranscodeOverwrite;
    let upscaleFlag = pluginInputs.UpscaleVideo;
    let downscale4kFlag = pluginInputs.DownScale4K && is4KFile
    let videoNeedsProcessing = transcodeOverwrite || !codecMatches || upscaleFlag || downscale4kFlag;
    
    let res = { 
        processFile: videoNeedsProcessing,
        message: '- This are the key file data points.', 
        bitRate: bitRate,
        optimalVideoBitRate: optimalVideoBitRate,
        minOptimalVideoBitRate: minOptimalVideoBitRate,
        maxOptimalVideoBitRate: maxOptimalVideoBitRate,
        optimalBitRate1080p: optimalBitRate1080p,
        minOptimalVideoBitRate1080p: minOptimalVideoBitRate1080p,
        maxOptimalVideoBitRate1080p: maxOptimalVideoBitRate1080p,
        videoResolution: videoResolution,
        videoCodec: videoCodec,
        hdrVideo: hdrVideo,
        is4KFile: is4KFile,
        hdrMetadata: hdrMetadata,
        formattedHDRMetadata: formattedHDRMetadata,
        transcodeOverwrite: transcodeOverwrite,
        upscaleFlag: upscaleFlag,
        downscale4kFlag: downscale4kFlag,
        codecMatchesFlag: codecMatches,
        videoHeight: videoHeight,
        videoWidth: videoWidth,
    };
   
    return res;
}

function getDetailedFrameData(filePath) {
    const fs = require('fs');
    const path = require("path");
    const proc = require('child_process');
    let rootModules;

    // ffprobe
    if (fs.existsSync(path.join(process.cwd(), "/npm"))) {
        rootModules = path.join(process.cwd(), "/npm/node_modules/");
    } else {
        rootModules = "";
    }
    const ffprobePath = require(rootModules + 'ffprobe-static').path;
    
    return new Promise((resolve, reject) => {
        let command = `${ffprobePath} -hide_banner -loglevel warning -select_streams v -print_format json -show_frames -read_intervals "%+#1" -show_entries "frame=color_space,color_primaries,color_transfer,side_data_list,pix_fmt" -i "${filePath}"`;
        proc.exec(command, (error, stdout, stderr) => {
            if (error) {
                reject(error);
            } else {
                let output = JSON.parse(stdout);
                resolve(output);
            }
        });
    });
}

function formatHDRMetadata(hdrMetadata) {
    // Extract needed properties
    let frameData = hdrMetadata.frames[0];
    let displayMetadata = frameData.side_data_list.find(data => data.side_data_type === 'Mastering display metadata');
    let contentMetadata = frameData.side_data_list.find(data => data.side_data_type === 'Content light level metadata');

    // Split ratio strings into numbers and calculate
    let redX = calculateRatio(displayMetadata.red_x);
    let redY = calculateRatio(displayMetadata.red_y);
    let greenX = calculateRatio(displayMetadata.green_x);
    let greenY = calculateRatio(displayMetadata.green_y);
    let blueX = calculateRatio(displayMetadata.blue_x);
    let blueY = calculateRatio(displayMetadata.blue_y);
    let whiteX = calculateRatio(displayMetadata.white_point_x);
    let whiteY = calculateRatio(displayMetadata.white_point_y);
    let minLuminance = calculateRatio(displayMetadata.min_luminance, false);
    let maxLuminance = calculateRatio(displayMetadata.max_luminance, false);
    let maxContent = contentMetadata.max_content;
    let maxAverage = contentMetadata.max_average;

    // Format properties
    let R = `R(${redX},${redY})`;
    let G = `G(${greenX},${greenY})`;
    let B = `B(${blueX},${blueY})`;
    let WP = `WP(${whiteX},${whiteY})`;
    let L = `L(${maxLuminance},${minLuminance})`;
    let CLL = `:max-cll=${maxContent},${maxAverage}`;

    // Combine properties
    let formattedHDRMetadata = `${G}${B}${R}${WP}${L}${CLL}`;

    return formattedHDRMetadata;
}

function calculateRatio(ratioStr, isColor = true) {
    let [numerator, denominator] = ratioStr.split("/").map(Number);
    let expectedDenominator = isColor ? 50000 : 10000;

    if (denominator !== expectedDenominator) {
        let ratio = expectedDenominator / denominator;
        numerator = numerator * ratio;
    }

    return numerator;
}

function handleVideoScaling(videoInfo) {
    let res = {processFile: false, scalingPreset: '', bitRate: 0, minBR: 0, maxBR: 0, message: ''}

    // Handle 4K Downscaling, only when the flag is on and the video is 4k and the bitRate allows it.
    if (videoInfo.downscale4kFlag && videoInfo.bitRate > videoInfo.maxOptimalVideoBitRate && videoInfo.bitRate > videoInfo.maxOptimalVideoBitRate1080p){
        res.processFile = true;
        res.scalingPreset = '-vf "scale=1920:1080:flags=lanczos"';
        res.message += '- Downscaling Video to 1080p';
        res.bitRate = videoInfo.optimalBitRate1080p;
        res.minBR = videoInfo.minOptimalVideoBitRate1080p;
        res.maxBR = videoInfo.maxOptimalVideoBitRate1080p;
    }

    // Handle Video Resolution Upscaling
    let upscaleRes = ['720p', '480p'];
    if (videoInfo.upscaleFlag && upscaleRes.includes(videoInfo.videoResolution) && !videoInfo.downscale4kFlag){
        res.processFile = true;
        res.scalingPreset = '-vf "scale=1920:1080:flags=lanczos"';
        res.message += `- Upscaling ${videoInfo.videoResolution} Video to 1080p`;
        res.bitRate = videoInfo.optimalBitRate1080p;
        res.minBR = videoInfo.minOptimalVideoBitRate1080p;
        res.maxBR = videoInfo.maxOptimalVideoBitRate1080p;
    }

    // Handle Videos that are below the Optimal Bitrate or their codec do not match. The Overwrite Must be Turned On.
    if (videoInfo.transcodeOverwrite && !res.processFile && (videoInfo.bitRate < videoInfo.minOptimalVideoBitRate || !videoInfo.codecMatchesFlag)) {
        res.processFile = true;
        res.scalingPreset = `-vf "scale=${videoInfo.videoWidth}:${videoInfo.videoHeight}:flags=lanczos"`;
        res.message += `- Transcoding Video to desired bitrate Settings`;
        res.bitRate = videoInfo.optimalVideoBitRate;
        res.minBR = videoInfo.minOptimalVideoBitRate;
        res.maxBR = videoInfo.maxOptimalVideoBitRate;
    }
    
    // Handle videos that have enough bitRate to be compressed.
    if (videoInfo.bitRate > videoInfo.maxOptimalVideoBitRate && !res.processFile){
        res.processFile = true;
        res.message += `- Transcoding Video from BitRate: ${videoInfo.bitRate} to a Target BitRate: ${videoInfo.OptimalVideoBitRate}. \n`;
        res.bitRate = videoInfo.optimalVideoBitRate;
        res.minBR = videoInfo.minOptimalVideoBitRate;
        res.maxBR = videoInfo.maxOptimalVideoBitRate;
    }

    // Video is within Range so no processing is needed.
    if (!res.processFile && videoInfo.bitRate > videoInfo.minOptimalVideoBitRate && videoInfo.bitRate < videoInfo.maxOptimalVideoBitRate){
        res.message += `The current bitrate ${videoInfo.bitRate} is within the range of lowBand = ${videoInfo.minOptimalVideoBitRate} and highBand = ${videoInfo.maxOptimalVideoBitRate}. No Transcoding needed. \n`;
    }

    if (!res.processFile && !videoInfo.transcodeOverwrite){
        if (videoInfo.bitRate < videoInfo.minOptimalVideoBitRate) {
            res.message += `The current bitrate ${videoInfo.bitRate} is bellow the lowest possible allowed of ${videoInfo.minOptimalVideoBitRate}, Enable the Transcode Overwrite to convert it. \n`;
        }

        if (!videoInfo.codecMatchesFlag){
            res.message += `The current file has the wrong Codec, Enable the Transcode Overwrite to convert it. \n`;
        }
    }

    // Update Values in res object.
    if (!res.processFile){
        res.bitRate = videoInfo.optimalVideoBitRate;
        res.minBR = videoInfo.minOptimalVideoBitRate;
        res.maxBR = videoInfo.maxOptimalVideoBitRate;
    }

    return res;
}

function details() {
    return ({
    id: "Tdarr_Plugin_Video_Ultimate",
    Name: "Ultimate Video Process",
    Stage: "Pre-processing",
    Type: "Video, Audio, Subtitle",
    Operation: "Transcode",
    Description: "This Process will handle everything that i want done to a video file.",
    Version: "1.0",
    Tags: "pre-processing, ffmpeg, video, audio, subtitles, nvenc, configurable",
    Inputs: [
        {
            name: 'targetFileType',
            type: 'string',
            defaultValue: 'mkv',
            inputUI: { type: 'dropdown', options: ['mkv', 'mp4']},
            tooltip: 'Select the desired output file format.'
        },
        {
            name: 'cleanFile',
            type: 'boolean',
            defaultValue: true,
            inputUI: { type: 'dropdown', options: ['false', 'true'] },
            tooltip: `This feature will do a few things. \n
                1- Removes the video tracks that are embeded images. \n
                2- Removes the attachments from the file with the exception of fonts.\n
                3- Removes all video and file titles. \n
                4- Removes all the commentary audio and subtitle tracks. \n
                5- Will use the audioLangList and the subtitleLangList to keep only those languages.\n
                6- Will use the audioLangList and the subtitleLangList to tag undifined tracks using the first value\n`
        },
        {
            name: 'audioLangList',
            type: 'string',
            defaultValue: 'eng,spa,lat,jpn',
            inputUI: {type: 'text'},
            tooltip: `List of languagues that will be kept. The first value will be used to tag und tracks.
            \\nExample (keep this list):\\n
            eng,und,jpn`
        },
        {
            name: 'subtitleLangList',
            type: 'string',
            defaultValue: 'eng,spa',
            inputUI: {type: 'text'},
            tooltip: `List of languagues that will be kept. The first value will be used to tag und tracks.
            \\nExample (keep this list):\\n
            eng,jpn`
        },
        {
            name: 'optimizeAudio',
            type: 'boolean',
            defaultValue: true,
            inputUI: { type: 'dropdown', options: ['false', 'true'] },
            tooltip: `This feature will do a few things. \n
            1- Downmix audio tracks to ensure each channel is present per language. \n
            2- Converts Stereo tracks to AAC.\n
            3- Converts Surround Tracks to AC3. \n
            4- Removes duplicate tracks. \n`
        },
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
        },
        {
            name:'TranscodeOverwrite',
            type: 'boolean',
            defaultValue: true,
            inputUI: { type: 'dropdown', options: ['false', 'true'] },
            tooltip: `This makes sure that your codec matches, so if the file is in a different codec and the bitrate is bellow the optimal, it will transcode it to your optimal settings.`
        },
    ]})
};

async function plugin(file, librarySettings, Inputs, otherArguments) {
    const lib = require('../methods/lib')(); //load the library needed to read the inputs
    let userInputs = lib.loadDefaultValues(Inputs, details); // load the default values from the inputs in details

    //create the default reponse object.
    const response = {processFile: false, preset: ', ', container: `.${userInputs.targetFileType}`, handBrakeMode: false, FFmpegMode: true, reQueueAfter: true, infoLog: ''}

    // Check if file is a video.
    let fileChecked = checkFileType(file.fileMedium, "video");
    response.infoLog += fileChecked.message;

    // Run only if the file is valid.
    if (fileChecked.validFlag){
        // Check the file Extension
        let fileExtChecked = checkFileExt(file.container, userInputs.targetFileType);
        response.infoLog += fileExtChecked.message;
        response.processFile = fileExtChecked.processFile;
        response.preset += fileExtChecked.preset;
        response.container = fileExtChecked.container !== '' ? fileExtChecked.container : response.container;

        if (response.processFile){return response;} // Remux the file if the response is set to true.

        // Step 1 - Clean the File
        let fileCleaned = cleanFile(file, userInputs);
        if (fileCleaned.processFile) {
            response.processFile = fileCleaned.processFile;
            response.infoLog += fileCleaned.message;
            response.preset += `-map 0:v? -c:v copy -map 0:a? -c:a copy -map 0:s? -c:s copy -map 0:t? -c:t copy ${fileCleaned.preset}`;
            return response;
        }

        // Step 2 - Optimize audio tracks.
    }

    return response
}



module.exports.details = details;
module.exports.plugin = plugin;
module.exports.dependencies = ['ffprobe-static']