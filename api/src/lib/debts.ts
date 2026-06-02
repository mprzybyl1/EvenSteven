// Uproszczenie długów: z sald netto wyliczamy KTO komu ile przelać, minimalizując
// LICZBĘ przelewów. Problem (min. liczba transakcji) jest NP-trudny, ale dla wyjazdu
// (kilka–kilkanaście osób) backtracking liczy optimum w mgnieniu. Dla wielkich grup
// jest bezpiecznik: fallback do zachłannego (najwięksi dłużnicy płacą największym
// wierzycielom) — daje co najwyżej n-1 przelewów.

export interface Balance {
  userId: string;
  displayName: string;
  amountMinor: number; // dodatnie = wierzyciel, ujemne = dłużnik (w groszach waluty bazowej)
}

export interface SettleTx {
  fromUserId: string;
  fromName: string;
  toUserId: string;
  toName: string;
  amountMinor: number;
}

// Powyżej tylu niezerowych sald rezygnujemy z optimum (2^n) i lecimy zachłannie.
const OPTIMAL_LIMIT = 15;

export function simplifyDebts(balances: Balance[]): SettleTx[] {
  const people = balances.filter((b) => b.amountMinor !== 0);
  if (people.length === 0) return [];
  if (people.length > OPTIMAL_LIMIT) return greedy(people);
  return optimal(people);
}

// Backtracking: settlujemy pierwsze niezerowe saldo z każdym o przeciwnym znaku,
// przepychając jego całą wartość — i wybieramy ścieżkę o najmniejszej liczbie przelewów.
function optimal(people: Balance[]): SettleTx[] {
  const amt = people.map((p) => p.amountMinor);
  let best: SettleTx[] | null = null;

  function dfs(start: number, current: SettleTx[]) {
    while (start < amt.length && amt[start] === 0) start++;
    if (start === amt.length) {
      if (best === null || current.length < best.length) best = [...current];
      return;
    }
    if (best !== null && current.length >= best.length) return; // przycięcie

    for (let i = start + 1; i < amt.length; i++) {
      if (amt[i] === 0 || amt[i] > 0 === amt[start] > 0) continue; // potrzebny przeciwny znak

      const moved = amt[start];
      const amount = Math.abs(moved);
      const tx: SettleTx =
        moved < 0
          ? { fromUserId: people[start].userId, fromName: people[start].displayName, toUserId: people[i].userId, toName: people[i].displayName, amountMinor: amount }
          : { fromUserId: people[i].userId, fromName: people[i].displayName, toUserId: people[start].userId, toName: people[start].displayName, amountMinor: amount };

      amt[i] += moved;
      const savedStart = amt[start];
      amt[start] = 0;
      current.push(tx);

      dfs(start + 1, current);

      current.pop();
      amt[start] = savedStart;
      amt[i] -= moved;
    }
  }

  dfs(0, []);
  return best ?? [];
}

// Zachłannie: największy dłużnik płaci największemu wierzycielowi, aż wszyscy na zero.
function greedy(people: Balance[]): SettleTx[] {
  const debtors = people.filter((b) => b.amountMinor < 0).map((b) => ({ ...b, rem: -b.amountMinor })).sort((a, b) => b.rem - a.rem);
  const creditors = people.filter((b) => b.amountMinor > 0).map((b) => ({ ...b, rem: b.amountMinor })).sort((a, b) => b.rem - a.rem);
  const out: SettleTx[] = [];
  let di = 0, ci = 0;
  while (di < debtors.length && ci < creditors.length) {
    const d = debtors[di], c = creditors[ci];
    const pay = Math.min(d.rem, c.rem);
    if (pay > 0) {
      out.push({ fromUserId: d.userId, fromName: d.displayName, toUserId: c.userId, toName: c.displayName, amountMinor: pay });
      d.rem -= pay;
      c.rem -= pay;
    }
    if (d.rem === 0) di++;
    if (c.rem === 0) ci++;
  }
  return out;
}
