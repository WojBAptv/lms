import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const [dark, setDark] = useState(() => localStorage.getItem("theme") === "dark");

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);

  return (
    <Button
    variant="ghost"
    onClick={() => setDark(d => !d)}
    aria-label="Toggle theme"
    className="inline-flex items-center gap-2"
    >
    {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    <span className="hidden sm:inline">{dark ? "Light" : "Dark"}</span>
    </Button>
  );
}
