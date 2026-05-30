import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listStaff, createStaff, updateStaffPermissions, deleteStaff } from "@/lib/admin.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Trash2, Edit } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/staff")({ component: StaffPage });

const SCOPES = ["appointments", "clients", "services", "offers", "gallery", "invoices", "finance", "discounts"] as const;
const ACTIONS = ["view", "edit", "delete"] as const;

const setPerm = (s: Set<string>, scope: string, action: string, on: boolean) => {
  const key = `${scope}:${action}`;
  const n = new Set(s);
  if (on) n.add(key); else n.delete(key);
  return n;
};

function PermDialog({
  open, onOpenChange, title, perms, setPerms, onSubmit, children,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  perms: Set<string>;
  setPerms: (p: Set<string>) => void;
  onSubmit: () => void;
  children?: React.ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          {children}
          <div>
            <Label className="text-sm">{t("admin.permissions")}</Label>
            <table className="mt-2 w-full text-sm">
              <thead><tr className="text-xs text-muted-foreground"><th className="text-start py-1"></th>{ACTIONS.map((a) => <th key={a} className="py-1">{t(`admin.perm${a[0].toUpperCase() + a.slice(1)}`)}</th>)}</tr></thead>
              <tbody>
                {SCOPES.map((s) => (
                  <tr key={s} className="border-t">
                    <td className="py-1.5 text-xs">{t(`nav.${s}`)}</td>
                    {ACTIONS.map((a) => (
                      <td key={a} className="text-center">
                        <Checkbox checked={perms.has(`${s}:${a}`)} onCheckedChange={(v) => setPerms(setPerm(perms, s, a, !!v))} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <DialogFooter><Button onClick={onSubmit}>{t("common.save")}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StaffPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const listFn = useServerFn(listStaff);
  const createFn = useServerFn(createStaff);
  const updateFn = useServerFn(updateStaffPermissions);
  const delFn = useServerFn(deleteStaff);

  const q = useQuery({ queryKey: ["staff"], queryFn: () => listFn() });
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ username: "", password: "", displayName: "", perms: new Set<string>() });
  const [editPerms, setEditPerms] = useState<{ userId: string; displayName: string; perms: Set<string> } | null>(null);

  const submit = async () => {
    try {
      const permissions = Array.from(form.perms).map((k) => { const [scope, action] = k.split(":"); return { scope, action }; }) as { scope: typeof SCOPES[number]; action: typeof ACTIONS[number] }[];
      await createFn({ data: { ...form, permissions } });
      setCreating(false); setForm({ username: "", password: "", displayName: "", perms: new Set() });
      qc.invalidateQueries({ queryKey: ["staff"] }); toast.success("✓");
    } catch (e) { toast.error((e as Error).message); }
  };

  const saveEdit = async () => {
    if (!editPerms) return;
    try {
      const permissions = Array.from(editPerms.perms).map((k) => { const [scope, action] = k.split(":"); return { scope, action }; }) as { scope: typeof SCOPES[number]; action: typeof ACTIONS[number] }[];
      await updateFn({ data: { userId: editPerms.userId, permissions } });
      setEditPerms(null); qc.invalidateQueries({ queryKey: ["staff"] }); toast.success("✓");
    } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl text-primary">{t("nav.staff")}</h1>
        <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4 me-1" />{t("admin.createStaff")}</Button>
      </div>

      <div className="grid gap-2">
        {(q.data?.staff ?? []).map((s) => {
          const myPerms = (q.data?.perms ?? []).filter((p) => p.user_id === s.user_id);
          const set = new Set(myPerms.map((p) => `${p.scope}:${p.action}`));
          return (
            <Card key={s.id}>
              <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="font-semibold">{s.display_name ?? s.username}</div>
                  <div className="text-xs text-muted-foreground">{s.username}</div>
                  <div className="mt-1 text-xs">{myPerms.length} permission(s)</div>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => setEditPerms({ userId: s.user_id, displayName: s.display_name ?? s.username ?? "", perms: set })}><Edit className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => { if (confirm("?")) delFn({ data: { userId: s.user_id } }).then(() => qc.invalidateQueries({ queryKey: ["staff"] })); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <PermDialog open={creating} onOpenChange={setCreating} title={t("admin.createStaff")} perms={form.perms} setPerms={(p) => setForm((f) => ({ ...f, perms: p }))} onSubmit={submit}>
        <div className="grid gap-2"><Label>{t("admin.username")}</Label><Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></div>
        <div className="grid gap-2"><Label>{t("admin.password")}</Label><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
        <div className="grid gap-2"><Label>{t("common.name")}</Label><Input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} /></div>
      </PermDialog>

      <PermDialog open={!!editPerms} onOpenChange={(o) => !o && setEditPerms(null)} title={editPerms?.displayName ?? ""} perms={editPerms?.perms ?? new Set()} setPerms={(p) => setEditPerms((e) => e ? { ...e, perms: p } : e)} onSubmit={saveEdit} />
    </div>
  );
}
