import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..", "..");
const social = path.join(root, "social");
const assets = path.join(root, "apps", "web", "public", "assets");
const fonts = path.join(social, "source", "fonts");

const NAVY = "#0D1B2A";
const GOLD = "#C9A46B";
const CREAM = "#F7F3EC";
const WHITE = "#FFFFFF";

const fontCss = `
  .serif { font-family: 'Times New Roman', serif; font-weight: 700; }
  .sans { font-family: Arial, sans-serif; font-weight: 500; }
`;

const escapeXml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

function iconMarkup({ x = 0, y = 0, size = 80, color = NAVY, accent = GOLD } = {}) {
  const scale = size / 100;
  return `<g transform="translate(${x} ${y}) scale(${scale})" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <path d="M25 78V31L50 7L75 31V79" stroke="${color}" stroke-width="4"/>
    <path d="M75 31C60 34 57 45 53 56C49 68 40 76 29 78" stroke="${color}" stroke-width="4"/>
    <path d="M55 55V80" stroke="${color}" stroke-width="3"/>
    <path d="M27 76C15 75 10 68 10 58C21 58 28 63 30 72" stroke="${accent}" stroke-width="3"/>
    <path d="M29 76C35 66 42 64 48 66C46 75 39 80 29 80" stroke="${accent}" stroke-width="3"/>
  </g>`;
}

function logoMarkup({ x, y, scale = 1, light = false, compact = false }) {
  const primary = light ? WHITE : NAVY;
  const iconSize = 76 * scale;
  const wordX = x + iconSize + 22 * scale;
  const wordY = y + 43 * scale;
  return `<g>
    ${iconMarkup({ x, y, size: iconSize, color: primary, accent: GOLD })}
    <text class="serif" x="${wordX}" y="${wordY}" fill="${primary}" font-size="${34 * scale}" letter-spacing="${5 * scale}">RÈM VINA</text>
    ${compact ? "" : `<text class="sans" x="${wordX}" y="${wordY + 25 * scale}" fill="${light ? "#E8DED0" : "#43505C"}" font-size="${10 * scale}" letter-spacing="${2.7 * scale}">RÈM CỬA · LƯỚI CHỐNG MUỖI</text>`}
  </g>`;
}

function svg(width, height, body) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
      <style>${fontCss}</style>
      <linearGradient id="shade-left" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${NAVY}" stop-opacity="0.94"/><stop offset="0.58" stop-color="${NAVY}" stop-opacity="0.58"/><stop offset="1" stop-color="${NAVY}" stop-opacity="0"/></linearGradient>
      <linearGradient id="shade-bottom" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${NAVY}" stop-opacity="0"/><stop offset="0.58" stop-color="${NAVY}" stop-opacity="0.22"/><stop offset="1" stop-color="${NAVY}" stop-opacity="0.92"/></linearGradient>
      <radialGradient id="glow" cx="82%" cy="12%" r="74%"><stop offset="0" stop-color="${GOLD}" stop-opacity="0.26"/><stop offset="1" stop-color="${GOLD}" stop-opacity="0"/></radialGradient>
    </defs>
    ${body}
  </svg>`);
}

async function cover(input, width, height, position = "centre") {
  return sharp(input).resize(width, height, { fit: "cover", position }).toBuffer();
}

async function preferGenerated(filename, fallback) {
  const generated = path.join(social, "cici", "raw", filename);
  try {
    await fs.access(generated);
    return generated;
  } catch {
    return fallback;
  }
}

async function saveLayered({ input, width, height, overlay, output, position = "centre" }) {
  const background = await cover(input, width, height, position);
  await sharp(background)
    .composite([{ input: svg(width, height, overlay), top: 0, left: 0 }])
    .png({ compressionLevel: 9, palette: false })
    .toFile(output);
}

async function makeShopeeHero() {
  const width = 2000;
  const height = 2000;
  const input = await preferGenerated(
    "cici-square-01.png",
    path.join(assets, "window-mosquito-net-hero.png"),
  );
  const output = path.join(social, "final", "shopee", "01-hero-2000x2000.png");
  const overlay = `
    <rect width="2000" height="2000" fill="url(#shade-left)"/>
    <rect width="2000" height="2000" fill="url(#shade-bottom)" opacity="0.5"/>
    ${logoMarkup({ x: 130, y: 110, scale: 1.25, light: true })}
    <rect x="132" y="532" width="96" height="7" rx="3" fill="${GOLD}"/>
    <text class="sans" x="132" y="495" fill="${GOLD}" font-size="31" letter-spacing="7">GIẢI PHÁP MAY ĐO</text>
    <text class="serif" x="125" y="665" fill="${WHITE}" font-size="132" letter-spacing="2">Lưới chống muỗi</text>
    <text class="serif" x="125" y="805" fill="${WHITE}" font-size="132" letter-spacing="2">vừa khít từng khung.</text>
    <text class="sans" x="132" y="910" fill="#F1ECE4" font-size="35" letter-spacing="1.6">GIỮ GIÓ · GIỮ SÁNG · GIỮ NHÀ AN TÂM</text>
    <g transform="translate(132 1575)">
      <rect width="472" height="126" rx="63" fill="${CREAM}"/>
      <text class="sans" x="236" y="77" text-anchor="middle" fill="${NAVY}" font-size="29" letter-spacing="2">MAY ĐO VỪA KHÍT</text>
      <rect x="495" width="420" height="126" rx="63" fill="${GOLD}"/>
      <text class="sans" x="705" y="77" text-anchor="middle" fill="${NAVY}" font-size="29" letter-spacing="2">DỄ THÁO VỆ SINH</text>
    </g>
    <text class="sans" x="132" y="1855" fill="${WHITE}" font-size="26" letter-spacing="3.5">TƯ VẤN THEO KÍCH THƯỚC THỰC TẾ</text>
  `;
  await saveLayered({ input, width, height, overlay, output, position: "centre" });
}

async function makeShopeeBenefits() {
  const width = 2000;
  const height = 2000;
  const base = sharp({ create: { width, height, channels: 4, background: CREAM } });
  const mesh = await cover(path.join(assets, "fiberglass-mesh.png"), 920, 740, "centre");
  const craft = await cover(path.join(assets, "craft_mesh.png"), 920, 740, "centre");
  const overlay = svg(width, height, `
    <rect width="2000" height="2000" fill="${CREAM}"/>
    <rect x="0" y="0" width="2000" height="430" fill="${NAVY}"/>
    ${logoMarkup({ x: 110, y: 86, scale: 1.0, light: true })}
    <text class="sans" x="110" y="294" fill="${GOLD}" font-size="27" letter-spacing="7">CHI TIẾT LÀM NÊN KHÁC BIỆT</text>
    <text class="serif" x="110" y="385" fill="${WHITE}" font-size="82">Mỏng nhẹ. Bền chắc. Gần như vô hình.</text>
    <rect x="80" y="460" width="920" height="740" fill="none" stroke="${GOLD}" stroke-width="4"/>
    <rect x="1000" y="460" width="920" height="740" fill="none" stroke="${GOLD}" stroke-width="4"/>
    <rect x="80" y="1198" width="920" height="80" fill="${NAVY}" fill-opacity="0.93"/>
    <rect x="1000" y="1198" width="920" height="80" fill="${NAVY}" fill-opacity="0.93"/>
    <text class="sans" x="122" y="1251" fill="${WHITE}" font-size="27" letter-spacing="3">SỢI THỦY TINH BỌC PVC</text>
    <text class="sans" x="1042" y="1251" fill="${WHITE}" font-size="27" letter-spacing="3">CẮT MAY THEO SỐ ĐO THẬT</text>
    <g transform="translate(110 1400)">
      <circle cx="50" cy="50" r="50" fill="${GOLD}"/><text class="serif" x="50" y="69" text-anchor="middle" fill="${NAVY}" font-size="48">01</text>
      <text class="serif" x="130" y="44" fill="${NAVY}" font-size="50">Ôm sát mép khung</text><text class="sans" x="130" y="92" fill="#4A5660" font-size="26">Hạn chế khe hở, bề mặt phẳng gọn.</text>
      <circle cx="50" cy="235" r="50" fill="${GOLD}"/><text class="serif" x="50" y="254" text-anchor="middle" fill="${NAVY}" font-size="48">02</text>
      <text class="serif" x="130" y="229" fill="${NAVY}" font-size="50">Giữ gió và ánh sáng</text><text class="sans" x="130" y="277" fill="#4A5660" font-size="26">Mắt lưới mảnh, không làm nặng không gian.</text>
      <circle cx="940" cy="50" r="50" fill="${GOLD}"/><text class="serif" x="940" y="69" text-anchor="middle" fill="${NAVY}" font-size="48">03</text>
      <text class="serif" x="1020" y="44" fill="${NAVY}" font-size="50">Dễ tháo vệ sinh</text><text class="sans" x="1020" y="92" fill="#4A5660" font-size="26">Gọn nhẹ cho việc chăm sóc định kỳ.</text>
      <circle cx="940" cy="235" r="50" fill="${GOLD}"/><text class="serif" x="940" y="254" text-anchor="middle" fill="${NAVY}" font-size="48">04</text>
      <text class="serif" x="1020" y="229" fill="${NAVY}" font-size="50">Tư vấn tận nơi</text><text class="sans" x="1020" y="277" fill="#4A5660" font-size="26">Đo, may và hoàn thiện theo lịch hẹn.</text>
    </g>
  `);
  await base
    .composite([
      { input: overlay, top: 0, left: 0 },
      { input: mesh, top: 460, left: 80 },
      { input: craft, top: 460, left: 1000 },
      { input: svg(width, height, `<rect x="80" y="1198" width="920" height="80" fill="${NAVY}" fill-opacity="0.93"/><rect x="1000" y="1198" width="920" height="80" fill="${NAVY}" fill-opacity="0.93"/><text class="sans" x="122" y="1251" fill="${WHITE}" font-size="27" letter-spacing="3">SỢI THỦY TINH BỌC PVC</text><text class="sans" x="1042" y="1251" fill="${WHITE}" font-size="27" letter-spacing="3">CẮT MAY THEO SỐ ĐO THẬT</text>`), top: 0, left: 0 },
    ])
    .png({ compressionLevel: 9 })
    .toFile(path.join(social, "final", "shopee", "02-benefits-2000x2000.png"));
}

async function makeShopeeMeasure() {
  const width = 2000;
  const height = 2000;
  const input = path.join(assets, "window-mosquito-net-hero.png");
  const photo = await cover(input, 880, 1060, "centre");
  const base = sharp({ create: { width, height, channels: 4, background: CREAM } });
  const overlay = svg(width, height, `
    <rect width="2000" height="2000" fill="${CREAM}"/>
    ${logoMarkup({ x: 110, y: 90, scale: 0.98, light: false })}
    <text class="sans" x="110" y="330" fill="${GOLD}" font-size="27" letter-spacing="7">3 BƯỚC GỬI SỐ ĐO</text>
    <text class="serif" x="110" y="445" fill="${NAVY}" font-size="90">Đo đúng ngay từ lần đầu.</text>
    <rect x="110" y="540" width="880" height="1060" fill="${NAVY}"/>
    <rect x="1050" y="540" width="840" height="1060" fill="${WHITE}" stroke="#E2D7C8" stroke-width="3"/>
    <g transform="translate(1130 650)">
      <circle cx="62" cy="62" r="62" fill="${NAVY}"/><text class="serif" x="62" y="83" text-anchor="middle" fill="${GOLD}" font-size="54">01</text>
      <text class="serif" x="160" y="54" fill="${NAVY}" font-size="53">Đo chiều rộng</text>
      <text class="sans" x="160" y="103" fill="#4A5660" font-size="25">Từ mép ngoài trái sang mép ngoài phải.</text>
      <path d="M0 190H660" stroke="#E2D7C8" stroke-width="3"/>
      <circle cx="62" cy="300" r="62" fill="${NAVY}"/><text class="serif" x="62" y="321" text-anchor="middle" fill="${GOLD}" font-size="54">02</text>
      <text class="serif" x="160" y="292" fill="${NAVY}" font-size="53">Đo chiều cao</text>
      <text class="sans" x="160" y="341" fill="#4A5660" font-size="25">Từ mép ngoài trên xuống mép ngoài dưới.</text>
      <path d="M0 430H660" stroke="#E2D7C8" stroke-width="3"/>
      <circle cx="62" cy="540" r="62" fill="${NAVY}"/><text class="serif" x="62" y="561" text-anchor="middle" fill="${GOLD}" font-size="54">03</text>
      <text class="serif" x="160" y="532" fill="${NAVY}" font-size="53">Chụp toàn khung</text>
      <text class="sans" x="160" y="581" fill="#4A5660" font-size="25">Gửi ảnh tổng thể và ảnh cận phần mép.</text>
      <rect x="0" y="690" width="660" height="170" rx="24" fill="${NAVY}"/>
      <text class="sans" x="330" y="760" text-anchor="middle" fill="${GOLD}" font-size="25" letter-spacing="4">LƯU Ý</text>
      <text class="serif" x="330" y="820" text-anchor="middle" fill="${WHITE}" font-size="37">Ghi số đo theo milimét (mm)</text>
    </g>
    <text class="sans" x="110" y="1760" fill="${GOLD}" font-size="27" letter-spacing="6">CHƯA CHẮC CÁCH ĐO?</text>
    <text class="serif" x="110" y="1840" fill="${NAVY}" font-size="62">Gửi ảnh khung cửa để Rèm Vina tư vấn.</text>
  `);
  await base
    .composite([
      { input: overlay, top: 0, left: 0 },
      { input: photo, top: 540, left: 110 },
      { input: svg(width, height, `<rect x="110" y="540" width="880" height="1060" fill="none" stroke="${GOLD}" stroke-width="5"/><path d="M215 676H885M215 1464H885" stroke="${GOLD}" stroke-width="7"/><path d="M215 676l55-32v64zM885 676l-55-32v64zM215 1464l55-32v64zM885 1464l-55-32v64z" fill="${GOLD}"/><text class="sans" x="550" y="646" text-anchor="middle" fill="${NAVY}" font-size="25" letter-spacing="4">RỘNG (R)</text>`), top: 0, left: 0 },
    ])
    .png({ compressionLevel: 9 })
    .toFile(path.join(social, "final", "shopee", "03-measure-2000x2000.png"));
}

async function makeShopeeProcess() {
  const width = 2000;
  const height = 2000;
  const sources = ["process-measure.webp", "process-craft.webp", "process-install.webp"];
  const photos = await Promise.all(
    sources.map((name) => cover(path.join(assets, name), 570, 930, "centre")),
  );
  const positions = [90, 715, 1340];
  const base = sharp({ create: { width, height, channels: 4, background: CREAM } });
  const overlay = svg(width, height, `
    <rect width="2000" height="2000" fill="${CREAM}"/>
    <rect width="2000" height="430" fill="${NAVY}"/>
    ${logoMarkup({ x: 100, y: 70, scale: 0.95, light: true })}
    <text class="sans" x="100" y="286" fill="${GOLD}" font-size="27" letter-spacing="7">QUY TRÌNH MAY ĐO</text>
    <text class="serif" x="100" y="380" fill="${WHITE}" font-size="82">Từ khung cửa thật đến lớp bảo vệ vừa khít.</text>
    ${positions.map((x, i) => `<rect x="${x}" y="500" width="570" height="930" fill="none" stroke="${GOLD}" stroke-width="4"/>`).join("")}
    <g transform="translate(90 1430)"><rect width="570" height="220" fill="${NAVY}"/><text class="serif" x="45" y="83" fill="${GOLD}" font-size="52">01 · Đo khung</text><text class="sans" x="45" y="139" fill="${WHITE}" font-size="25">Ghi nhận rộng, cao và các gờ nổi.</text></g>
    <g transform="translate(715 1430)"><rect width="570" height="220" fill="${NAVY}"/><text class="serif" x="45" y="83" fill="${GOLD}" font-size="52">02 · Cắt may</text><text class="sans" x="45" y="139" fill="${WHITE}" font-size="25">Hoàn thiện viền theo số đo thực tế.</text></g>
    <g transform="translate(1340 1430)"><rect width="570" height="220" fill="${NAVY}"/><text class="serif" x="45" y="83" fill="${GOLD}" font-size="52">03 · Lắp gọn</text><text class="sans" x="45" y="139" fill="${WHITE}" font-size="25">Kiểm tra độ kín và hướng dẫn vệ sinh.</text></g>
    <text class="sans" x="1000" y="1810" text-anchor="middle" fill="${GOLD}" font-size="28" letter-spacing="6">ĐÚNG SỐ ĐO · ĐÚNG CẤU HÌNH · GỌN KHI SỬ DỤNG</text>
    <text class="serif" x="1000" y="1900" text-anchor="middle" fill="${NAVY}" font-size="58">Gửi ảnh khung cửa để bắt đầu.</text>
  `);
  await base
    .composite([
      { input: overlay, top: 0, left: 0 },
      ...photos.map((input, index) => ({ input, top: 500, left: positions[index] })),
      { input: svg(width, height, `<g transform="translate(90 1430)"><rect width="570" height="220" fill="${NAVY}"/><text class="serif" x="45" y="83" fill="${GOLD}" font-size="52">01 · Đo khung</text><text class="sans" x="45" y="139" fill="${WHITE}" font-size="25">Ghi nhận rộng, cao và các gờ nổi.</text></g><g transform="translate(715 1430)"><rect width="570" height="220" fill="${NAVY}"/><text class="serif" x="45" y="83" fill="${GOLD}" font-size="52">02 · Cắt may</text><text class="sans" x="45" y="139" fill="${WHITE}" font-size="25">Hoàn thiện viền theo số đo thực tế.</text></g><g transform="translate(1340 1430)"><rect width="570" height="220" fill="${NAVY}"/><text class="serif" x="45" y="83" fill="${GOLD}" font-size="52">03 · Lắp gọn</text><text class="sans" x="45" y="139" fill="${WHITE}" font-size="25">Kiểm tra độ kín và hướng dẫn vệ sinh.</text></g>`), top: 0, left: 0 },
    ])
    .png({ compressionLevel: 9 })
    .toFile(path.join(social, "final", "shopee", "04-process-2000x2000.png"));
}

async function makeShopeeSpaces() {
  const width = 2000;
  const height = 2000;
  const sources = ["gallery_1.png", "gallery_2.png", "gallery_3.png"];
  const photos = await Promise.all(
    sources.map((name) => cover(path.join(assets, name), 590, 1030, "centre")),
  );
  const positions = [75, 705, 1335];
  const base = sharp({ create: { width, height, channels: 4, background: NAVY } });
  const overlay = svg(width, height, `
    <rect width="2000" height="2000" fill="${NAVY}"/>
    ${logoMarkup({ x: 95, y: 72, scale: 0.95, light: true })}
    <text class="sans" x="95" y="282" fill="${GOLD}" font-size="27" letter-spacing="7">PHÙ HỢP NHIỀU KHÔNG GIAN</text>
    <text class="serif" x="95" y="380" fill="${WHITE}" font-size="83">Một giải pháp gọn cho từng ô cửa mở.</text>
    <g transform="translate(75 1480)"><text class="serif" x="0" y="55" fill="${GOLD}" font-size="48">Cửa đi ban công</text><text class="sans" x="0" y="105" fill="#E9E1D5" font-size="24">Giữ lối mở thoáng và sáng.</text></g>
    <g transform="translate(705 1480)"><text class="serif" x="0" y="55" fill="${GOLD}" font-size="48">Cửa trượt lớn</text><text class="sans" x="0" y="105" fill="#E9E1D5" font-size="24">Tư vấn theo ray và tay nắm.</text></g>
    <g transform="translate(1335 1480)"><text class="serif" x="0" y="55" fill="${GOLD}" font-size="48">Cửa sổ phòng</text><text class="sans" x="0" y="105" fill="#E9E1D5" font-size="24">Nhẹ tầm nhìn, gọn mép khung.</text></g>
    <rect x="75" y="1740" width="1850" height="150" rx="75" fill="${GOLD}"/>
    <text class="sans" x="1000" y="1832" text-anchor="middle" fill="${NAVY}" font-size="29" letter-spacing="4">GỬI ẢNH CỬA · NHẬN TƯ VẤN CẤU HÌNH PHÙ HỢP</text>
  `);
  await base
    .composite([
      { input: overlay, top: 0, left: 0 },
      ...photos.map((input, index) => ({ input, top: 440, left: positions[index] })),
      { input: svg(width, height, `<path d="M75 440V1470M665 440V1470M705 440V1470M1295 440V1470M1335 440V1470M1925 440V1470" stroke="${GOLD}" stroke-width="4"/>`), top: 0, left: 0 },
    ])
    .png({ compressionLevel: 9 })
    .toFile(path.join(social, "final", "shopee", "05-spaces-2000x2000.png"));
}

async function makeFacebookFeed() {
  const width = 1080;
  const height = 1350;
  const input = await preferGenerated(
    "cici-vertical-01.png",
    path.join(assets, "gallery_3.png"),
  );
  const overlay = `
    <rect width="1080" height="1350" fill="url(#shade-bottom)"/>
    <rect x="0" y="0" width="1080" height="300" fill="url(#shade-left)" opacity="0.72"/>
    ${logoMarkup({ x: 62, y: 56, scale: 0.72, light: true })}
    <text class="sans" x="66" y="824" fill="${GOLD}" font-size="19" letter-spacing="5">SỐNG THOÁNG MỖI NGÀY</text>
    <text class="serif" x="62" y="930" fill="${WHITE}" font-size="77">Nhà thoáng.</text>
    <text class="serif" x="62" y="1012" fill="${WHITE}" font-size="77">Muỗi dừng ngoài cửa.</text>
    <text class="sans" x="66" y="1080" fill="#F0EBE3" font-size="23" letter-spacing="1">LƯỚI CHỐNG MUỖI MAY ĐO · GIỮ TRỌN ÁNH SÁNG</text>
    <rect x="64" y="1150" width="530" height="84" rx="42" fill="${GOLD}"/>
    <text class="sans" x="329" y="1203" text-anchor="middle" fill="${NAVY}" font-size="22" letter-spacing="2.6">NHẮN TIN ĐỂ ĐƯỢC TƯ VẤN</text>
  `;
  await saveLayered({ input, width, height, overlay, output: path.join(social, "final", "facebook", "feed-1080x1350.png"), position: "centre" });
}

async function makeFacebookBanner() {
  const width = 1200;
  const height = 628;
  const input = await preferGenerated(
    "cici-square-01.png",
    path.join(assets, "lifestyle_breeze.png"),
  );
  const overlay = `
    <rect width="1200" height="628" fill="url(#shade-left)"/>
    ${logoMarkup({ x: 54, y: 44, scale: 0.60, light: true })}
    <text class="sans" x="58" y="270" fill="${GOLD}" font-size="17" letter-spacing="5">LƯỚI MAY ĐO CHO KHUNG CỬA VIỆT</text>
    <text class="serif" x="54" y="350" fill="${WHITE}" font-size="60">Mở cửa đón gió.</text>
    <text class="serif" x="54" y="415" fill="${WHITE}" font-size="60">Không đón muỗi.</text>
    <rect x="56" y="474" width="370" height="67" rx="34" fill="${GOLD}"/>
    <text class="sans" x="241" y="516" text-anchor="middle" fill="${NAVY}" font-size="18" letter-spacing="2.6">TƯ VẤN THEO SỐ ĐO THẬT</text>
  `;
  await saveLayered({ input, width, height, overlay, output: path.join(social, "final", "facebook", "banner-1200x628.png"), position: "centre" });
}

async function makeVerticals() {
  const width = 1080;
  const height = 1920;
  const input = await preferGenerated(
    "cici-vertical-01.png",
    path.join(assets, "lifestyle_breeze.png"),
  );
  const tiktokOverlay = `
    <rect width="1080" height="1920" fill="url(#shade-bottom)"/>
    <rect width="1080" height="380" fill="url(#shade-left)" opacity="0.75"/>
    ${logoMarkup({ x: 62, y: 74, scale: 0.76, light: true })}
    <rect x="64" y="1258" width="90" height="6" fill="${GOLD}"/>
    <text class="sans" x="64" y="1228" fill="${GOLD}" font-size="21" letter-spacing="6">KHÔNG GIAN SỐNG AN TÂM</text>
    <text class="serif" x="60" y="1368" fill="${WHITE}" font-size="86">Mở cửa đón gió.</text>
    <text class="serif" x="60" y="1464" fill="${WHITE}" font-size="86">Không đón muỗi.</text>
    <rect x="62" y="1544" width="780" height="88" rx="44" fill="${NAVY}" fill-opacity="0.88" stroke="${GOLD}" stroke-width="2"/>
    <text class="sans" x="452" y="1598" text-anchor="middle" fill="${WHITE}" font-size="21" letter-spacing="3">LƯỚI MAY ĐO · GẦN NHƯ VÔ HÌNH</text>
  `;
  await saveLayered({ input, width, height, overlay: tiktokOverlay, output: path.join(social, "final", "tiktok", "cover-1080x1920.png"), position: "centre" });

  const storyOverlay = `
    <rect width="1080" height="1920" fill="url(#shade-bottom)"/>
    <rect width="1080" height="430" fill="url(#shade-left)" opacity="0.72"/>
    ${logoMarkup({ x: 62, y: 82, scale: 0.76, light: true })}
    <text class="sans" x="62" y="1330" fill="${GOLD}" font-size="21" letter-spacing="6">ĐO · MAY · LẮP TẬN NƠI</text>
    <text class="serif" x="58" y="1435" fill="${WHITE}" font-size="78">Một lớp chắn mảnh.</text>
    <text class="serif" x="58" y="1525" fill="${WHITE}" font-size="78">Một khoảng thở rộng.</text>
    <rect x="60" y="1620" width="700" height="96" rx="48" fill="${GOLD}"/>
    <text class="sans" x="410" y="1679" text-anchor="middle" fill="${NAVY}" font-size="23" letter-spacing="2.8">GỬI ẢNH KHUNG CỬA ĐỂ TƯ VẤN</text>
  `;
  await saveLayered({ input, width, height, overlay: storyOverlay, output: path.join(social, "final", "facebook", "story-1080x1920.png"), position: "centre" });
}

async function makeAvatar() {
  const width = 1080;
  const height = 1080;
  const body = `
    <rect width="1080" height="1080" fill="${NAVY}"/>
    <circle cx="540" cy="540" r="430" fill="none" stroke="${GOLD}" stroke-width="5" opacity="0.72"/>
    <circle cx="540" cy="540" r="380" fill="url(#glow)"/>
    ${iconMarkup({ x: 360, y: 240, size: 360, color: WHITE, accent: GOLD })}
    <text class="serif" x="540" y="735" text-anchor="middle" fill="${WHITE}" font-size="92" letter-spacing="14">RÈM VINA</text>
    <text class="sans" x="540" y="798" text-anchor="middle" fill="${GOLD}" font-size="25" letter-spacing="7">RÈM CỬA · LƯỚI CHỐNG MUỖI</text>
  `;
  await sharp(svg(width, height, body)).png({ compressionLevel: 9 }).toFile(path.join(social, "final", "profile-avatar-1080x1080.png"));
}

await Promise.all([
  makeShopeeHero(),
  makeShopeeBenefits(),
  makeShopeeMeasure(),
  makeShopeeProcess(),
  makeShopeeSpaces(),
  makeFacebookFeed(),
  makeFacebookBanner(),
  makeVerticals(),
  makeAvatar(),
]);

const pngExports = [
  path.join(social, "final", "shopee", "01-hero-2000x2000.png"),
  path.join(social, "final", "shopee", "02-benefits-2000x2000.png"),
  path.join(social, "final", "shopee", "03-measure-2000x2000.png"),
  path.join(social, "final", "shopee", "04-process-2000x2000.png"),
  path.join(social, "final", "shopee", "05-spaces-2000x2000.png"),
  path.join(social, "final", "facebook", "feed-1080x1350.png"),
  path.join(social, "final", "facebook", "banner-1200x628.png"),
  path.join(social, "final", "facebook", "story-1080x1920.png"),
  path.join(social, "final", "tiktok", "cover-1080x1920.png"),
];

await Promise.all(
  pngExports.map((input) =>
    sharp(input)
      .jpeg({ quality: 90, chromaSubsampling: "4:4:4", mozjpeg: true })
      .toFile(input.replace(/\.png$/i, ".jpg")),
  ),
);

console.log("Built Rèm Vina social assets in social/final");
