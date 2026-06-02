// Motyw: 'system' podąża za ustawieniem urządzenia; 'light'/'dark' wymuszają.
export type Theme = "system" | "light" | "dark";

const KEY = "es-theme";

export function getTheme(): Theme {
  const v = localStorage.getItem(KEY);
  return v === "light" || v === "dark" ? v : "system";
}

function prefersDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function applyTheme(t: Theme = getTheme()): void {
  const dark = t === "dark" || (t === "system" && prefersDark());
  document.documentElement.classList.toggle("dark", dark);
}

export function setTheme(t: Theme): void {
  localStorage.setItem(KEY, t);
  applyTheme(t);
}

// Wywołaj raz na starcie: zastosuj zapisany motyw i reaguj na zmianę systemu
// (gdy ustawienie = 'system').
export function initTheme(): void {
  applyTheme();
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (getTheme() === "system") applyTheme("system");
  });
}
