from pathlib import Path
from html.parser import HTMLParser
import json
import zipfile

pack = Path(__file__).resolve().parent.parent
archive = pack.parent / f'{pack.name}-ready.zip'

class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []
    def handle_starttag(self, tag, attrs):
        for key, value in attrs:
            if key in ('href', 'src', 'poster') and value and not value.startswith(('http:', 'https:', '#', 'data:')):
                self.links.append(value)

parser = Links()
parser.feed((pack/'index.html').read_text(encoding='utf-8'))
missing = sorted(set(x for x in parser.links if not (pack/x).is_file()))
if missing:
    raise RuntimeError(f'Missing gallery files: {missing}')

files = [pack/name for name in ['index.html', 'README.md', 'provenance.json', 'preview.jpg']]
if (pack/'publication-record.json').is_file():
    files.append(pack/'publication-record.json')
files += [f for f in (pack/'images').glob('*.jpg') if f.name != 'reel-end-card-1080x1920.jpg']
files += [pack/'images'/'00-avatar-1080x1080.png']
if (pack/'images'/'00-avatar-light.png').is_file():
    files += [pack/'images'/'00-avatar-light.png']
files += list((pack/'videos').glob('*.mp4')) + list((pack/'videos').glob('*.srt'))
files += list((pack/'copy').glob('*.md')) + list((pack/'copy').glob('*.txt'))
files = sorted(set(files))
for f in files:
    if not f.is_file() or not f.stat().st_size:
        raise RuntimeError(f'Missing or empty deliverable: {f}')
with zipfile.ZipFile(archive,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as z:
    for f in files:
        z.write(f,f.relative_to(pack).as_posix())
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    names=set(z.namelist())
    absent = sorted(set(parser.links)-names)
    assert not absent, absent
report = {'archive':str(archive),'files':len(files),'bytes':archive.stat().st_size,'galleryLocalReferences':len(set(parser.links)),'missingReferences':missing,'zipCrcCheck':'passed','includedFiles':[f.relative_to(pack).as_posix() for f in files]}
(pack/'source'/'package-validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({k:v for k,v in report.items() if k!='includedFiles'},ensure_ascii=False))
