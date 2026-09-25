"""Assemble Cici Studio footage with the campaign's exact Vietnamese type."""
from pathlib import Path
import json
import subprocess
import cv2
import imageio_ffmpeg

PACK = Path(__file__).resolve().parent.parent
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
MAIN = 8.0
END = 3.0

def run(args, logfile):
    result = subprocess.run([FFMPEG, '-hide_banner', '-y', *args], capture_output=True, text=True, encoding='utf-8', errors='replace')
    logfile.write_text(result.stderr, encoding='utf-8')
    if result.returncode:
        raise RuntimeError(result.stderr[-3000:])

def info(file):
    cap = cv2.VideoCapture(str(file))
    if not cap.isOpened():
        raise RuntimeError(f'Cannot open {file}')
    data = {'width': int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), 'height': int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)), 'fps': cap.get(cv2.CAP_PROP_FPS), 'frames': int(cap.get(cv2.CAP_PROP_FRAME_COUNT))}
    cap.release()
    data['duration'] = round(data['frames']/data['fps'], 3)
    return data

def render(kind):
    base = PACK / 'source' / f'native-{kind}.mp4'
    source_kind = 'Cici Studio generated video'
    if not base.exists():
        base = PACK / 'source' / f'motion-{kind}.mp4'
        source_kind = 'Editorial pan/zoom of a Cici Studio generated still image'
    src = info(base)
    key = '01-breeze' if kind == 'breeze' else '02-mesh'
    name = f'{key}-reel-1080x1920'
    output = PACK / 'videos' / f'{name}.mp4'
    args = ['-i', str(base)]
    for i in range(1, 4):
        args += ['-loop', '1', '-framerate', '30', '-t', str(MAIN), '-i', str(PACK / 'images' / f'overlay-{key}-{i}.png')]
    args += ['-loop', '1', '-framerate', '30', '-t', str(END), '-i', str(PACK / 'images' / 'reel-end-card-1080x1920.png')]
    stretch = MAIN / src['duration']
    filters = (
        f'[0:v]setpts={stretch:.8f}*(PTS-STARTPTS),scale=1080:1920:force_original_aspect_ratio=increase:flags=lanczos,'
        f'crop=1080:1920,setsar=1,fps=30,tpad=stop_mode=clone:stop_duration=1,trim=duration={MAIN},format=rgba[base];'
        "[base][1:v]overlay=0:0:shortest=1:enable='lt(t,2.5)'[a];"
        "[a][2:v]overlay=0:0:shortest=1:enable='gte(t,2.5)*lt(t,5.3)'[b];"
        "[b][3:v]overlay=0:0:shortest=1:enable='gte(t,5.3)'[c];"
        f'[c]trim=duration={MAIN},setpts=PTS-STARTPTS,format=yuv420p[main];'
        f'[4:v]trim=duration={END},setpts=PTS-STARTPTS,setsar=1,format=yuv420p[end];'
        '[main][end]concat=n=2:v=1:a=0[outv]'
    )
    args += ['-filter_complex', filters, '-map', '[outv]', '-an', '-t', str(MAIN+END), '-r', '30', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', str(output)]
    run(args, PACK / 'source' / f'{kind}-encode.log')
    final = info(output)
    if final['width'] != 1080 or final['height'] != 1920 or abs(final['duration'] - 11) > .1:
        raise RuntimeError(f'Unexpected render: {final}')
    for t in [0.2, 3.5, 6.5, 9.3]:
        run(['-ss', str(t), '-i', str(output), '-frames:v', '1', '-update', '1', str(PACK / 'source' / f'review-{kind}-{t}.png')], PACK / 'source' / 'frame-extract.log')
    lines = {
        'breeze': [('Một góc nhà, nhẹ hơn.', '00:00:00,000', '00:00:02,500'), ('Bắt đầu từ khung cửa.', '00:00:02,500', '00:00:05,300'), ('Gửi ảnh khung cửa. Rèm Vina tư vấn.', '00:00:05,300', '00:00:08,000')],
        'mesh': [('Lưới vừa khung cửa bạn.', '00:00:00,000', '00:00:02,500'), ('Mỗi khung cửa, một số đo riêng.', '00:00:02,500', '00:00:05,300'), ('Gửi ảnh khung cửa. Shop cùng chọn size.', '00:00:05,300', '00:00:08,000')]
    }[kind] + [('Rèm Vina — Vừa khung cửa. Hợp nếp nhà.\nNhắn ảnh khung cửa · shopee.vn/remvina.vn', '00:00:08,000', '00:00:11,000')]
    srt = '\n\n'.join(f'{n}\n{start} --> {end}\n{text}' for n,(text,start,end) in enumerate(lines,1)) + '\n'
    (PACK/'videos'/f'{name}.srt').write_text(srt, encoding='utf-8')
    return {'file': str(output.relative_to(PACK)).replace('\\','/'), 'sourceKind': source_kind, 'source': src, 'export': final, 'audio': 'Silent; Vietnamese titles are burned in.', 'sourceSpeedFactor': round(src['duration']/MAIN, 4)}

if __name__ == '__main__':
    import sys
    requested = sys.argv[1:] or ['breeze', 'mesh']
    reportfile = PACK / 'source' / 'video-validation.json'
    report = json.loads(reportfile.read_text(encoding='utf-8')) if reportfile.exists() else {}
    for kind in requested:
        report[kind] = render(kind)
        reportfile.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
        print(json.dumps(report[kind], ensure_ascii=False), flush=True)
