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
            name:'UpdateFileStats',
            type: 'boolean',
            defaultValue: true,
            inputUI: { type: 'dropdown', options: ['false', 'true'] },
            tooltip: `This makes sure that the stats on the file are updated.`
        },

        
    ]
});

const plugin = (file, librarySettings, Inputs) => {
    const lib = require('../methods/lib')(); //load the library needed to read the inputs
    Inputs = lib.loadDefaultValues(Inputs, details); // load the default values from the inputs in details

    //Default Return object.
    var response = {processFile: false, preset: '',container: '.mkv', handBrakeMode: false, FFmpegMode: true, reQueueAfter: true, infoLog: ''}

    // Exit the Plugin Otherwise. 
    if(isVideoFile === false) {
        return response;
    }
    
    if (isVideoFile === true){
        // Variables
        let fileStreams = file.ffProbeData.streams; //Grab Entire Stream Array
        let fileMediaInfo = file.mediaInfo.track; //Grab the mediaInfo track Array
        let videoStreams = fileStreams.filter(codec => codec.codec_type === 'video'); //Filter to only the video streams

   
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
        



        // Handel the video processing
        if (videoNeedsProcessing) {

           // Handle the Processing of the file
            if (processFile){
                

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

    }
};

module.exports.details = details;
module.exports.plugin = plugin;