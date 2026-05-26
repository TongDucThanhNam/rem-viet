export function BentoDetails() {
  return (
    <section className="bento-details font-sans" id="details">
      <div className="container">
        <h2 className="massive-text bento-title font-playfair font-medium">Kỹ Thuật Đỉnh Cao</h2>
        <div className="bento-grid font-vietnam">
          <div className="bento-box bento-large">
            <h3 className="text-xl md:text-2xl font-medium mb-4">Sợi Thủy Tinh Siêu Cấp</h3>
            <p className="text-[#555] leading-relaxed">
              Lưới được dệt từ sợi thủy tinh bọc nhựa PVC đặc chủng, cho độ bền
              uốn dẻo gập vặn lên tới hàng ngàn lần mà không bị đứt gãy.
            </p>
          </div>
          <div className="bento-box">
            <div className="stat-item">
              <span className="stat-num font-playfair">0%</span>
              <span className="stat-lbl mt-2 text-xs uppercase tracking-widest text-[#777]">Chất độc hại</span>
            </div>
          </div>
          <div className="bento-box">
            <div className="stat-item">
              <span className="stat-num font-playfair">∞</span>
              <span className="stat-lbl mt-2 text-xs uppercase tracking-widest text-[#777]">Lưu thông khí</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
