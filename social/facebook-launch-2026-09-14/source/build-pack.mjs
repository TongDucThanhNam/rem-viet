import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const pack = path.resolve(import.meta.dirname, '..');
const root = path.resolve(pack, '../..');
const source = path.join(pack, 'source');
const out = path.join(pack, 'images');
const fontDir = path.join(root, 'social/source/fonts');
const C = { navy: '#0D1B2A', gold: '#A77D44', cream: '#F7F3EC', soft: '#D8BE97', muted: '#52606B' };
const xml = s => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const svg = (w,h,body) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`);
const rect = (w,h,color) => svg(w,h,`<rect width="${w}" height="${h}" fill="${color}"/>`);
const layers = [];
function put(input,left,top){ layers.push({input,left:Math.round(left),top:Math.round(top)}); }
async function text(str,x,y,size=28,color=C.navy,serif=false,letter=0){
  const font = serif ? 'Playfair Display SemiBold' : 'Montserrat Medium';
  const fontfile = path.join(fontDir, serif ? 'PlayfairDisplay-SemiBold.ttf' : 'Montserrat-Medium.ttf');
  const input = await sharp({text:{text:`<span foreground="${color}" letter_spacing="${Math.round(letter*1024)}">${xml(str)}</span>`,font:`${font} ${size}`,fontfile,rgba:true,dpi:72}}).png().toBuffer();
  const meta = await sharp(input).metadata();
  put(input,x,y); return {width:meta.width,height:meta.height};
}
async function lines(list,x,y,size,color=C.navy,serif=true,gap=1.2){
  for(let i=0;i<list.length;i++) await text(list[i],x,y+i*size*gap,size,color,serif);
}
async function centered(str,y,size=28,color=C.navy,serif=false,w=1080,letter=0){
  const before=layers.length; const m=await text(str,0,y,size,color,serif,letter); layers[before].left=Math.round((w-m.width)/2);
}
async function photo(file,x,y,w,h,position='centre') { put(await sharp(path.join(source,file)).resize(w,h,{fit:'cover',position}).png().toBuffer(),x,y); }
function rule(x,y,w=968,color=C.soft){put(rect(w,1,color),x,y);}
let iconNavy,iconCream;
async function logoIcon(color) {
  const {data,info}=await sharp(path.join(root,'images/logo.png')).extract({left:244,top:178,width:146,height:182}).removeAlpha().raw().toBuffer({resolveWithObject:true});
  const rgba=Buffer.alloc(info.width*info.height*4); const rgb=color==C.navy?[13,27,42]:[247,243,236];
  for(let i=0;i<info.width*info.height;i++){
    const v=Math.min(data[i*info.channels],data[i*info.channels+1],data[i*info.channels+2]);
    const alpha=v>205?0:Math.min(255,Math.round((235-v)/212*255));
    rgba.set([...rgb,alpha],i*4);
  }
  return sharp(rgba,{raw:{width:info.width,height:info.height,channels:4}}).png().toBuffer();
}
async function logo(x=56,y=58,light=false,scale=1){
  const ink=light?C.cream:C.navy;
  put(await sharp(light?iconCream:iconNavy).resize(Math.round(53*scale),Math.round(66*scale)).toBuffer(),x,y);
  await text('RÈM VINA',x+72*scale,y+4*scale,33*scale,ink,true,2*scale);
  await text('RÈM CỬA · LƯỚI CHỐNG MUỖI',x+73*scale,y+51*scale,10*scale,ink,false,1*scale);
}
async function footer(no,light=false){
  rule(56,1254,968,light?'#41515F':C.soft);
  await text('shopee.vn/remvina.vn',56,1282,20,light?C.cream:C.muted);
  await text(`RÈM VINA / ${no}`,855,1285,13,light?C.soft:C.gold,false,1);
}
async function save(name,w=1080,h=1350,bg=C.cream){
  for(const layer of layers){
    const m=await sharp(layer.input).metadata();
    if(layer.left<0||layer.top<0||layer.left+m.width>w||layer.top+m.height>h)throw new Error(`Overflow ${name}: ${layer.left},${layer.top} ${m.width}x${m.height}`);
  }
  const buffer=await sharp({create:{width:w,height:h,channels:4,background:bg}}).composite(layers).png().toBuffer();
  await fs.writeFile(path.join(out,`${name}.png`),buffer);
  if(!name.includes('overlay'))await sharp(buffer).flatten({background:bg}).jpeg({quality:94,mozjpeg:true,chromaSubsampling:'4:4:4'}).toFile(path.join(out,`${name}.jpg`));
  layers.length=0;
}
async function imageLabel(y=797){
  put(svg(238,29,'<rect width="238" height="29" fill="#F7F3EC" fill-opacity="0.92"/>'),72,y);
  await text('Hình ảnh minh họa bằng AI',80,y+6,14,C.muted);
}
async function editorial(name,input,no,eyebrow,title,body){
  await logo(); await text('VỪA KHUNG CỬA. HỢP NẾP NHÀ.',650,83,12,C.gold,false,.9);
  await photo(input,56,170,968,660);
  await imageLabel(); await text(eyebrow,56,876,17,C.gold,false,2);
  await lines(title,52,922,76,C.navy,true,1.14);
  await lines(body,56,1128,23,C.muted,false,1.5);
  await footer(no); await save(name);
}
await fs.mkdir(out,{recursive:true});
iconNavy=await logoIcon(C.navy); iconCream=await logoIcon(C.cream);
await fs.writeFile(path.join(source,'logo-icon-navy.png'),iconNavy);
await fs.writeFile(path.join(source,'logo-icon-cream.png'),iconCream);

put(await sharp(iconCream).resize(395,493).toBuffer(),342,182);
await centered('RÈM VINA',746,77,C.cream,true,1080,4);
rule(445,858,190,C.soft);
await save('00-avatar-1080x1080',1080,1080,C.navy);

await photo('03-quiet-home.png',0,0,1640,624);
put(svg(1640,624,'<defs><linearGradient id="fade"><stop offset="0" stop-color="#F7F3EC"/><stop offset=".44" stop-color="#F7F3EC" stop-opacity=".96"/><stop offset=".72" stop-color="#F7F3EC" stop-opacity="0"/></linearGradient></defs><rect width="1640" height="624" fill="url(#fade)"/>'),0,0);
await logo(390,100,false,1.15);
await lines(['Vừa khung cửa.','Hợp nếp nhà.'],384,239,66,C.navy,true,1.1);
rule(390,410,88,C.gold);
await text('LƯỚI CHỐNG MUỖI MAY THEO SỐ ĐO',390,447,17,C.navy,false,.8);
await text('shopee.vn/remvina.vn',390,487,20,C.muted);
await save('00-facebook-cover-1640x624',1640,624);

await editorial('01-brand-introduction-1080x1350','03-quiet-home.png','01','LƯỚI CHỐNG MUỖI MAY THEO SỐ ĐO',['Vừa khung cửa.','Hợp nếp nhà.'],['Một góc cửa chỉn chu, bắt đầu từ số đo phù hợp.','Nhắn Rèm Vina để cùng chọn mẫu cho nhà bạn.']);
await editorial('02-custom-window-1080x1350','01-window-mesh.png','02','MỖI KHUNG CỬA, MỘT SỐ ĐO RIÊNG',['Cửa nhà bạn,','size của bạn.'],['Gửi ảnh khung cửa và số đo ngang × cao.','Shop cùng bạn kiểm tra mẫu và kích thước trước khi đặt.']);

await logo(); await text('HƯỚNG DẪN ĐẶT LẦN ĐẦU',56,211,18,C.gold,false,2);
await lines(['Bắt đầu từ','một tấm ảnh.'],52,268,83,C.navy,true,1.13);
put(svg(660,440,`<defs><pattern id="mesh" width="12" height="12" patternUnits="userSpaceOnUse"><path d="M0 0H12M0 0V12" fill="none" stroke="#0D1B2A" stroke-opacity=".2" stroke-width="1"/></pattern></defs><rect x="172" y="60" width="358" height="312" fill="#EAE4D8" stroke="#0D1B2A" stroke-width="8"/><rect x="192" y="80" width="318" height="272" fill="url(#mesh)" stroke="#0D1B2A" stroke-width="3"/><path d="M351 80V352" fill="none" stroke="#0D1B2A" stroke-width="5"/><path d="M332 200V234M370 200V234" stroke="#0D1B2A" stroke-width="5"/><path d="M172 21H530M172 12V30M530 12V30M132 60V372M123 60H141M123 372H141" stroke="#A77D44" stroke-width="2" fill="none"/>`),190,534);
await text('NGANG',483,506,18,C.gold,false,1.5); await text('CAO',249,741,18,C.gold,false,1);
await centered('Sơ đồ tham khảo · vị trí đo tùy kiểu lắp',940,18,C.muted);
const steps=['Chụp toàn bộ khung cửa.','Ghi số đo ngang × cao (cm).','Gửi ảnh để shop xác nhận vị trí đo.'];
for(let i=0;i<steps.length;i++){await text(`0${i+1}`,56,1011+i*58,23,C.gold); await text(steps[i],119,1010+i*58,24,C.navy);}
await text('Trao đổi với shop trước khi tự cộng hoặc trừ kích thước.',56,1197,18,C.muted);
await footer('03'); await save('03-sizing-guide-1080x1350');

await editorial('04-mesh-detail-1080x1350','02-mesh-detail.png','04','CHỌN LƯỚI, NHỚ XEM PHẦN VIỀN',['Nhìn kỹ hơn,','chọn hợp hơn.'],['Mắt lưới, viền và cách gắn đều cần được xem cùng nhau.','Gửi kiểu cửa để shop tư vấn mẫu phù hợp.']);

await logo(56,58,true); await text('CÂU HỎI THƯỜNG GẶP',56,214,18,C.soft,false,2);
await lines(['Cửa khác nhau.','Size cũng khác.'],52,291,83,C.cream,true,1.16);
await lines(['Đừng chọn chỉ vì thấy','một khung cửa tương tự.'],56,536,31,C.cream,false,1.5);
rule(56,665,94,C.soft);
await text('GỬI ẢNH ĐỂ SHOP KIỂM TRA CÙNG BẠN',56,705,18,C.soft,false,1);
await photo('01-window-mesh.png',56,793,968,405,'centre');
await imageLabel(1150); await footer('05',true); await save('05-size-faq-1080x1350',1080,1350,C.navy);

await editorial('06-photo-consultation-1080x1350','03-quiet-home.png','06','MỘT BƯỚC NHỎ, DỄ BẮT ĐẦU',['Chụp khung cửa.','Gửi Rèm Vina.'],['Bạn gửi ảnh, số đo và nhu cầu sử dụng.','Shop cùng bạn chọn mẫu trước khi đặt trên Shopee.']);

await logo(86,203,true,1.25);
put(await sharp(iconCream).resize(205,256).toBuffer(),437,573);
await centered('Vừa khung cửa.',901,74,C.cream,true);
await centered('Hợp nếp nhà.',999,74,C.cream,true);
put(svg(714,99,`<rect width="714" height="99" rx="3" fill="${C.soft}"/>`),183,1204);
await centered('Nhắn ảnh khung cửa',1233,32,C.navy);
await centered('shopee.vn/remvina.vn',1393,26,C.cream);
await save('reel-end-card-1080x1920',1080,1920,C.navy);

const reelTexts={
  '01-breeze':[['Một góc nhà,','nhẹ hơn.'],['Bắt đầu từ','khung cửa.'],['Gửi ảnh khung cửa.','Rèm Vina tư vấn.']],
  '02-mesh':[['Lưới vừa','khung cửa bạn.'],['Mỗi khung cửa,','một số đo riêng.'],['Gửi ảnh khung cửa.','Shop cùng chọn size.']]
};
for(const [reel,blocks] of Object.entries(reelTexts)){
  for(let i=0;i<blocks.length;i++){
    put(svg(1080,1920,'<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0D1B2A" stop-opacity=".33"/><stop offset=".35" stop-color="#0D1B2A" stop-opacity="0"/><stop offset=".55" stop-color="#0D1B2A" stop-opacity="0"/><stop offset="1" stop-color="#0D1B2A" stop-opacity=".3"/></linearGradient></defs><rect width="1080" height="1920" fill="url(#s)"/>'),0,0);
    put(svg(438,108,'<rect width="438" height="108" fill="#F7F3EC" fill-opacity=".96"/>'),70,202);
    await logo(89,219,false,1.12);
    put(svg(884,266,'<rect width="884" height="266" fill="#F7F3EC" fill-opacity=".96"/>'),70,1265);
    rule(112,1302,67,C.gold);
    await lines(blocks[i],111,1341,60,C.navy,true,1.18);
    put(svg(344,38,'<rect width="344" height="38" fill="#F7F3EC" fill-opacity=".92"/>'),70,1558);
    await text('Hình ảnh minh họa bằng AI',85,1569,17,C.muted);
    await save(`overlay-${reel}-${i+1}`,1080,1920,'#00000000');
  }
  await photo(reel==='01-breeze'?'03-quiet-home.png':'01-window-mesh.png',0,0,1080,1920,'attention');
  put(await fs.readFile(path.join(out,`overlay-${reel}-1.png`)),0,0);
  await save(`reel-cover-${reel}-1080x1920`,1080,1920);
}

const cards=['00-avatar-1080x1080','01-brand-introduction-1080x1350','02-custom-window-1080x1350','03-sizing-guide-1080x1350','04-mesh-detail-1080x1350','05-size-faq-1080x1350','06-photo-consultation-1080x1350','reel-cover-01-breeze-1080x1920','reel-cover-02-mesh-1080x1920'];
const thumbs=[];
for(let i=0;i<cards.length;i++){
  thumbs.push({input:await sharp(path.join(out,`${cards[i]}.jpg`)).resize(300,375,{fit:'contain',background:C.cream}).toBuffer(),left:30+(i%3)*320,top:30+Math.floor(i/3)*395});
}
await sharp({create:{width:1000,height:1215,channels:3,background:'#E5DED2'}}).composite(thumbs).jpeg({quality:91}).toFile(path.join(pack,'preview.jpg'));
console.log(`Built images and video title overlays in ${out}`);
