import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminListServices, saveService, deleteService, listWorkingHours, saveWorkingHours } from "@/lib/admin.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Edit, Clock } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { usePerms } from "@/hooks/use-perms";

export const Route = createFileRoute("/admin/services")({ component: AdminServicesPage });

const DAY_LABELS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

type Svc = {
  id?: string; name: string; description?: string | null; duration_min: number; price_dzd: number;
  capacity: number; available_days: number[]; active?: boolean;
};

function AdminServicesPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const listFn = useServerFn(adminListServices);
  const saveFn = useServerFn(saveService);
  const delFn = useServerFn(deleteService);
  const hoursFn = useServerFn(listWorkingHours);
  const saveHoursFn = useServerFn(saveWorkingHours);

  const services = useQuery({ queryKey: ["svc"], queryFn: () => listFn() });
  const hours = useQuery({ queryKey: ["hours"], queryFn: () => hoursFn() });

  const [edit, setEdit] = useState<Svc | null>(null);

  const onSave = async () => {
    if (!edit) return;
    try {
      await saveFn({ data: {
        id: edit.id, name: edit.name, description: edit.description ?? null,
        duration_min: Number(edit.duration_min), price_dzd: Number(edit.price_dzd),
        capacity: Number(edit.capacity), available_days: edit.available_days, active: edit.active ?? true,
      } });
      setEdit(null); qc.invalidateQueries({ queryKey: ["svc"] }); toast.success("✓");
    } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl text-primary">{t("nav.services")}</h1>
        <Button onClick={() => setEdit({ name: "", duration_min: 30, price_dzd: 1000, capacity: 1, available_days: [0,1,2,3,4,5,6] })}><Plus className="h-4 w-4 me-1" />{t("admin.addService")}</Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {(services.data?.items ?? []).map((s) => (
          <Card key={s.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold">{s.name}</div>
                  <div className="text-xs text-muted-foreground">{s.duration_min}min · {Number(s.price_dzd).toLocaleString()} {t("common.currency")} · cap {s.capacity}</div>
                  <div className="mt-1 flex gap-1">{(s.available_days as number[]).map((d) => <span key={d} className="text-[10px] rounded bg-secondary px-1.5 py-0.5">{DAY_LABELS[d]}</span>)}</div>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => setEdit({ ...s, description: s.description ?? "" } as Svc)}><Edit className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => { if (confirm("?")) delFn({ data: { id: s.id } }).then(() => qc.invalidateQueries({ queryKey: ["svc"] })); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <WorkingHoursEditor
        slots={(hours.data?.items ?? []).map((h) => ({ label: h.label, start_time: h.start_time.slice(0, 5), end_time: h.end_time.slice(0, 5) }))}
        onSave={async (slots) => { await saveHoursFn({ data: { slots } }); qc.invalidateQueries({ queryKey: ["hours"] }); toast.success("✓"); }}
      />

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit?.id ? t("common.edit") : t("admin.addService")}</DialogTitle></DialogHeader>
          {edit && (
            <div className="grid gap-3">
              <div className="grid gap-2"><Label>{t("common.name")}</Label><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></div>
              <div className="grid gap-2"><Label>Description</Label><Textarea value={edit.description ?? ""} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></div>
              <div className="grid grid-cols-3 gap-2">
                <div className="grid gap-1"><Label>{t("common.duration")} (min)</Label><Input type="number" value={edit.duration_min} onChange={(e) => setEdit({ ...edit, duration_min: Number(e.target.value) })} /></div>
                <div className="grid gap-1"><Label>{t("common.price")}</Label><Input type="number" value={edit.price_dzd} onChange={(e) => setEdit({ ...edit, price_dzd: Number(e.target.value) })} /></div>
                <div className="grid gap-1"><Label>{t("admin.capacity")}</Label><Input type="number" min={1} value={edit.capacity} onChange={(e) => setEdit({ ...edit, capacity: Number(e.target.value) })} /></div>
              </div>
              <div className="grid gap-2">
                <Label>{t("admin.availableDays")}</Label>
                <div className="flex flex-wrap gap-1">
                  {DAY_LABELS.map((d, i) => {
                    const on = edit.available_days.includes(i);
                    return <button key={i} type="button" onClick={() => setEdit({ ...edit, available_days: on ? edit.available_days.filter((x) => x !== i) : [...edit.available_days, i] })} className={`rounded px-3 py-1 text-xs ${on ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>{d}</button>;
                  })}
                </div>
              </div>
              <div className="flex items-center gap-2"><Switch checked={edit.active !== false} onCheckedChange={(v) => setEdit({ ...edit, active: v })} /><Label>Actif</Label></div>
            </div>
          )}
          <DialogFooter><Button onClick={onSave}>{t("common.save")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function WorkingHoursEditor({ slots, onSave }: { slots: { label: string | null; start_time: string; end_time: string }[]; onSave: (s: { label: string | null; start_time: string; end_time: string }[]) => Promise<void> }) {
  const { t } = useTranslation();
  const [local, setLocal] = useState(slots);
  // Sync once when slots change length
  if (local.length === 0 && slots.length > 0) setLocal(slots);
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Clock className="h-4 w-4" />{t("admin.workingHours")}</CardTitle></CardHeader>
      <CardContent className="grid gap-2">
        {local.map((s, i) => (
          <div key={i} className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center">
            <Input placeholder="Matin/Après-midi" value={s.label ?? ""} onChange={(e) => { const n = [...local]; n[i] = { ...s, label: e.target.value }; setLocal(n); }} />
            <Input type="time" value={s.start_time} onChange={(e) => { const n = [...local]; n[i] = { ...s, start_time: e.target.value }; setLocal(n); }} />
            <Input type="time" value={s.end_time} onChange={(e) => { const n = [...local]; n[i] = { ...s, end_time: e.target.value }; setLocal(n); }} />
            <Button size="icon" variant="ghost" onClick={() => setLocal(local.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4 text-destructive" /></Button>
          </div>
        ))}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setLocal([...local, { label: "", start_time: "09:00", end_time: "12:00" }])}><Plus className="h-4 w-4" /> Créneau</Button>
          <Button size="sm" onClick={() => onSave(local)}>{t("common.save")}</Button>
        </div>
      </CardContent>
    </Card>
  );
}
