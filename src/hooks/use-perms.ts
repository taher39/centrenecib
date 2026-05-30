import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { me } from "@/lib/admin.functions";

export type PermScope =
  | "appointments" | "clients" | "services" | "offers"
  | "gallery" | "invoices" | "finance" | "discounts";
export type PermAction = "view" | "edit" | "delete";

export function usePerms() {
  const meFn = useServerFn(me);
  const q = useQuery({ queryKey: ["me"], queryFn: () => meFn(), retry: false, staleTime: 60_000 });
  const isAdmin = !!q.data?.isAdmin;
  const can = (scope: PermScope, action: PermAction) => {
    if (isAdmin) return true;
    return (q.data?.perms ?? []).some((p) => p.scope === scope && p.action === action);
  };
  return { isAdmin, can, loading: q.isLoading };
}
