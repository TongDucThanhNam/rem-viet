"""Create moving-photo alternatives from the newly generated Cici images."""
from pathlib import Path
import importlib.util
module_spec = importlib.util.spec_from_file_location('render_videos', Path(__file__).with_name('render-videos.py'))
module = importlib.util.module_from_spec(module_spec)
module_spec.loader.exec_module(module)
PACK, run = module.PACK, module.run

for kind,filename,position in [('breeze','03-quiet-home.png','iw-ow'),('mesh','01-window-mesh.png','(iw-ow)/2')]:
    filters = (
        f'scale=2160:3840:force_original_aspect_ratio=increase:flags=lanczos,crop=2160:3840:x={position},'
        "zoompan=z='1.015+0.045*on/239':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=240:s=1080x1920:fps=30,format=yuv420p"
    )
    run(['-i',str(PACK/'source'/filename),'-vf',filters,'-frames:v','240','-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',str(PACK/'source'/f'motion-{kind}.mp4')],PACK/'source'/f'{kind}-motion-base.log')
    print(f'Rendered moving-photo alternative: {kind}',flush=True)
