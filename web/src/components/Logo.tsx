export function Logo({ size = 72, withText = true }: { size?: number; withText?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <img src="/logo.png" alt="EvenSteven" width={size} height={size} className="object-contain" style={{ width: size, height: size }} />
      {withText && (
        <span className="text-2xl font-extrabold tracking-tight text-brand-ink">
          Even<span className="text-brand-gradient">Steven</span>
        </span>
      )}
    </div>
  );
}
