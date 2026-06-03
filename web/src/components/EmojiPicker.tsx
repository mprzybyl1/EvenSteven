// Kuratorowane emotki pod typowe wyjazdy/aktywności. Można też wpisać własną.
const TRIP_EMOJIS = [
  "🏔️", "⛰️", "⛷️", "🏂", "🏖️", "🏝️", "🌴", "🏕️",
  "🏙️", "🗽", "🎢", "🎉", "🍻", "🍷", "🍔", "🍕",
  "✈️", "🚗", "🚐", "🚂", "⛵", "⛺", "🔥", "🎣",
  "🚵", "🏄", "🏊", "⚽", "🏀", "🎾", "🏓", "🏸",
  "⛳", "🎿", "🥾", "🎸", "🎤", "🎮", "🎲", "🧳",
];

export function EmojiPicker({ value, onChange }: { value: string | null; onChange: (emoji: string | null) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {TRIP_EMOJIS.map((e) => (
          <button
            type="button" key={e} onClick={() => onChange(e)}
            className={`flex h-10 w-10 items-center justify-center rounded-xl text-xl transition ${
              value === e ? "bg-brand-blue/15 ring-2 ring-brand-blue" : "bg-slate-100"
            }`}
          >
            {e}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <input
          value={value ?? ""} maxLength={12} placeholder="lub wpisz / wklej własną"
          onChange={(ev) => onChange(ev.target.value || null)}
          className="w-48 rounded-lg border border-slate-200 bg-white px-3 py-2 text-base outline-none focus:border-brand-blue"
        />
        {value && (
          <button type="button" onClick={() => onChange(null)} className="text-sm text-slate-400 hover:text-slate-600">
            wyczyść
          </button>
        )}
      </div>
    </div>
  );
}
