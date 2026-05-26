import { useEffect, useRef, useState } from "react";

export function CustomCursorRaw() {
  const cursorRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [hasText, setHasText] = useState(false);
  const [cursorText, setCursorText] = useState("");

  useEffect(() => {
    // Hide cursor on touch devices
    if (window.matchMedia("(pointer: coarse)").matches) return;

    // Set custom cursor class on root element
    document.documentElement.classList.add("has-custom-cursor");

    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let cursorX = mouseX;
    let cursorY = mouseY;
    let animationFrameId: number;

    const onMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    };

    const animateCursor = () => {
      // Smooth cursor follow (softer floaty feel)
      cursorX += (mouseX - cursorX) * 0.1;
      cursorY += (mouseY - cursorY) * 0.1;
      if (cursorRef.current) {
        cursorRef.current.style.transform = `translate3d(${cursorX}px, ${cursorY}px, 0)`;
      }
      animationFrameId = requestAnimationFrame(animateCursor);
    };

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const hoverTarget =
        target.closest(".hover-target") ||
        target.closest("a") ||
        target.closest("button") ||
        target.closest(".space-card") ||
        target.closest(".feature-card");

      if (hoverTarget) {
        const text = hoverTarget.getAttribute("data-cursor");
        if (text) {
          setCursorText(text);
          setHasText(true);
          setIsHovered(false);
        } else {
          setCursorText("");
          setHasText(false);
          setIsHovered(true);
        }
      } else {
        setCursorText("");
        setHasText(false);
        setIsHovered(false);
      }
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseover", handleMouseOver);
    animationFrameId = requestAnimationFrame(animateCursor);

    return () => {
      document.documentElement.classList.remove("has-custom-cursor");
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseover", handleMouseOver);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div
      className={`cursor ${isHovered ? "hovering" : ""} ${hasText ? "has-text" : ""}`}
      id="cursor"
      ref={cursorRef}
    >
      <div className="cursor-dot" />
      <div className="cursor-text">{cursorText}</div>
    </div>
  );
}
