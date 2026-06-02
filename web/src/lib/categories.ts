// Predefiniowane kategorie wydatków (klucz zapisujemy w bazie jako `category`).
export interface Category {
  key: string;
  label: string;
  emoji: string;
}

export const CATEGORIES: Category[] = [
  { key: "food", label: "Jedzenie", emoji: "🍽️" },
  { key: "drinks", label: "Napoje", emoji: "🍺" },
  { key: "groceries", label: "Zakupy spoż.", emoji: "🛒" },
  { key: "transport", label: "Transport", emoji: "🚗" },
  { key: "accommodation", label: "Nocleg", emoji: "🏨" },
  { key: "entertainment", label: "Rozrywka", emoji: "🎉" },
  { key: "activities", label: "Atrakcje", emoji: "🎟️" },
  { key: "shopping", label: "Zakupy", emoji: "🛍️" },
  { key: "other", label: "Inne", emoji: "📦" },
];

const OTHER = CATEGORIES[CATEGORIES.length - 1];

export function categoryMeta(key?: string | null): Category {
  return CATEGORIES.find((c) => c.key === key) ?? OTHER;
}
