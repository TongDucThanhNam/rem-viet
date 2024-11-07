import { useCallback, useEffect, useRef } from "react";

export function useThrottle<T extends (...args: any[]) => any>(
  func: T,
  delay: number,
): T {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastCalledRef = useRef<number>(0);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return useCallback(
    (...args: Parameters<T>) => {
      const now = Date.now();

      if (now - lastCalledRef.current >= delay) {
        func(...args);
        lastCalledRef.current = now;
      } else {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }

        // @ts-ignore
        timeoutRef.current = setTimeout(
          () => {
            func(...args);
            lastCalledRef.current = Date.now();
          },
          delay - (now - lastCalledRef.current),
        );
      }
    },
    [func, delay],
  ) as T;
}
