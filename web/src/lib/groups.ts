import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";

export interface GroupListItem {
  id: string;
  name: string;
  emoji: string | null;
  description: string | null;
  baseCurrency: string;
  memberCount: number;
  expenseCount: number;
  createdAt: string;
}

export interface GroupMember {
  userId: string;
  displayName: string;
  email: string | null;
  avatarEmoji?: string | null;
  blikPhone?: string | null;
  bankAccount?: string | null;
  payNote?: string | null;
  role: string;
  joinedAt: string;
  isPlaceholder?: boolean;
  // Link do przejęcia konta — tylko dla widm (niezarejestrowanych).
  claimUrl?: string | null;
}

export interface GroupDetail {
  id: string;
  name: string;
  emoji: string | null;
  description: string | null;
  baseCurrency: string;
  inviteCode: string;
  createdById: string;
  createdAt: string;
  members: GroupMember[];
}

export function useGroups() {
  return useQuery({
    queryKey: ["groups"],
    queryFn: () => api.get<{ groups: GroupListItem[] }>("/groups").then((r) => r.groups),
  });
}

export function useGroup(id: string) {
  return useQuery({
    queryKey: ["groups", id],
    queryFn: () => api.get<{ group: GroupDetail }>(`/groups/${id}`).then((r) => r.group),
  });
}

export function useCreateGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; emoji?: string | null; description?: string; baseCurrency: string }) =>
      api.post<{ group: { id: string } }>("/groups", input).then((r) => r.group),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["groups"] }),
  });
}

export function useUpdateGroup(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; emoji?: string | null; description?: string | null; baseCurrency: string }) =>
      api.patch(`/groups/${groupId}`, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["groups"] });
      qc.invalidateQueries({ queryKey: ["groups", groupId] });
    },
  });
}

export function useDeleteGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (groupId: string) => api.del(`/groups/${groupId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["groups"] }),
  });
}

export function useLeaveGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (groupId: string) => api.post(`/groups/${groupId}/leave`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["groups"] }),
  });
}

export function useRemoveMember(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => api.del(`/groups/${groupId}/members/${userId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["groups", groupId] }),
  });
}

// Dodanie uczestnika po imieniu (konto-widmo) albo dorzucenie istniejącego po e-mailu.
export function useAddMember(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; email?: string }) =>
      api.post<{ member: GroupMember; invited: boolean }>(`/groups/${groupId}/members`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["groups", groupId] }),
  });
}

// (Po)wysłanie zaproszenia do konta-widma na e-mail. Zwraca też link do skopiowania ręcznie.
export function useInviteMember(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, email }: { userId: string; email: string }) =>
      api.post<{ sent: boolean; claimUrl: string }>(`/groups/${groupId}/members/${userId}/invite`, { email }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["groups", groupId] }),
  });
}

export function useInvitePreview(code: string) {
  return useQuery({
    queryKey: ["invite", code],
    queryFn: () =>
      api
        .get<{ group: { id: string; name: string; emoji: string | null; baseCurrency: string; memberCount: number } }>(`/groups/invite/${code}`)
        .then((r) => r.group),
    retry: false,
  });
}

export function useJoinGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (inviteCode: string) =>
      api.post<{ group: { id: string }; alreadyMember: boolean }>("/groups/join", { inviteCode }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["groups"] }),
  });
}

// Najczęstsze waluty na wyjazdy — do dropdownu. Backend i tak waliduje dowolny kod ISO.
export const CURRENCIES = ["PLN", "EUR", "USD", "GBP", "CZK", "CHF", "HUF", "SEK", "NOK", "HRK"];
