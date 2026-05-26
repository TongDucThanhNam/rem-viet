import { motion } from "framer-motion";
import { useMagnetic } from "../../hooks/use-magnetic";

function MagneticLink({ href, className, children }: { href: string; className?: string; children: React.ReactNode }) {
  const { ref, x, y } = useMagnetic();
  return (
    <motion.a
      ref={ref as any}
      href={href}
      className={className}
      style={{ x, y }}
    >
      {children}
    </motion.a>
  );
}

export function Navigation() {
  return (
    <nav className="nav">
      <div className="nav-brand font-vietnam">LUXE MESH</div>
      <div className="nav-links font-vietnam">
        <MagneticLink href="#vision" className="hover-target">
          Tầm Nhìn
        </MagneticLink>
        <MagneticLink href="#details" className="hover-target">
          Chi Tiết
        </MagneticLink>
        <MagneticLink href="#measure" className="hover-target">
          Cách Đo
        </MagneticLink>
      </div>
      <MagneticLink href="#order" className="nav-cta hover-target font-vietnam">
        Tư Vấn
      </MagneticLink>
    </nav>
  );
}
