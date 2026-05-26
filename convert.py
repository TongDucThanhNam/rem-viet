import re

with open('draft/index.html', 'r') as f:
    html = f.read()

# Just extract <main>...</main> and <footer>...</footer>
main_start = html.find('<main>')
footer_end = html.find('</footer>') + len('</footer>')

content = html[main_start:footer_end]

# Convert class to className
content = content.replace('class="', 'className="')

# Convert SVG attributes
attrs_to_camel = ['stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray', 'fill-opacity']
for attr in attrs_to_camel:
    camel = attr.split('-')[0] + attr.split('-')[1].capitalize()
    content = content.replace(f'{attr}="', f'{camel}="')

# Close tags
content = content.replace('<br>', '<br />')

def close_tag(match):
    tag = match.group(0)
    if tag.endswith('/>'): return tag
    return tag[:-1] + ' />'

content = re.sub(r'<img[^>]*>', close_tag, content)
content = re.sub(r'<rect[^>]*>', close_tag, content)
content = re.sub(r'<circle[^>]*>', close_tag, content)
content = re.sub(r'<path[^>]*>', close_tag, content)

# Comments
content = re.sub(r'<!--(.*?)-->', r'{/* \1 */}', content)

tsx = f"""import {{ useScrollAnimation }} from "../hooks/use-scroll-animation";
import {{ useEffect, useState }} from "react";

export function LandingRaw() {{
  useScrollAnimation();
  
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [headerScrolled, setHeaderScrolled] = useState(false);

  useEffect(() => {{
    const handleScroll = () => {{
      setHeaderScrolled(window.scrollY > 50);
    }};
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }}, []);

  useEffect(() => {{
    const faqs = document.querySelectorAll(".faq-question");
    const toggleFaq = (e: Event) => {{
      const question = e.currentTarget as HTMLElement;
      const item = question.parentElement;
      if (!item) return;
      const isActive = item.classList.contains("active");

      document.querySelectorAll(".faq-item").forEach((el) => {{
        el.classList.remove("active");
        el.querySelector(".faq-question")?.setAttribute("aria-expanded", "false");
      }});

      if (!isActive) {{
        item.classList.add("active");
        question.setAttribute("aria-expanded", "true");
      }}
    }};
    
    faqs.forEach(q => q.addEventListener("click", toggleFaq));
    return () => faqs.forEach(q => q.removeEventListener("click", toggleFaq));
  }}, []);

  return (
    <>
      {{/* Header */}}
      <header className={{`site-header ${{headerScrolled ? "scrolled" : ""}}`}} id="site-header">
        <div className="container header-inner">
          <a href="#" className="logo" data-scroll>
            <span className="logo-icon">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <rect x="2" y="2" width="24" height="24" rx="4" stroke="currentColor" strokeWidth="1.5" />
                <path d="M2 8h24M2 14h24M2 20h24M8 2v24M14 2v24M20 2v24" stroke="currentColor" strokeWidth="0.75" opacity="0.5" />
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
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
          <button 
            className={{`menu-toggle ${{mobileMenuOpen ? "active" : ""}}`}} 
            id="menu-toggle" 
            aria-label="Menu"
            onClick={{() => setMobileMenuOpen(!mobileMenuOpen)}}
          >
            <span></span>
            <span></span>
            <span></span>
          </button>
        </div>
      </header>

      {{/* Mobile Menu */}}
      <div className={{`mobile-menu ${{mobileMenuOpen ? "active" : ""}}`}} id="mobile-menu">
        <nav className="mobile-nav">
          <a href="#product" data-scroll className="mobile-nav-link" onClick={{() => setMobileMenuOpen(false)}}>Sản phẩm</a>
          <a href="#measure" data-scroll className="mobile-nav-link" onClick={{() => setMobileMenuOpen(false)}}>Kích thước</a>
          <a href="#material" data-scroll className="mobile-nav-link" onClick={{() => setMobileMenuOpen(false)}}>Chất liệu</a>
          <a href="#spaces" data-scroll className="mobile-nav-link" onClick={{() => setMobileMenuOpen(false)}}>Không gian</a>
          <a href="#order" data-scroll className="mobile-nav-link" onClick={{() => setMobileMenuOpen(false)}}>Đặt hàng</a>
        </nav>
      </div>

      {content}
    </>
  );
}}
"""

with open('apps/web/src/components/landing-raw.tsx', 'w') as f:
    f.write(tsx)

print("Done")
