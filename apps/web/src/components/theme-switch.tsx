import { Button } from "@rem-viet/ui/components/button";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

const storageKey = "rem-viet-theme";

export default function ThemeSwitch() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const storedTheme = window.localStorage.getItem(storageKey);
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)",
    ).matches;
    const nextTheme =
      storedTheme === "dark" || (!storedTheme && prefersDark)
        ? "dark"
        : "light";

    setTheme(nextTheme);
    document.documentElement.classList.toggle("dark", nextTheme === "dark");
  }, []);

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";

    setTheme(nextTheme);
    window.localStorage.setItem(storageKey, nextTheme);
    document.documentElement.classList.toggle("dark", nextTheme === "dark");
  }

  return (
    <Button
      aria-label={
        theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
      }
      className="rounded-lg bg-transparent text-muted-foreground hover:text-foreground"
      size="icon"
      type="button"
      variant="ghost"
      onClick={toggleTheme}
    >
      {theme === "dark" ? (
        <Sun aria-hidden className="size-[22px]" />
      ) : (
        <Moon aria-hidden className="size-[22px]" />
      )}
    </Button>
  );
}
