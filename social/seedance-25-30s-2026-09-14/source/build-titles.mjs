import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const pack = path.resolve(import.meta.dirname, '..');
const root = path.resolve(pack, '../..');
const fontDir = path.join(root, 'social/source/fonts');
const timing = JSON.parse(await fs.readFile(path.join(pack, 'source/title-timing.json'), 'utf8'));
const cream = '#F7F3EC';
const gold = '#D8BE97';
const escape = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;');
const icon = await sharp(path.join(root, 'social/facebook-launch-2026-09-14/source/logo-icon-cream.png')).resize(45, 56).png().toBuffer();

for (const [index, section] of timing.entries()) {
  const layers = [{input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920"><defs><linearGradient id="shade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0D1B2A" stop-opacity="0"/><stop offset="0.50" stop-color="#0D1B2A" stop-opacity="0.65"/><stop offset="1" stop-color="#0D1B2A" stop-opacity="0.85"/></linearGradient></defs><rect x="0" y="1090" width="1080" height="830" fill="url(#shade)"/><rect x="64" y="185" width="318" height="87" rx="13" fill="#0D1B2A" fill-opacity="0.76"/><path d="M80 1266 H178" stroke="${gold}" stroke-width="2"/></svg>`), left:0, top:0}, {input:icon, left:80, top:200}];
  async function text(value, left, top, size, serif=false, color=cream) {
    const font = serif ? 'Playfair Display SemiBold' : 'Montserrat Medium';
    const fontfile = path.join(fontDir, serif ? 'PlayfairDisplay-SemiBold.ttf' : 'Montserrat-Medium.ttf');
    const input = await sharp({text:{text:`<span foreground="${color}">${escape(value)}</span>`, font:`${font} ${size}`, fontfile, rgba:true, dpi:72}}).png().toBuffer();
    const dimensions = await sharp(input).metadata();
    if (left + dimensions.width > 940 || top + dimensions.height > 1660) throw new Error(`Text exceeds safe area: ${value}`);
    layers.push({input, left, top});
  }
  await text('RÈM VINA', 145, 215, 31, true);
  await text(section.eyebrow, 80, 1300, 22, false, gold);
  for (const [lineIndex, line] of section.lines.entries()) await text(line, 77, 1355 + lineIndex*84, 66, true);
  if (section.contact) await text(section.contact, 80, 1540, 31);
  await text('Video minh họa bằng AI', 80, 1610, 20, false, '#DDD9D2');
  await sharp({create:{width:1080, height:1920, channels:4, background:'#00000000'}}).composite(layers).png().toFile(path.join(pack, `images/title-${index+1}.png`));
}
console.log('Four Vietnamese title overlays created.');
