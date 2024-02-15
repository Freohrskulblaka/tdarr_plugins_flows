const details = () => ({
	id: "Tdarr_Plugin_002_Standardize_Audio",
	Name: "Standardize Audio Tracks - (Label, Convert, etc)",
	Stage: "Pre-processing",
	Type: "Audio",
	Operation: "Transcode",
	Description: "This process will standardize the audio for the file. It Labels the tracks with the same format, creates an aac stereo tracks and downmixes the audio.",
	Version: "1.5",
	Tags: "pre-processing, ffmpeg, audio-only, configurable",
	Inputs:[
		{
            name: 'remove_duplicate_tracks',
            type: 'boolean',
            defaultValue: true,
            inputUI: { type: 'dropdown', options: ['false', 'true'] },
            tooltip: `This will keep the highest quality version for the given channels/language.`
        },
		{
            name: 'downmix_tracks',
            type: 'boolean',
            defaultValue: true,
            inputUI: { type: 'dropdown', options: ['false', 'true'] },
            tooltip: `Create the missing tracks for each channel/language.`
        },
		{
            name: 'label_tracks',
            type: 'boolean',
            defaultValue: true,
            inputUI: { type: 'dropdown', options: ['false', 'true'] },
            tooltip: `This will rename the audio tracks to a standard naming convension.`
        },
		{
            name: 'convert_stereo_tracks',
            type: 'boolean',
            defaultValue: true,
            inputUI: { type: 'dropdown', options: ['false', 'true'] },
            tooltip: `This will convert stereo tracks to AAC.`
        },
		{
            name: 'convert_surround_tracks',
            type: 'boolean',
            defaultValue: true,
            inputUI: { type: 'dropdown', options: ['false', 'true'] },
            tooltip: `This will convert Surround Tracks AC3.`
        },
		{
            name: 'surround_codec_list',
            type: 'string',
            defaultValue: 'flac,opus,eac3,dts',
            inputUI: {type: 'text'},
            tooltip: `Specify the list of codecs that you want to convert to ac3
            \\nExample:\\n
            flac
            \\nExample:\\n
            flac,opus`
        },
		{
            name: 'keep_dts_hd_ma',
            type: 'boolean',
            defaultValue: true,
            inputUI: { type: 'dropdown', options: ['false', 'true'] },
            tooltip: `This will keep or convert the DTS-HD MA Track.`
        },
	]
});

const plugin = (file, librarySettings, Inputs) => {
	const lib = require('../methods/lib')(); //load the library needed to read the inputs
    Inputs = lib.loadDefaultValues(Inputs, details); // load the default values from the inputs in details

    //Default Return object.
    var response = {processFile: false, preset: ', -map 0 -c copy ', container: '.mkv', handBrakeMode: false, FFmpegMode: true, reQueueAfter: true, infoLog: ''}

    //Check if file is a video. If it isn't then exit plugin.
    if (file.fileMedium !== 'video') {
        response.infoLog += '- Not a Valid Video File. \n';
        return response;
    }
	

	//Set up required variables.
    let convertFile = false;
	let duplicateTrackCode = '';
	let downmixTrackCode = '';
	let convertTrackCode = '';
	let labelTrackCode = '';
	const fileStreams = file.ffProbeData.streams; //Grab Entire Stream Array
	const audioStreams = fileStreams.filter(codec => codec.codec_type === 'audio'); //Filter to only the audio streams
	const AudioDetails = {
		totaltracks: 0, 		
		details : {
			channels:{'1':false, '2': false, '6': false, '8': false},
			languages:{eng: false, spa: false, lat: false, jpn: false, und: false},
		},
	};

	//Grab the files Audio Details.
	if(typeof audioStreams !== 'undefined'){
		//Store the count of tracks in the file
		AudioDetails.totaltracks = audioStreams.length;

		//Populate the Audio Detail Object
		for (let i = 0; i < audioStreams.length; i++) {
			//Variables for Language and Channel
			current_language = (typeof audioStreams[i].tags.language !== 'undefined') ? audioStreams[i].tags.language.toLowerCase() : 'eng';
			current_channel = audioStreams[i].channels;
			current_codec = audioStreams[i].codec_name;
			current_codec_profile = audioStreams[i].profile;
			
			//Populate AudioDetail Object
			AudioDetails['details'] = {
				...AudioDetails.details,
				['channels'] : {...AudioDetails['details']['channels'], [current_channel] : true },
				['languages'] : {...AudioDetails['details']['languages'], [current_language] : true},
				[`${current_language}_channels`] : {'2': false, '6': false, '8': false,	...AudioDetails['details'][`${current_language}_channels`], [current_channel] : true } ,
				[`${current_language}_counts`] : AudioDetails['details'][`${current_language}_counts`] + 1 || 1 ,
				[`${current_language}_${current_channel}_counts`] : AudioDetails['details'][`${current_language}_${current_channel}_counts`] + 1 || 1 ,
				[`${current_language}_${current_codec}${(current_codec_profile === 'DTS-HD MA') ? 'hd': ''}_${current_channel}_counts`] : AudioDetails['details'][`${current_language}_${current_codec}${(current_codec_profile === 'DTS-HD MA') ? 'hd': ''}_${current_channel}_counts`] + 1 || 1 ,
				[`${current_language}_${current_codec}${(current_codec_profile === 'DTS-HD MA') ? 'hd': ''}`] : {
					...AudioDetails['details'][`${current_language}_${current_codec}${(current_codec_profile === 'DTS-HD MA') ? 'hd': ''}`], 
					[current_channel] : true}, 
			}
		}
	}

	//Remove duplicate tracks
	if(Inputs.remove_duplicate_tracks === true) {
		// ffmpegCommand = ', -map 0:v -map 0:a -c:v copy -c:a copy ';
		for (let i = 0; i < audioStreams.length; i++) {
			//Grab the current audio language
			current_audio_language = (typeof audioStreams[i].tags.language !== 'undefined') ? audioStreams[i].tags.language.toLowerCase(): 'eng';
			current_codec = audioStreams[i].codec_name;
			current_codec_profile = audioStreams[i].profile;
			current_channel = audioStreams[i].channels;
			remove_track = false;

			//Check if the tracks have more than one per language per channel
			if(audioStreams.length > 1 && AudioDetails['details'][`${current_audio_language}_counts`] > 1 && AudioDetails['details'][`${current_audio_language}_${current_channel}_counts`] > 1){
				//Keep only the highest quality per channel per language. The Atmos and the DTS-HD Master tracks are not removed
				//Remove AAC if something better exists
				if(AudioDetails.details.hasOwnProperty(`${current_audio_language}_aac`)){
					if(AudioDetails['details'][`${current_audio_language}_aac`].hasOwnProperty(current_channel) && current_codec === 'aac' && current_channel > 2) {
						if(AudioDetails['details'].hasOwnProperty([`${current_audio_language}_truehd`][current_channel]) ||  AudioDetails['details'].hasOwnProperty([`${current_audio_language}_dtshd`][current_channel]) || AudioDetails['details'].hasOwnProperty([`${current_audio_language}_dts`][current_channel])|| AudioDetails['details'].hasOwnProperty([`${current_audio_language}_eac3`][current_channel]) || AudioDetails['details'].hasOwnProperty([`${current_audio_language}_ac3`][current_channel])) {
							remove_track = true;
							console.log('Removing the AAC track');
							response.infoLog += `- Audio stream detected as a lower quality ${current_codec} track, removing stream 0:s:${i} \n`;
						}
					}
				}				
				//Remove AC3 if something better exists
				if(AudioDetails.details.hasOwnProperty(`${current_audio_language}_ac3`)){
					if(AudioDetails['details'][`${current_audio_language}_ac3`].hasOwnProperty([current_channel]) && current_codec === 'ac3'){
						if(AudioDetails['details'].hasOwnProperty([`${current_audio_language}_truehd`][current_channel]) ||  AudioDetails['details'].hasOwnProperty([`${current_audio_language}_dtshd`][current_channel]) || AudioDetails['details'].hasOwnProperty([`${current_audio_language}_dts`][current_channel]) || AudioDetails['details'].hasOwnProperty([`${current_audio_language}_eac3`][current_channel])) {
							remove_track = true;
							console.log('Removing the AC3 track');
							response.infoLog += `- Audio stream detected as a lower quality ${current_codec} track, removing stream 0:s:${i} \n`;
						}
					}
				}
				//Remove EAC3 if something better exists
				if(AudioDetails.details.hasOwnProperty(`${current_audio_language}_eac3`)){
					if(AudioDetails['details'][`${current_audio_language}_eac3`].hasOwnProperty([current_channel]) && current_codec === 'eac3') {
						if(AudioDetails['details'].hasOwnProperty([`${current_audio_language}_truehd`][current_channel]) || AudioDetails['details'].hasOwnProperty([`${current_audio_language}_dtshd`][current_channel]) || AudioDetails['details'].hasOwnProperty([`${current_audio_language}_dts`][current_channel])) {
							remove_track = true;
							console.log('Removing the EAC3 track');
							response.infoLog += `- Audio stream detected as a lower quality ${current_codec} track, removing stream 0:s:${i} \n`;
						}
					}
				}
				//Remove DTS if something better exists
				if(AudioDetails.details.hasOwnProperty(`${current_audio_language}_dts`)){
					if(AudioDetails['details'][`${current_audio_language}_dts`].hasOwnProperty([current_channel]) && current_codec_profile === 'DTS') {
						if(AudioDetails['details'].hasOwnProperty([`${current_audio_language}_truehd`][current_channel]) || AudioDetails['details'].hasOwnProperty([`${current_audio_language}_dtshd`][current_channel])) {
							remove_track = true;
							console.log('Removing the DTS track');
							response.infoLog += `- Audio stream detected as a lower quality ${current_codec} track, removing stream 0:s:${i} \n`;
						}
					}
				}
				//Remove if there is more than one row per language, per channel, per codec
				console.log(AudioDetails);
				if(AudioDetails.details.hasOwnProperty(`${current_audio_language}_${current_codec}${(current_codec_profile === 'DTS-HD MA') ? 'hd': ''}_${current_channel}_counts`)){
					if(AudioDetails['details'][`${current_audio_language}_${current_codec}${(current_codec_profile === 'DTS-HD MA') ? 'hd': ''}_${current_channel}_counts`] > 1){
						remove_track = true;
						AudioDetails['details'][`${current_audio_language}_${current_codec}${(current_codec_profile === 'DTS-HD MA') ? 'hd': ''}_${current_channel}_counts`] = AudioDetails['details'][`${current_audio_language}_${current_codec}${(current_codec_profile === 'DTS-HD MA') ? 'hd': ''}_${current_channel}_counts`] - 1;
						response.infoLog += `- Audio stream detected as a duplicate track, removing stream 0:s:${i} \n`;
					}
				}

				//Create the Code for removal
				if(remove_track === true){
					convertFile = true;
					duplicateTrackCode += `-map -0:a:${i} `;
					response.processFile = true;
				}
			}
		}

		if (convertFile === false){
			console.log('No Duplicate Tracks Found');
		}
		// if(convertFile === true) {response.preset = ffmpegCommand + ` -map 0:s? -c:s copy`; return response;}
	}

	//Downmix Audio Tracks in the file.
	if(Inputs.downmix_tracks === true){
		audioID = audioStreams.length;
		// ffmpegCommand = ', -map 0:v -map 0:a -c:v copy -c:a copy ';
		console.log('Checking for Tracks that need Downmixing');

		for (let i = 0; i < audioStreams.length; i++) {
			//Grab the current audio language
			current_audio_language = (typeof audioStreams[i].tags.language !== 'undefined') ? audioStreams[i].tags.language.toLowerCase(): 'eng';
			current_codec = audioStreams[i].codec_name;
			current_channel = audioStreams[i].channels;

			//Has an 8 channel track but no 6 channel track. Create a 6 channel ac3 track.
			if(current_channel >= 7 && AudioDetails['details'][`${current_audio_language}_channels`]['6'] === false){
				convertFile = true;
				downmixTrackCode += `-map 0:a:${i} -c:a:${audioID} ac3 -b:a 640k -ac:a:${audioID} 6 -filter:a:${audioID} "volume=1.5" -metadata:s:a:${audioID} "title=5.1 Surround - ac3 - ${current_audio_language}" `;
				response.infoLog += `- No 6 channel track exists. Creating 6 channel from ${current_channel} channel. \n`;
				response.processFile = true;
				audioID += 1;
			} 

			//Has an 8 channel track but no Stereo track. Create a Stereo AAC track.
			if (current_channel >= 7 && AudioDetails['details'][`${current_audio_language}_channels`]['2'] === false){
				convertFile = true;
				downmixTrackCode += `-map 0:a:${i} -c:a:${audioID} aac -b:a 160k -ac:a:${audioID} 2 -filter:a:${audioID} "volume=1.5" -metadata:s:a:${audioID} "title=Stereo - aac - ${current_audio_language}" `;
				response.infoLog += `- No Stereo track exists. Creating Stereo from ${current_channel} channel. \n`;
				response.processFile = true;
				audioID += 1;
			}

			//Has a 6 Channel Track but no Stereo Track. Create a Stereo AAC Track.
			if(current_channel  <= 6 && AudioDetails['details'][`${current_audio_language}_channels`]['8'] === false && AudioDetails['details'][`${current_audio_language}_channels`]['2'] === false){
				convertFile = true;
				downmixTrackCode += `-map 0:a:${i} -c:a:${audioID} aac -b:a 160k -ac:a:${audioID} 2 -filter:a:${audioID} "volume=1.5" -metadata:s:a:${audioID} "title=Stereo - aac - ${current_audio_language}" `;
				response.infoLog += '- Audio track is 6 channel, no stereo tracks exists. Creating stereo track from 6 channel. \n';
				response.processFile = true;
				audioID += 1;
			}
		}
		
		// if(convertFile === true) {response.preset = ffmpegCommand + ` -map 0:s? -c:s copy`; console.log(response); return response;}
		if (convertFile === false){
			response.infoLog += `- Remux Process Completed. \n`;
		}
	}

	//This section converts the stereo tracks to aac
	console.log('Checking for Non AAC Stereo Tracks')
	if(Inputs.convert_stereo_tracks === true) {
		if (typeof audioStreams !== 'undefined') {
			for (let i = 0; i < audioStreams.length; i++) {
				//Grab the current audio language
				current_audio_language = (typeof audioStreams[i].tags.language !== 'undefined') ? audioStreams[i].tags.language.toLowerCase(): 'eng';
				current_codec = audioStreams[i].codec_name;
				current_channel = audioStreams[i].channels;
	
				if(current_codec !== 'aac' && current_channel === 2){
					convertFile = true;
					convertTrackCode += `-c:a:${i} aac -b:a 160k -ac:a:${i} 2 -filter:a:${i} "volume=1.5" -metadata:s:a:${i} "title=Stereo - aac - ${current_audio_language}" `;
					response.infoLog += `- Audio track is stereo track but is not AAC, converting it to AAC. \n`;
				}
			}
		}
		if(convertFile === false){
			response.infoLog += `- Stereo Tracks Codec Process Completed. \n`
			console.log('No Stereo Track Found that is Not AAC');
		}
    }

	//This section converts surround tracks to ac3
	if(Inputs.convert_surround_tracks === true) {
		let NonWantedCodec = Inputs.surround_codec_list.split(',');
		let keepDTSHD = Inputs.keep_dts_hd_ma
		if (typeof audioStreams !== 'undefined') {
			for (let i = 0; i < audioStreams.length; i++) {
				//Grab the current audio language
				current_audio_language = (typeof audioStreams[i].tags.language !== 'undefined') ? audioStreams[i].tags.language.toLowerCase(): 'eng';
				current_codec = audioStreams[i].codec_name;
				current_channel = audioStreams[i].channels;
				current_profile = (keepDTSHD === true ? audioStreams[i].profile : 'audio');
	
				if(current_channel === 6 && NonWantedCodec.includes(current_codec) && current_profile !== 'DTS-HD MA'){
					convertFile = true;
					convertTrackCode += `-c:a:${i} ac3 -b:a 640k -ac:a:${i} 6 -filter:a:${i} "volume=1.5" -metadata:s:a:${i} "title=${current_channel-1}.1 Surround - ac3 - ${current_audio_language}" `;
					response.infoLog += `- Audio track is ${current_codec}, converting it to AC3. \n`;
				}
			}
		}
		if(convertFile === false){
			response.infoLog += `- Surround Conversion Process Completed. \n`;
		}
	}

	//Standardize the track names
	if(Inputs.label_tracks === true){
		let keepDTSHD = Inputs.keep_dts_hd_ma
		for (let i = 0; i < audioStreams.length; i++) {
			//Grab the current audio language
			current_audio_language = (typeof audioStreams[i].tags.language !== 'undefined') ? audioStreams[i].tags.language.toLowerCase(): 'eng';
			current_codec = audioStreams[i].codec_name;
			current_title = (typeof audioStreams[i].tags.title === 'undefined') ? '' : audioStreams[i].tags.title;
			current_channel = audioStreams[i].channels;
			current_profile = (keepDTSHD === true ? audioStreams[i].profile : 'audio');
			MAProfile = (current_channel >= 6 && current_codec === 'dts' && current_profile === 'DTS-HD MA') ? '-hd ma':'';

			if ((current_title === '' || current_title !== `${current_channel-1}.1 Surround - ${current_codec}${MAProfile} - ${current_audio_language}`) && current_channel > 2) {
				convertFile = true;
				labelTrackCode += `-metadata:s:a:${i} "title=${current_channel-1}.1 Surround - ${current_codec}${MAProfile} - ${current_audio_language}" \n`;
				response.infoLog += `- Audio stream detected as ${current_channel} channel with no title, tagging stream 0:a:${i} \n`;
				response.processFile = true;
			}
			if ((current_title === '' || current_title !== `${(current_channel ===2) ? 'Stereo': 'Mono'} - ${current_codec} - ${current_audio_language}`) && current_channel <= 2) {
				convertFile = true;
				labelTrackCode += `-metadata:s:a:${i} "title=${(current_channel ===2) ? 'Stereo': 'Mono'} - ${current_codec} - ${current_audio_language}" \n`;
				response.infoLog += `- Audio stream detected as ${current_channel} channel with no title, tagging stream 0:a:${i} \n`;
				response.processFile = true;
			}
		}
		// if(convertFile === true) {response.preset = `, -map 0 -c copy ${ffmpegCommandInsert} -max_muxing_queue_size 9999` ; return response;} 
		if(convertFile === false){
			response.infoLog += `- Standard Track Names Process Completed. \n`
		}
	}

	if(convertFile === true) {
		response.preset = `, -map 0:v -c:v copy -map 0:a -c:a copy ${duplicateTrackCode} ${downmixTrackCode} ${convertTrackCode} ${labelTrackCode} -map 0:s? -c:s copy -map 0:t? -c:t copy -max_muxing_queue_size 9999`; 
		return response;
	} 
	
	return response;
}

module.exports.details = details;
module.exports.plugin = plugin;