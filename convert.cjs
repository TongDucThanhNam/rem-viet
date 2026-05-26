const fs = require('fs');

let html = fs.readFileSync('draft/index.html', 'utf-8');
const bodyMatch = html.match(/<body>([\s\S]*?)<script src=".\/script.js"><\/script>\s*<\/body>/);
if (!bodyMatch) {
  console.log("No body match");
  process.exit(1);
}

let content = bodyMatch[1];
// Remove cursor and loading screen as they are separate components
content = content.replace(/<!-- Custom Cursor -->[\s\S]*?<!-- Loading Screen -->/g, '<!-- Loading Screen -->');
content = content.replace(/<!-- Loading Screen -->[\s\S]*?<!-- Header -->/g, '<!-- Header -->');

// Convert HTML to JSX
content = content.replace(/class="/g, 'className="');
content = content.replace(/stroke-width="/g, 'strokeWidth="');
content = content.replace(/stroke-linecap="/g, 'strokeLinecap="');
content = content.replace(/stroke-linejoin="/g, 'strokeLinejoin="');
content = content.replace(/stroke-dasharray="/g, 'strokeDasharray="');
content = content.replace(/<!-- (.*?) -->/g, '{/* $1 */}');
content = content.replace(/<br>/g, '<br />');

// Convert input tags if any
content = content.replace(/<input(.*?)>/g, (match) => {
  if (match.endsWith('/>')) return match;
  return match.replace(/>$/, ' />');
});

// Self close images
content = content.replace(/<img(.*?)>/g, (match) => {
  if (match.endsWith('/>')) return match;
  return match.replace(/>$/, ' />');
});

const tsx = `import { useScrollAnimation } from "../hooks/use-scroll-animation";
import { useEffect, useState } from "react";

export function LandingRaw() {
  useScrollAnimation();
  
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [headerScrolled, setHeaderScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setHeaderScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const faqs = document.querySelectorAll(".faq-question");
    const toggleFaq = (e) => {
      const question = e.currentTarget;
      const item = question.parentElement;
      const isActive = item.classList.contains("active");

      document.querySelectorAll(".faq-item").forEach((el) => {
        el.classList.remove("active");
        el.querySelector(".faq-question").setAttribute("aria-expanded", "false");
      });

      if (!isActive) {
        item.classList.add("active");
        question.setAttribute("aria-expanded", "true");
      }
    };
    
    faqs.forEach(q => q.addEventListener("click", toggleFaq));
    return () => faqs.forEach(q => q.removeEventListener("click", toggleFaq));
  }, []);

  return (
    <>
      {/* Header */}
      <header className={\`site-header \${headerScrolled ? "scrolled" : ""}\`} id="site-header">
        <div className="container header-inner">
          <a href="#" className="logo" data-scroll>
            <span className="logo-icon">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <rect x="2" y="2" width="24" height="24" rx="4" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M2 8h24M2 14h24M2 20h24M8 2v24M14 2v24M20 2v24" stroke="currentColor" strokeWidth="0.75" opacity="0.5"/>
              </svg>
            </span>
            <span className="logo-text">RÈM VINA</span>
          </a>
          <nav className="main-nav" id="main-nav">
            <a href="#product" data-scroll className="nav-link">Sản phẩm</a>
            <a href="#measure" data-scroll className="nav-link">Kích thước</a>
            <a href="#material" data-scroll className="nav-link">Chất liệu</a>
            <a href="#spaces" data-scroll className="nav-link">Không gian</a>
            <a href="#order" data-scroll className="nav-link">Đặt hàng</a>
          </nav>
          <a href="#order" className="btn-header" data-scroll>
            <span>Tư vấn ngay</span>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </a>
          <button 
            className={\`menu-toggle \${mobileMenuOpen ? "active" : ""}\`} 
            id="menu-toggle" 
            aria-label="Menu"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <span></span>
            <span></span>
            <span></span>
          </button>
        </div>
      </header>

      {/* Mobile Menu */}
      <div className={\`mobile-menu \${mobileMenuOpen ? "active" : ""}\`} id="mobile-menu">
        <nav className="mobile-nav">
          <a href="#product" data-scroll className="mobile-nav-link" onClick={() => setMobileMenuOpen(false)}>Sản phẩm</a>
          <a href="#measure" data-scroll className="mobile-nav-link" onClick={() => setMobileMenuOpen(false)}>Kích thước</a>
          <a href="#material" data-scroll className="mobile-nav-link" onClick={() => setMobileMenuOpen(false)}>Chất liệu</a>
          <a href="#spaces" data-scroll className="mobile-nav-link" onClick={() => setMobileMenuOpen(false)}>Không gian</a>
          <a href="#order" data-scroll className="mobile-nav-link" onClick={() => setMobileMenuOpen(false)}>Đặt hàng</a>
        </nav>
      </div>

      ${content.substring(content.indexOf('<main>'))}
    </>
  );
}
`;

fs.writeFileSync('apps/web/src/components/landing-raw.tsx', tsx);
console.log("Done");
