import { useEffect, useState } from "react";

export type Theme = "light" | "dark";

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() =>
    localStorage.getItem("bazaar-theme") === "dark" ? "dark" : "light",
  );

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("bazaar-theme", theme);
  }, [theme]);

  return { theme, toggleTheme: () => setTheme(theme === "dark" ? "light" : "dark") };
}
