import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";

export interface ApiTokenItem {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt: string | null;
  createdAt: string;
}

export function useTokens() {
  return useQuery({
    queryKey: ["tokens"],
    queryFn: () => api.get<{ tokens: ApiTokenItem[] }>("/tokens").then((r) => r.tokens),
  });
}

export function useCreateToken() {
  const qc = useQueryClient();
  return useMutation({
    // Plaintext tokenu (`token`) przychodzi TYLKO tu — pokazujemy raz, nie zapisujemy.
    mutationFn: (name: string) => api.post<{ token: string; info: ApiTokenItem }>("/tokens", { name }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tokens"] }),
  });
}

export function useDeleteToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del(`/tokens/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tokens"] }),
  });
}
