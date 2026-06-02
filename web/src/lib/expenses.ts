import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";

export interface ExpenseLine {
  userId: string;
  amountMinor: number;
  user?: { id: string; displayName: string };
}

export interface Expense {
  id: string;
  description: string;
  amountMinor: number;
  currency: string;
  rateToBase: number;
  splitMethod: string;
  date: string;
  category: string | null;
  createdById: string;
  payers: ExpenseLine[];
  shares: ExpenseLine[];
}

export interface Balance {
  userId: string;
  displayName: string;
  amountMinor: number;
}

export interface SettleTx {
  fromUserId: string;
  fromName: string;
  toUserId: string;
  toName: string;
  amountMinor: number;
}

export interface BalancesResponse {
  baseCurrency: string;
  balances: Balance[];
  transactions: SettleTx[];
}

export interface Settlement {
  id: string;
  amountMinor: number;
  currency: string;
  date: string;
  note: string | null;
  fromUser: { id: string; displayName: string };
  toUser: { id: string; displayName: string };
}

export interface NewExpenseInput {
  description: string;
  amountMinor: number;
  currency: string;
  rateToBase: number;
  splitMethod: "equal" | "exact" | "percent" | "shares";
  category?: string;
  payers: { userId: string; amountMinor: number }[];
  shares: { userId: string; amountMinor: number }[];
}

export function useExpenses(groupId: string) {
  return useQuery({
    queryKey: ["expenses", groupId],
    queryFn: () => api.get<{ expenses: Expense[] }>(`/groups/${groupId}/expenses`).then((r) => r.expenses),
  });
}

export function useBalances(groupId: string) {
  return useQuery({
    queryKey: ["balances", groupId],
    queryFn: () => api.get<BalancesResponse>(`/groups/${groupId}/balances`),
  });
}

export function useSettlements(groupId: string) {
  return useQuery({
    queryKey: ["settlements", groupId],
    queryFn: () => api.get<{ settlements: Settlement[] }>(`/groups/${groupId}/settlements`).then((r) => r.settlements),
  });
}

// Po zmianie danych odświeżamy wszystko, co zależy od wydatków/spłat.
function invalidateGroupMoney(qc: ReturnType<typeof useQueryClient>, groupId: string) {
  qc.invalidateQueries({ queryKey: ["expenses", groupId] });
  qc.invalidateQueries({ queryKey: ["balances", groupId] });
  qc.invalidateQueries({ queryKey: ["settlements", groupId] });
  qc.invalidateQueries({ queryKey: ["groups"] });
}

export function useExpense(groupId: string, expenseId: string | undefined) {
  return useQuery({
    queryKey: ["expense", groupId, expenseId],
    queryFn: () => api.get<{ expense: Expense }>(`/groups/${groupId}/expenses/${expenseId}`).then((r) => r.expense),
    enabled: !!expenseId,
  });
}

export function useCreateExpense(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: NewExpenseInput) => api.post(`/groups/${groupId}/expenses`, input),
    onSuccess: () => invalidateGroupMoney(qc, groupId),
  });
}

export function useUpdateExpense(groupId: string, expenseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: NewExpenseInput) => api.put(`/groups/${groupId}/expenses/${expenseId}`, input),
    onSuccess: () => {
      invalidateGroupMoney(qc, groupId);
      qc.invalidateQueries({ queryKey: ["expense", groupId, expenseId] });
    },
  });
}

export function useDeleteExpense(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (expenseId: string) => api.del(`/groups/${groupId}/expenses/${expenseId}`),
    onSuccess: () => invalidateGroupMoney(qc, groupId),
  });
}

export function useCreateSettlement(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { fromUserId: string; toUserId: string; amountMinor: number; note?: string }) =>
      api.post(`/groups/${groupId}/settlements`, input),
    onSuccess: () => invalidateGroupMoney(qc, groupId),
  });
}
