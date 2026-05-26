import { useEffect } from "react";

export function useScrollAnimation() {
  useEffect(() => {
    const observerOptions = {
      threshold: 0.1,
      rootMargin: "0px 0px -50px 0px",
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const target = entry.target as HTMLElement;
          const delay = target.dataset.delay || "0";
          setTimeout(() => {
            target.classList.add("animated");
          }, parseInt(delay));
          observer.unobserve(target);
        }
      });
    }, observerOptions);

    const elements = document.querySelectorAll("[data-animate]");
    elements.forEach((el) => {
      observer.observe(el);
    });

    // Initial animation for visible elements
    const timer = setTimeout(() => {
      elements.forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight) {
          const target = el as HTMLElement;
          const delay = target.dataset.delay || "0";
          setTimeout(() => {
            target.classList.add("animated");
          }, parseInt(delay));
        }
      });
    }, 100);

    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, []);
}
