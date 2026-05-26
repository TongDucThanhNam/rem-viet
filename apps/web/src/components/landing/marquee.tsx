export function Marquee() {
  const marqueeText = "SỢI THỦY TINH CAO CẤP • MAY ĐO VỪA KHÍT • BẢO VỆ VÔ HÌNH • SẠCH BÓNG CÔN TRÙNG • ";

  return (
    <div className="marquee font-sans">
      <div className="marquee-inner">
        <span className="font-playfair italic">{marqueeText}</span>
        <span className="font-playfair italic">{marqueeText}</span>
        <span className="font-playfair italic">{marqueeText}</span>
      </div>
    </div>
  );
}
