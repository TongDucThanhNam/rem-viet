import { useEffect, useState } from "react";

export function LoadingScreenRaw({ onComplete }: { onComplete?: () => void }) {
  const [progress, setProgress] = useState(0);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    // Hide scrolling during loading
    document.body.style.overflow = "hidden";
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const loadingInterval = setInterval(() => {
      setProgress((prev) => {
        const next = prev + Math.random() * 15;
        if (next >= 100) {
          clearInterval(loadingInterval);
          timeoutId = setTimeout(() => {
            setHidden(true);
            document.body.style.overflow = "";
            if (onComplete) onComplete();
          }, 300);
          return 100;
        }
        return next;
      });
    }, 150);

    return () => {
      clearInterval(loadingInterval);
      if (timeoutId) clearTimeout(timeoutId);
      document.body.style.overflow = "";
    };
  }, [onComplete]);

  return (
    <div className={`loading-screen ${hidden ? "hidden" : ""}`} id="loading-screen">
      <div className="loading-content">
        <div className="loading-logo">RÈM VINA</div>
        <div className="loading-bar">
          <div
            className="loading-progress"
            id="loading-progress"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
