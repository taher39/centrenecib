import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminAppointments, setAppointmentStatus, markAppointmentRead, deleteAppointment } from "@/lib/admin.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslation } from "react-i18next";
import { useMemo, useState } from "react";
import { Trash2, Bell } from "lucide-react";
import { toast } from "sonner";
import { usePerms } from "@/hooks/use-perms";

export const Route = createFileRoute("/admin/")({ component: AdminAppointmentsPage });

const STATUSES = ["pending", "confirmed", "completed", "cancelled", "postponed"] as const;

function statusColor(s: string) {
  return {
    pending: "bg-pending text-pending-foreground",
    confirmed: "bg-primary/15 text-primary",
    completed: "bg-secondary text-secondary-foreground",
    cancelled: "bg-destructive/15 text-destructive",
    postponed: "bg-accent text-accent-foreground",
  }[s] ?? "bg-muted";
}

function AdminAppointmentsPage() {
  const { t } = useTranslation();
  const { can } = usePerms();
  const qc = useQueryClient();
  const fetchFn = useServerFn(adminAppointments);
  const setStatus = useServerFn(setAppointmentStatus);
  const markRead = useServerFn(markAppointmentRead);
  const del = useServerFn(deleteAppointment);

  const q = useQuery({ queryKey: ["appts"], queryFn: () => fetchFn(), refetchInterval: 15000 });
  const items = q.data?.items ?? [];

  const today = new Date().toISOString().slice(0, 10);
  const tmw = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); })();
  const weekEnd = (() => { const d = new Date(); d.setDate(d.getDate() + 7); return d.toISOString().slice(0, 10); })();

  const filtered = useMemo(() => ({
    today: items.filter((a) => a.appointment_date === today),
    tomorrow: items.filter((a) => a.appointment_date === tmw),
    week: items.filter((a) => a.appointment_date >= today && a.appointment_date <= weekEnd),
    all: items,
    cancelled: items.filter((a) => a.status === "cancelled"),
    postponed: items.filter((a) => a.status === "postponed"),
  }), [items, today, tmw, weekEnd]);

  const newCount = items.filter((a) => !a.is_read && a.status === "pending").length;

  const [postpone, setPostpone] = useState<{ id: string; date: string; time: string; status?: typeof STATUSES[number] } | null>(null);

  const onStatus = async (id: string, status: typeof STATUSES[number]) => {
    if (status === "postponed") {
      setPostpone({ id, date: today, time: "09:00", status: "postponed" });
      return;
    }
    try { await setStatus({ data: { id, status } }); qc.invalidateQueries({ queryKey: ["appts"] }); toast.success("✓"); }
    catch (e) { toast.error((e as Error).message); }
  };

  const submitPostpone = async () => {
    if (!postpone) return;
    try { await setStatus({ data: { id: postpone.id, status: postpone.status ?? "postponed", newDate: postpone.date, newTime: postpone.time } }); setPostpone(null); qc.invalidateQueries({ queryKey: ["appts"] }); }
    catch (e) { toast.error((e as Error).message); }
  };

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <h1 className="font-display text-2xl text-primary">{t("nav.appointments")}</h1>
        {newCount > 0 && <Badge className="bg-destructive text-destructive-foreground"><Bell className="h-3 w-3 me-1" />{newCount} {t("admin.newRequests")}</Badge>}
      </div>

      <Tabs defaultValue="today">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="today">{t("common.today")} ({filtered.today.length})</TabsTrigger>
          <TabsTrigger value="tomorrow">{t("common.tomorrow")} ({filtered.tomorrow.length})</TabsTrigger>
          <TabsTrigger value="week">7j ({filtered.week.length})</TabsTrigger>
          <TabsTrigger value="all">{t("admin.appointmentsAll")} ({filtered.all.length})</TabsTrigger>
          <TabsTrigger value="cancelled">{t("admin.appointmentsCancelled")} ({filtered.cancelled.length})</TabsTrigger>
          <TabsTrigger value="postponed">{t("admin.appointmentsPostponed")} ({filtered.postponed.length})</TabsTrigger>
        </TabsList>
        {(Object.entries(filtered) as [keyof typeof filtered, typeof items][]).map(([k, list]) => (
          <TabsContent key={k} value={k} className="mt-4 grid gap-2">
            {list.length === 0 && <div className="rounded-xl border-2 border-dashed p-6 text-center text-muted-foreground">—</div>}
            {list.map((a) => {
              const client = (a as { clients?: { full_name?: string; phone?: string; code?: string } }).clients;
              const svc = (a as { services?: { name?: string; price_dzd?: number; duration_min?: number } }).services;
              const off = (a as { offers?: { title?: string; offer_price?: number } }).offers;
              const title = svc?.name ?? off?.title ?? "—";
              const price = svc?.price_dzd ?? off?.offer_price ?? 0;
              const timeStr = a.appointment_time ? String(a.appointment_time).slice(0, 5) : "— : —";
              const needsTime = !a.appointment_time;
              return (
                <Card key={a.id} className={!a.is_read && a.status === "pending" ? "border-pending" : ""}>
                  <CardContent className="p-4 grid gap-3 md:grid-cols-[1fr_auto_auto] items-center">
                    <div>
                      <div className="font-semibold">{client?.full_name} <span className="text-xs text-muted-foreground font-mono">· {client?.code}</span></div>
                      <div className="text-xs text-muted-foreground">{client?.phone}</div>
                      <div className="mt-1 text-sm">
                        {off ? <Badge className="bg-destructive text-destructive-foreground me-1">{t("nav.offers")}</Badge> : null}
                        {title} · <span className="text-muted-foreground">{svc?.duration_min ? `${svc.duration_min}min · ` : ""}{Number(price).toLocaleString()} {t("common.currency")}</span>
                      </div>
                      <div className="text-sm font-medium">{a.appointment_date} · {timeStr}</div>
                      {needsTime && <div className="text-xs text-destructive mt-1">⚠ {t("admin.setTimeNeeded") || "Définir l'heure"}</div>}
                    </div>
                    <Badge className={statusColor(a.status)}>{t(`admin.status${a.status[0].toUpperCase() + a.status.slice(1)}`)}</Badge>
                    <div className="flex items-center gap-2 flex-wrap">
                      {needsTime && can("appointments", "edit") && (
                        <Button size="sm" variant="outline" onClick={() => setPostpone({ id: a.id, date: a.appointment_date, time: "09:00" })}>
                          {t("common.time") || "Heure"}
                        </Button>
                      )}
                      {can("appointments", "edit") ? (
                        <Select value={a.status} onValueChange={(v) => onStatus(a.id, v as typeof STATUSES[number])}>
                          <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {STATUSES.map((s) => <SelectItem key={s} value={s}>{t(`admin.status${s[0].toUpperCase() + s.slice(1)}`)}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      ) : null}
                      {!a.is_read && can("appointments", "edit") && <Button size="sm" variant="ghost" onClick={() => markRead({ data: { id: a.id } }).then(() => qc.invalidateQueries({ queryKey: ["appts"] }))}>{t("admin.markRead")}</Button>}
                      {can("appointments", "delete") && <Button size="icon" variant="ghost" onClick={() => { if (confirm("?")) del({ data: { id: a.id } }).then(() => qc.invalidateQueries({ queryKey: ["appts"] })); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>
        ))}
      </Tabs>

      <Dialog open={!!postpone} onOpenChange={(o) => !o && setPostpone(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("admin.statusPostponed")}</DialogTitle></DialogHeader>
          {postpone && (
            <div className="grid gap-3">
              <div className="grid gap-2"><Label>{t("common.date")}</Label><Input type="date" value={postpone.date} onChange={(e) => setPostpone({ ...postpone, date: e.target.value })} /></div>
              <div className="grid gap-2"><Label>{t("common.time")}</Label><Input type="time" value={postpone.time} onChange={(e) => setPostpone({ ...postpone, time: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter><Button onClick={submitPostpone}>{t("common.confirm")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
