import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
const pack=path.resolve(import.meta.dirname,'..');
for(const [kind,key] of [['breeze','01-breeze'],['mesh','02-mesh']]){
 const frame=path.join(pack,'source',`review-${kind}-0.2.png`);
 const target=path.join(pack,'images',`reel-cover-${key}-1080x1920`);
 await fs.copyFile(frame,target+'.png');
 await sharp(frame).jpeg({quality:94,mozjpeg:true,chromaSubsampling:'4:4:4'}).toFile(target+'.jpg');
}
const frames=[];
for(const [row,kind] of ['breeze','mesh'].entries())for(const [col,t] of [.2,3.5,6.5,9.3].entries())frames.push({input:await sharp(path.join(pack,'source',`review-${kind}-${t}.png`)).resize(270,480).toBuffer(),left:col*280+10,top:row*490+10});
await sharp({create:{width:1130,height:990,channels:3,background:'#e5ded2'}}).composite(frames).jpeg({quality:92}).toFile(path.join(pack,'source','review-videos.jpg'));
const cards=['00-avatar-1080x1080','01-brand-introduction-1080x1350','02-custom-window-1080x1350','03-sizing-guide-1080x1350','04-mesh-detail-1080x1350','05-size-faq-1080x1350','06-photo-consultation-1080x1350','reel-cover-01-breeze-1080x1920','reel-cover-02-mesh-1080x1920'];
const thumbs=[];
for(let i=0;i<cards.length;i++)thumbs.push({input:await sharp(path.join(pack,'images',`${cards[i]}.jpg`)).resize(300,375,{fit:'contain',background:'#f7f3ec'}).toBuffer(),left:30+(i%3)*320,top:30+Math.floor(i/3)*395});
await sharp({create:{width:1000,height:1215,channels:3,background:'#e5ded2'}}).composite(thumbs).jpeg({quality:91}).toFile(path.join(pack,'preview.jpg'));
console.log('Updated Reel covers from the finished footage and built review contact sheets.');
