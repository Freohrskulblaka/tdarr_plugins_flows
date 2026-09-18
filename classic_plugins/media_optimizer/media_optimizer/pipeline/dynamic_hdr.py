"""Opt-in verified dynamic HDR restoration runner. Created by: Freohrskulblaka."""

from pathlib import Path
from fractions import Fraction
import ctypes
import hashlib
import json
import os
import re
import shutil
import signal
import subprocess
import sys
import xml.etree.ElementTree as ET


def run_job(job):
    source = Path(job['sourcePath']).resolve()
    output = Path(job['outputPath']).resolve()
    if source == output:
        raise ValueError('HDR output must be separate from the source.')
    required = ['ffmpeg', 'ffprobe', 'mkvmerge', 'mkvextract', 'mkvpropedit',
                'dovi' if job.get('type') == 'dolbyVision' else 'hdr10plus']
    tools = job.get('tools', {})
    if job.get('version') != 1 or job.get('type') not in ('dolbyVision', 'hdr10plus'):
        raise ValueError('Unsupported HDR job version or metadata type.')
    if not source.is_file() or output.exists():
        raise ValueError('Source must exist and output must not already exist.')
    work = Path(job['workDir']).resolve()
    if (not work.is_dir() or work.parent != output.parent or not work.name.startswith('.media-optimizer-hdr-')
            or source.is_relative_to(work)):
        raise ValueError('HDR staging directory must be a separate cache subdirectory.')
    active = None

    def stop(signum, _frame):
        if active and active.poll() is None:
            active.terminate()
            try:
                active.wait(timeout=10)
            except subprocess.TimeoutExpired:
                active.kill()
        raise RuntimeError(f'HDR job cancelled by signal {signum}.')

    previous_handlers = {number: signal.signal(number, stop) for number in (signal.SIGINT, signal.SIGTERM)}

    def command(name, args, capture=False):
        nonlocal active
        # Prevent orphaned encoders if a Linux worker hard-kills this runner.
        parent_pid = os.getpid()

        def bind_parent():
            if ctypes.CDLL(None, use_errno=True).prctl(1, signal.SIGTERM, 0, 0, 0) != 0:
                raise OSError(ctypes.get_errno(), 'Unable to bind HDR child process to its runner.')
            if os.getppid() != parent_pid:
                os.kill(os.getpid(), signal.SIGTERM)

        active = subprocess.Popen([tools[name], *map(str, args)],
                                  stdout=subprocess.PIPE if capture else None,
                                  env={**os.environ, 'LC_ALL': 'C', 'LANG': 'C'},
                                  preexec_fn=bind_parent if sys.platform.startswith('linux') else None)
        data, _ = active.communicate()
        code = active.returncode
        active = None
        if code != 0:
            raise RuntimeError(f'HDR {name} failed with exit code {code}.')
        return data.decode('utf-8-sig') if capture else ''

    def identify(file):
        return json.loads(command('mkvmerge', ['-J', file], True))

    def timestamps(file, tracks, label):
        files = [work / f'{label}-{index}.timestamps' for index in range(len(tracks))]
        command('mkvextract', [file, 'timestamps_v2', *[f'{track["id"]}:{target}' for track, target in zip(tracks, files)]])
        return [[float(line) for line in target.read_text(encoding='utf-8-sig').splitlines()
                 if line and not line.startswith('#')] for target in files], files

    def metadata(file, target):
        if job['type'] == 'dolbyVision':
            command('dovi', ['-m', '2', 'extract-rpu', '-o', target, file])
            summary = command('dovi', ['info', '-i', target, '--summary'], True)
            match = re.search(r'Frames:\s*(\d+)', summary)
            if not match or not re.search(r'Profile:\s*8\s*\n', summary):
                raise ValueError('Restored Dolby Vision must be Profile 8.1 metadata.')
            return int(match[1]), hashlib.sha256(target.read_bytes()).hexdigest()
        command('hdr10plus', ['extract', '-o', target, file])
        scenes = json.loads(target.read_text(encoding='utf-8-sig')).get('SceneInfo', [])
        if not scenes or [scene.get('SequenceFrameIndex') for scene in scenes] != list(range(len(scenes))):
            raise ValueError('HDR10+ metadata must cover every frame in presentation order.')
        return len(scenes), scenes

    def static_headers(sides, properties=None):
        values = {}
        fields = {
            'Mastering display metadata': {
                'red_x': 'chromaticity-coordinates-red-x', 'red_y': 'chromaticity-coordinates-red-y',
                'green_x': 'chromaticity-coordinates-green-x', 'green_y': 'chromaticity-coordinates-green-y',
                'blue_x': 'chromaticity-coordinates-blue-x', 'blue_y': 'chromaticity-coordinates-blue-y',
                'white_point_x': 'white-coordinates-x', 'white_point_y': 'white-coordinates-y',
                'min_luminance': 'min-luminance', 'max_luminance': 'max-luminance',
            },
            'Content light level metadata': {'max_content': 'max-content-light', 'max_average': 'max-frame-light'},
        }
        for side in sides:
            for key, property_name in fields.get(side.get('side_data_type'), {}).items():
                if key in side:
                    value = Fraction(side[key])
                    values[property_name] = int(value) if value.denominator == 1 else float(value)
        properties = properties or {}
        for key, names in {
            'chromaticity_coordinates': [f'chromaticity-coordinates-{color}-{axis}'
                                        for color in ('red', 'green', 'blue') for axis in ('x', 'y')],
            'white_color_coordinates': ['white-coordinates-x', 'white-coordinates-y'],
        }.items():
            if key in properties:
                coordinates = json.loads(f'[{properties[key]}]')
                if len(coordinates) != len(names):
                    raise ValueError('Invalid MKV static HDR coordinate header.')
                values.update(zip(names, coordinates))
        for mapping in fields.values():
            for name in mapping.values():
                if name.replace('-', '_') in properties:
                    values[name] = properties[name.replace('-', '_')]
        return values

    def verify_static_hdr(file, expected, label, allow_new=False):
        # Raw HEVC avoids container-inherited frame metadata hiding SEI conflicts.
        frames = json.loads(command('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-read_intervals', '%+#32',
                            '-show_frames', '-show_entries', 'frame=side_data_list', '-of', 'json', file], True))['frames']
        if not frames:
            raise ValueError(f'{label} metadata probe produced no decoded video frames.')
        baseline = dict(expected)
        for index, frame in enumerate(frames):
            actual = static_headers(frame.get('side_data_list', []))
            changed = {key: (baseline.get(key), value) for key, value in actual.items()
                       if (key not in baseline and not allow_new)
                       or (key in baseline and abs(value - baseline[key]) > 0.000001)}
            if changed:
                raise ValueError(f'{label} metadata conflict at sampled frame {index}: {changed}. '
                                 'Use a copy mode or a known-good source/encoder; do not guess RGB ordering.')
            if allow_new:
                baseline.update({key: value for key, value in actual.items() if key not in baseline})
        return baseline

    try:
        for name in required:
            if not tools.get(name) or not shutil.which(tools[name]):
                raise ValueError(f'Required HDR tool is unavailable: {name}')
        print('Media Optimizer: checking dynamic HDR tools and source.', flush=True)
        for name in required:
            version = command(name, ['-version' if name in ('ffmpeg', 'ffprobe') else '--version'], True)
            if name == 'dovi' and not re.search(r'\b2\.3\.4\b', version):
                raise ValueError('Dolby Vision restoration requires dovi_tool 2.3.4.')
            if name == 'hdr10plus' and not re.search(r'\b1\.7\.2\b', version):
                raise ValueError('HDR10+ restoration requires hdr10plus_tool 1.7.2.')
        probe = json.loads(command('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', source], True))
        video = next(stream for stream in probe['streams'] if stream['codec_type'] == 'video')
        if (video['codec_name'] != 'hevc' or video.get('width') != job['width'] or video.get('height') != job['height']
                or video.get('pix_fmt') != 'yuv420p10le' or video.get('color_transfer') != 'smpte2084'
                or video.get('color_primaries') != 'bt2020' or video.get('color_space') != 'bt2020nc'
                or video.get('color_range') not in ('tv', 'pc')):
            raise ValueError(f'Restoration requires the declared 10-bit HEVC HDR10 source geometry: { {key: video.get(key) for key in ("width", "height", "pix_fmt", "color_transfer", "color_primaries", "color_space", "color_range")} }')
        target_width = job.get('outputWidth', job['width'])
        target_height = job.get('outputHeight', job['height'])
        resize = (target_width, target_height) != (job['width'], job['height'])
        if resize and (job['type'] != 'dolbyVision'
                       or (job['width'], job['height'], target_width, target_height) != (3840, 2160, 1920, 1080)
                       or video.get('sample_aspect_ratio') != '1:1'):
            raise ValueError('Dolby Vision resizing supports only square-pixel 3840x2160 to 1920x1080 without cropping.')
        source_info = identify(source)
        source_video = next(track for track in source_info['tracks'] if track['type'] == 'video')
        duration = float(probe['format']['duration'])
        video_bytes = next((int(value) for key, value in video.get('tags', {}).items()
                            if key.upper().startswith('NUMBER_OF_BYTES')), 0)
        auxiliary_bound = max(0, source.stat().st_size - min(video_bytes, source.stat().st_size))
        required_space = int(duration * job['targetKbps'] * 1000 / 8 * 5 + auxiliary_bound * 2)
        if duration <= 0 or job['targetKbps'] <= 0 or shutil.disk_usage(work).free < required_space:
            raise ValueError('Insufficient HDR staging space or invalid bitrate/duration.')
        expected_metadata = work / ('expected.rpu' if job['type'] == 'dolbyVision' else 'expected.json')
        if job['type'] == 'dolbyVision':
            original_metadata = work / 'original.rpu'
            command('dovi', ['extract-rpu', '-o', original_metadata, source])
            summary = command('dovi', ['info', '-i', original_metadata, '--summary'], True)
            dovi = next((side for side in video.get('side_data_list', []) if side.get('dv_profile')), {})
            mel = dovi.get('dv_profile') == 7 and re.search(r'Profile:\s*7 \(MEL\)\s*\n', summary)
            profile81 = (dovi.get('dv_profile') == 8 and dovi.get('dv_bl_signal_compatibility_id') == 1
                         and dovi.get('rpu_present_flag') == 1 and dovi.get('bl_present_flag') == 1
                         and dovi.get('el_present_flag') == 0 and re.search(r'Profile:\s*8\s*\n', summary))
            if not mel and not profile81:
                raise ValueError('Only full-file Dolby Vision Profile 7 MEL or HDR10-compatible Profile 8.1 is supported; use a copy mode for other profiles.')
        source_sample = work / 'source-sample.hevc'
        command('ffmpeg', ['-hide_banner', '-v', 'error', '-nostdin', '-y', '-i', source,
                           '-map', '0:v:0', '-c:v', 'copy', '-frames:v', '32',
                           '-bsf:v', 'hevc_mp4toannexb', '-f', 'hevc', source_sample])
        static = verify_static_hdr(source_sample, static_headers(video.get('side_data_list', []), source_video['properties']),
                                   'Source static HDR', allow_new=True)
        expected_count, expected_identity = metadata(source, expected_metadata)
        if resize:
            config_path = work / 'active-area.json'
            command('dovi', ['export', '-i', expected_metadata, '--data', f'level5={config_path}'])
            config = json.loads(config_path.read_text(encoding='utf-8-sig'))
            area = config['active_area']
            # Export defaults to crop=true; resizing retains the letterbox bars.
            area['crop'] = False
            if not area.get('presets') or not area.get('edits'):
                raise ValueError('Dolby Vision resizing requires active-area presets and frame ranges.')
            for preset in area['presets']:
                for key in ('left', 'right', 'top', 'bottom'):
                    value = preset[key]
                    if type(value) is not int or value < 0 or value % 2:
                        raise ValueError('Dolby Vision resizing requires nonnegative, exactly divisible active-area offsets.')
                    preset[key] = value // 2
                if preset['left'] + preset['right'] >= target_width or preset['top'] + preset['bottom'] >= target_height:
                    raise ValueError('Invalid scaled Dolby Vision active area.')
            config_path.write_text(json.dumps(config), encoding='utf-8')
            adjusted = work / 'adjusted.rpu'
            command('dovi', ['editor', '-i', expected_metadata, '-j', config_path, '-o', adjusted])
            adjusted_config = work / 'adjusted-area.json'
            command('dovi', ['export', '-i', adjusted, '--data', f'level5={adjusted_config}'])
            actual_area = json.loads(adjusted_config.read_text(encoding='utf-8-sig'))['active_area']
            if any(actual_area[key] != area[key] for key in ('presets', 'edits')):
                raise ValueError('Adjusted Dolby Vision active-area presets/ranges changed unexpectedly.')
            adjusted_summary = command('dovi', ['info', '-i', adjusted, '--summary'], True)
            count = re.search(r'Frames:\s*(\d+)', adjusted_summary)
            if not count or int(count[1]) != expected_count or not re.search(r'Profile:\s*8\s*\n', adjusted_summary):
                raise ValueError('Adjusted Dolby Vision profile/frame count changed.')
            os.replace(adjusted, expected_metadata)
            expected_identity = hashlib.sha256(expected_metadata.read_bytes()).hexdigest()
        source_times, _ = timestamps(source, [source_video], 'source')
        # MKVToolNix v2 timestamp extraction includes the final frame's end time.
        if len(source_times[0]) != expected_count + 1:
            raise ValueError('Source metadata/frame count mismatch; no encoding performed.')

        print(f'Media Optimizer: encoding once; {expected_count} HDR frames verified.', flush=True)
        encoded = work / 'encoded.mkv'
        command('ffmpeg', ['-hide_banner', '-v', 'warning', '-stats', '-nostdin', '-y', '-i', source, *job['inputArgs'], *job['outputArgs'],
                           '-fps_mode:v', 'passthrough', '-enc_time_base:v', 'demux', encoded])
        # Refresh output statistics before taking the preservation baseline.
        command('mkvpropedit', [encoded, '--add-track-statistics-tags'])
        encoded_info = identify(encoded)
        encoded_tracks = encoded_info['tracks']
        if sum(track['type'] == 'video' for track in encoded_tracks) != 1:
            raise ValueError('Encoded output must contain exactly one video track.')
        encoded_times, timestamp_files = timestamps(encoded, encoded_tracks, 'encoded')
        encoded_video_index = next(index for index, track in enumerate(encoded_tracks) if track['type'] == 'video')
        encoded_video = encoded_tracks[encoded_video_index]
        if encoded_video['properties'].get('pixel_dimensions') != f'{target_width}x{target_height}':
            raise ValueError('Encoder output does not match the requested geometry.')
        timing = encoded_times[encoded_video_index][:-1]
        if len(timing) != expected_count or abs(timing[0] - source_times[0][0]) > 100:
            raise ValueError('Encoded video frame count/start time changed; restoration rejected.')
        for index, (left, right) in enumerate(zip(timing, source_times[0][:-1])):
            delta = (left - timing[0]) - (right - source_times[0][0])
            if abs(delta) > 1.1:
                raise ValueError(f'Encoded video presentation timeline changed at frame {index}: '
                                 f'source={right}ms, encoded={left}ms, relative delta={delta:.3f}ms; restoration rejected.')
        raw = work / 'encoded.hevc'
        command('ffmpeg', ['-hide_banner', '-v', 'warning', '-stats', '-nostdin', '-y', '-i', encoded, '-map', '0:v:0', '-c:v', 'copy',
                           '-bsf:v', 'hevc_mp4toannexb', '-f', 'hevc', raw])
        verify_static_hdr(raw, static, 'Encoded static HDR')
        restored = work / 'restored.hevc'
        print('Media Optimizer: restoring dynamic metadata and remuxing without another encode.', flush=True)
        if job['type'] == 'dolbyVision':
            command('dovi', ['inject-rpu', '-i', raw, '--rpu-in', expected_metadata, '-o', restored])
        else:
            command('hdr10plus', ['inject', '-i', raw, '-j', expected_metadata, '-o', restored])
        verify_static_hdr(restored, static, 'Restored static HDR')
        candidate = work / 'verified.mkv'
        properties = encoded_video['properties']
        merge_args = ['--disable-track-statistics-tags', '--disable-lacing', '-o', candidate,
                      '--timestamps', f'0:{timestamp_files[encoded_video_index]}',
                      '--language', f'0:{properties.get("language_ietf", properties.get("language", "und"))}',
                      '--track-name', f'0:{properties.get("track_name", "")}',
                      '--default-track-flag', f'0:{int(properties.get("default_track", False))}',
                      '--forced-display-flag', f'0:{int(properties.get("forced_track", False))}']
        if properties.get('default_duration'):
            merge_args.extend(['--default-duration', f'0:{properties["default_duration"]}ns'])
        if properties.get('display_dimensions'):
            merge_args.extend(['--display-dimensions', f'0:{properties["display_dimensions"]}'])
        if encoded_info.get('container', {}).get('properties', {}).get('title'):
            merge_args.extend(['--title', encoded_info['container']['properties']['title']])
        merge_args.extend([restored, '--no-video', '--no-track-tags', '--no-global-tags'])
        for index, track in enumerate(encoded_tracks):
            if track['type'] != 'video':
                merge_args.extend(['--timestamps', f'{track["id"]}:{timestamp_files[index]}'])
        merge_args.append(encoded)
        command('mkvmerge', merge_args)
        tags = work / 'tags.xml'
        command('mkvextract', [encoded, 'tags', tags])
        chapters = work / 'chapters.xml'
        command('mkvextract', [encoded, 'chapters', chapters])
        edits = ['--edit', f'track:{encoded_video_index + 1}', '--set', f'track-uid={properties["uid"]}',
                 '--set', 'color-matrix-coefficients=9', '--set', 'color-transfer-characteristics=16',
                 '--set', 'color-primaries=9', '--set', 'color-bits-per-channel=10',
                 '--set', f'color-range={1 if video["color_range"] == "tv" else 2}']
        for key, value in static.items():
            # Avoid scientific notation and long-decimal parsing drift in MKVToolNix.
            rendered = format(value, '.8f').rstrip('0').rstrip('.')
            edits.extend(['--set', f'{key}={rendered}'])
        for index, track in enumerate(encoded_tracks):
            if 'language_ietf' not in track['properties']:
                edits.extend(['--edit', f'track:{index + 1}', '--delete', 'language-ietf'])
        command('mkvpropedit', ['--disable-language-ietf', candidate, *edits, '--tags', f'all:{tags}',
                               '--chapters', chapters if chapters.exists() else ''])

        final_info = identify(candidate)
        final_tracks = final_info['tracks']
        if len(final_tracks) != len(encoded_tracks):
            raise ValueError('Restored output track count differs from the encoding plan.')
        header_keys = ['uid', 'track_name', 'language', 'language_ietf', 'default_track', 'forced_track', 'enabled_track',
                       'hearing_impaired', 'visual_impaired', 'text_descriptions', 'original', 'commentary',
                       'audio_channels', 'audio_sampling_frequency', 'pixel_dimensions', 'display_dimensions']
        for left, right in zip(encoded_tracks, final_tracks):
            if left['type'] != right['type'] or left['codec'] != right['codec']:
                raise ValueError('Restored output track codec/order changed.')
            changed = {key: (left['properties'].get(key), right['properties'].get(key)) for key in header_keys
                       if left['properties'].get(key) != right['properties'].get(key)}
            if changed:
                raise ValueError(f'Restored output track headers changed: {changed}')
        if encoded_info.get('attachments', []) != final_info.get('attachments', []):
            raise ValueError('Restored subtitle font attachments changed.')
        final_times, _ = timestamps(candidate, final_tracks, 'final')
        for track, left, right in zip(encoded_tracks, encoded_times, final_times):
            # Stream copy may restore a complete final audio packet's duration.
            end_tolerance = 100 if track['type'] == 'audio' else 1.1
            if (len(left) != len(right) or any(abs(a - b) > 1.1 for a, b in zip(left[:-1], right[:-1]))
                    or bool(left) != bool(right) or (left and abs(left[-1] - right[-1]) > end_tolerance)):
                raise ValueError(f'Restored output stream synchronization changed: {track["type"]}: {left[:3]} / {right[:3]}, {left[-1:]} / {right[-1:]}')
        final_tags = work / 'final-tags.xml'
        command('mkvextract', [candidate, 'tags', final_tags])
        def tag_identity(file):
            def node_identity(node):
                return (node.tag, tuple(sorted(node.attrib.items())), node.text if node.text and node.text.strip() else '',
                        tuple(sorted(node_identity(child) for child in node)))
            return node_identity(ET.parse(file).getroot())

        if tag_identity(tags) != tag_identity(final_tags):
            raise ValueError('Restored output track/global tags changed.')
        command('mkvextract', [candidate, 'chapters', work / 'final-chapters.xml'])
        final_chapters = work / 'final-chapters.xml'
        chapters_match = chapters.exists() == final_chapters.exists()
        if chapters_match and chapters.exists():
            left_root, right_root = ET.parse(chapters).getroot(), ET.parse(final_chapters).getroot()
            for left, right in zip(left_root.findall('EditionEntry'), right_root.findall('EditionEntry')):
                generated_uid = right.find('EditionUID')
                if left.find('EditionUID') is None and generated_uid is not None:
                    right.remove(generated_uid)
            chapters_match = ET.canonicalize(ET.tostring(left_root, encoding='unicode'), strip_text=True) == ET.canonicalize(
                ET.tostring(right_root, encoding='unicode'), strip_text=True)
        if not chapters_match:
            raise ValueError('Restored output chapters changed.')
        final_count, final_identity = metadata(candidate, work / 'final-metadata.bin')
        if final_count != expected_count or final_identity != expected_identity:
            raise ValueError('Restored dynamic HDR metadata does not exactly match the verified expected metadata.')
        output_probe = json.loads(command('ffprobe', ['-v', 'error', '-show_streams', '-of', 'json', candidate], True))
        final_video = next(stream for stream in output_probe['streams'] if stream['codec_type'] == 'video')
        if (final_video.get('width') != target_width or final_video.get('height') != target_height
                or final_video.get('pix_fmt') != 'yuv420p10le' or final_video.get('color_transfer') != 'smpte2084'):
            raise ValueError('Restored output lost the requested HDR10 video geometry/signaling.')
        if resize and final_video.get('sample_aspect_ratio') != '1:1':
            raise ValueError('Restored 1080p output changed the square-pixel aspect ratio.')
        if any(final_video.get(key) != video.get(key) for key in ('color_primaries', 'color_space', 'color_range')):
            raise ValueError('Restored output color signaling differs from the source.')
        final_static = static_headers(final_video.get('side_data_list', []), final_tracks[encoded_video_index]['properties'])
        changed_static = {key: (value, final_static.get(key)) for key, value in static.items()
                          if key not in final_static or abs(value - final_static[key]) > 0.000001}
        if changed_static:
            raise ValueError(f'Restored output static HDR mastering/light metadata changed: {changed_static}')
        if job['type'] == 'dolbyVision':
            dovi = next((side for side in final_video.get('side_data_list', []) if side.get('dv_profile')), {})
            if (dovi.get('dv_profile') != 8 or dovi.get('dv_bl_signal_compatibility_id') != 1
                    or dovi.get('rpu_present_flag') != 1 or dovi.get('bl_present_flag') != 1 or dovi.get('el_present_flag') != 0):
                raise ValueError('Restored container must signal Dolby Vision Profile 8.1.')
        hashes = []
        for file in (encoded, candidate):
            hashes.append(command('ffmpeg', ['-v', 'error', '-nostdin', '-i', file, '-map', '0:a?', '-map', '0:s?',
                                             '-c', 'copy', '-f', 'streamhash', '-hash', 'sha256', '-'], True))
        if hashes[0] != hashes[1]:
            raise ValueError('Restored audio/subtitle payload differs from the encoded output.')
        command('ffmpeg', ['-hide_banner', '-v', 'warning', '-stats', '-xerror', '-nostdin', '-i', candidate,
                           '-map', '0:v:0', '-an', '-sn', '-fps_mode:v', 'passthrough', '-enc_time_base:v', 'demux', '-f', 'null', '-'])
        if output.exists():
            raise ValueError('HDR cache output appeared during validation; refusing to overwrite it.')
        os.replace(candidate, output)
        print('Media Optimizer: dynamic HDR verified; publishing the cache output.', flush=True)
    finally:
        if active and active.poll() is None:
            active.terminate()
            try:
                active.wait(timeout=10)
            except subprocess.TimeoutExpired:
                active.kill()
                active.wait()
        for number, handler in previous_handlers.items():
            signal.signal(number, handler)
        shutil.rmtree(work)


if __name__ == '__main__':
    try:
        if sys.version_info < (3, 10):
            raise ValueError('HDR restoration requires Python 3.10 or newer.')
        with open(sys.argv[1], encoding='utf-8') as descriptor:
            job = json.load(descriptor)
        run_job(job)
    except Exception as error:
        print(f'Media Optimizer HDR failed: {error}', file=sys.stderr, flush=True)
        sys.exit(1)
