export function CurtainFooter() {
  return (
    <footer className="footer curtain-footer font-sans" id="order">
      <div className="footer-cta font-vietnam text-center">
        <h2 className="font-playfair text-[#fff]">
          Bắt đầu
          <br />
          dự án của bạn.
        </h2>
        <a href="mailto:tuvan@luxemesh.vn" className="massive-link hover-target font-playfair" data-cursor="Đặt may">
          tuvan@luxemesh.vn
        </a>
      </div>
      <div className="footer-bottom font-vietnam text-[#fff] opacity-80">
        <p>&copy; 2026 LUXE MESH. Bản quyền đã được bảo hộ.</p>
        <div className="footer-socials">
          <a href="#" className="hover-target">
            Instagram
          </a>
          <a href="#" className="hover-target">
            Facebook
          </a>
        </div>
      </div>
    </footer>
  );
}
