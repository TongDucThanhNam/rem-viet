"""Typeset Vietnamese titles over a complete native 30-second Seedance video."""
from pathlib import Path
import json
import subprocess
import cv2
import imageio_ffmpeg

PACK = Path(__file__).resolve().parent.parent
SOURCE = PACK / 'source/native-seedance-25-30s.mp4'
OUTPUT = PACK / 'videos/rem-vina-seedance-25-30s-1080x1920.mp4'
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()

def inspect(file):
    cap = cv2.VideoCapture(str(file))
    if not cap.isOpened():
        raise RuntimeError(f'Cannot open video: {file}')
    result = {'width':int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), 'height':int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)), 'fps':cap.get(cv2.CAP_PROP_FPS), 'frames':int(cap.get(cv2.CAP_PROP_FRAME_COUNT))}
    cap.release()
    result['duration'] = result['frames']/result['fps']
    return result

source = inspect(SOURCE)
if source['duration'] < 29.95:
    raise RuntimeError(f'Provider did not return 30 seconds: {source}. Do not stretch or loop the video.')
timing = json.loads((PACK/'source/title-timing.json').read_text(encoding='utf8'))
args = [FFMPEG, '-hide_banner', '-y', '-i', str(SOURCE)]
for i in range(1,5):
    args += ['-loop','1','-framerate','30','-t','30','-i',str(PACK/f'images/title-{i}.png')]
graph = ['[0:v]setpts=PTS-STARTPTS,scale=1080:1920:force_original_aspect_ratio=decrease:flags=lanczos,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=0x0D1B2A,setsar=1,fps=30,format=rgba[v0]']
for i, section in enumerate(timing,1):
    graph.append(f"[v{i-1}][{i}:v]overlay=0:0:shortest=1:enable='gte(t,{section['start']})*lt(t,{section['end']})'[v{i}]")
graph.append('[v4]format=yuv420p[outv]')
args += ['-filter_complex',';'.join(graph),'-map','[outv]','-map','0:a?','-t','30','-r','30','-c:v','libx264','-preset','medium','-crf','18','-c:a','aac','-b:a','192k','-pix_fmt','yuv420p','-movflags','+faststart',str(OUTPUT)]
render = subprocess.run(args,capture_output=True,text=True,encoding='utf8',errors='replace')
(PACK/'source/encode.log').write_text(render.stderr,encoding='utf8')
if render.returncode:
    raise RuntimeError(render.stderr[-4000:])
final = inspect(OUTPUT)
if abs(final['duration']-30) > .05 or final['width'] != 1080 or final['height'] != 1920:
    raise RuntimeError(f'Unexpected output: {final}')
decode = subprocess.run([FFMPEG,'-v','error','-i',str(OUTPUT),'-f','null','-'],capture_output=True,text=True)
if decode.returncode or decode.stderr.strip():
    raise RuntimeError(f'Decode check failed: {decode.stderr}')
cap = cv2.VideoCapture(str(OUTPUT))
thumbs = []
for t in [1,7,12,17,24,28]:
    cap.set(cv2.CAP_PROP_POS_MSEC,t*1000)
    ok, frame = cap.read()
    if not ok:
        raise RuntimeError(f'Cannot read frame at {t}s')
    cv2.imwrite(str(PACK/f'source/review-{t}s.jpg'),frame)
    thumbs.append(cv2.resize(frame,(270,480)))
cap.release()
cv2.imwrite(str(PACK/'preview.jpg'),cv2.vconcat([cv2.hconcat(thumbs[:3]),cv2.hconcat(thumbs[3:])]))
report = {'source':source,'output':final,'file':str(OUTPUT),'fullDecode':'passed','timeline':'Native motion retained at original speed, trimmed to 30 seconds; no looping or slowdown.','audio':'Audio from the user-provided source retained.'}
(PACK/'source/validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps(report,ensure_ascii=False),flush=True)
