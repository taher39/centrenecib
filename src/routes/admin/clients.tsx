import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminListClients, saveClient, deleteClient, clientDetail } from "@/lib/admin.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Edit, Trash2, Eye, Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/clients")({ component: ClientsPage });

function ClientsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const listFn = useServerFn(adminListClients);
  const saveFn = useServerFn(saveClient);
  const delFn = useServerFn(deleteClient);
  const detailFn = useServerFn(clientDetail);

  const q = useQuery({ queryKey: ["clients"], queryFn: () => listFn() });
  const [search, setSearch] = useState("");
  const [edit, setEdit] = useState<{ id: string; full_name: string; age: number | null; phone: string; notes: string | null } | null>(null);
  const [view, setView] = useState<string | null>(null);
  const detail = useQuery({ enabled: !!view, queryKey: ["client-detail", view], queryFn: () => detailFn({ data: { id: view! } }) });

  const items = (q.data?.items ?? []).filter((c) => !search || c.full_name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search));

  const onSave = async () => {
    if (!edit) return;
    try { await saveFn({ data: edit }); setEdit(null); qc.invalidateQueries({ queryKey: ["clients"] }); toast.success("✓"); }
    catch (e) { toast.error((e as Error).message); }
  };

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl text-primary">{t("nav.clients")}</h1>
        <div className="relative max-w-xs">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="ps-8" placeholder={t("common.search")} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="grid gap-2">
        {items.map((c) => {
          const debt = Number(c.debt);
          const color = debt > 0 ? "border-destructive/50 bg-destructive/5" : c.hasPending ? "border-pending bg-pending/10" : "";
          return (
            <Card key={c.id} className={color}>
              <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="font-semibold">{c.full_name} <span className="text-xs text-muted-foreground font-mono">· {c.code}</span></div>
                  <div className="text-xs text-muted-foreground">{c.phone} {c.age && `· ${c.age}`}</div>
                </div>
                <div className="flex items-center gap-2">
                  {debt > 0 && <Badge className="bg-destructive text-destructive-foreground">{debt.toLocaleString()} {t("common.currency")}</Badge>}
                  {c.hasPending && <Badge className="bg-pending text-pending-foreground">●</Badge>}
                  <Button size="icon" variant="ghost" onClick={() => setView(c.id)}><Eye className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => setEdit({ id: c.id, full_name: c.full_name, age: c.age, phone: c.phone, notes: c.notes })}><Edit className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => { if (confirm("Supprimer ?")) delFn({ data: { id: c.id } }).then(() => qc.invalidateQueries({ queryKey: ["clients"] })); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("common.edit")}</DialogTitle></DialogHeader>
          {edit && (
            <div className="grid gap-3">
              <div className="grid gap-2"><Label>{t("common.name")}</Label><Input value={edit.full_name} onChange={(e) => setEdit({ ...edit, full_name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div className="grid gap-2"><Label>{t("common.age")}</Label><Input type="number" value={edit.age ?? ""} onChange={(e) => setEdit({ ...edit, age: e.target.value ? Number(e.target.value) : null })} /></div>
                <div className="grid gap-2"><Label>{t("common.phone")}</Label><Input value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} /></div>
              </div>
              <div className="grid gap-2"><Label>{t("common.notes")}</Label><Textarea value={edit.notes ?? ""} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter><Button onClick={onSave}>{t("common.save")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!view} onOpenChange={(o) => !o && setView(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{t("admin.treatmentHistory")}</DialogTitle></DialogHeader>
          {detail.data?.client && (
            <div className="grid gap-3">
              <div>
                <div className="font-semibold text-lg">{detail.data.client.full_name}</div>
                <div className="text-xs text-muted-foreground">{detail.data.client.phone} · code {detail.data.client.code}</div>
                {detail.data.client.notes && <div className="mt-2 rounded bg-secondary p-2 text-sm">{detail.data.client.notes}</div>}
              </div>
              <div>
                <div className="text-xs font-semibold uppercase text-muted-foreground mb-1">Séances</div>
                <div className="grid gap-1 text-sm">
                  {detail.data.appts.map((a) => (
                    <div key={a.id} className="flex justify-between border-b pb-1">
                      <span>{(a as { services?: { name?: string } }).services?.name}</span>
                      <span className="text-muted-foreground">{a.appointment_date} · {a.status}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase text-muted-foreground mb-1">Factures</div>
                <div className="grid gap-1 text-sm">
                  {detail.data.invoices.map((i) => (
                    <div key={i.id} className="flex justify-between border-b pb-1">
                      <span>{i.number}</span>
                      <span>{Number(i.total).toLocaleString()} · payé {Number(i.amount_paid).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
