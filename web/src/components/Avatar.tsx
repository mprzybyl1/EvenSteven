// Avatar użytkownika: emotka jeśli ustawiona, inaczej inicjał w gradiencie marki.
// `className` steruje rozmiarem (h/w + rozmiar tekstu), np. "h-9 w-9 text-sm".
export function Avatar({
  name,
  emoji,
  className = "h-9 w-9 text-sm",
  placeholder = false,
}: {
  name?: string | null;
  emoji?: string | null;
  className?: string;
  placeholder?: boolean; // konto-widmo -> szary zamiast gradientu
}) {
  const base = `flex shrink-0 items-center justify-center rounded-full ${className}`;
  if (emoji) {
    return (
      <div className={`${base} bg-slate-100 leading-none`}>
        <span>{emoji}</span>
      </div>
    );
  }
  return (
    <div className={`${base} font-bold text-white ${placeholder ? "bg-slate-300" : "bg-brand-gradient"}`}>
      {(name ?? "?").charAt(0).toUpperCase()}
    </div>
  );
}
