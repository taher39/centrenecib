import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { 
  adminAppointments, setAppointmentStatus, markAppointmentRead, deleteAppointment,
  adminListClients, adminListServices, adminCreateAppointment, adminCreateClient,
  adminListPresentToday
} from "@/lib/admin.functions";
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
import { Trash2, Bell, Plus, Calendar as CalendarIcon, User, Search, UserCheck } from "lucide-react";
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
    new: items.filter((a) => a.status === "pending"),
    today: items.filter((a) => a.appointment_date === today),
    tomorrow: items.filter((a) => a.appointment_date === tmw),
    week: items.filter((a) => a.appointment_date >= today && a.appointment_date <= weekEnd),
    all: items,
    confirmed: items.filter((a) => a.status === "confirmed"),
    completed: items.filter((a) => a.status === "completed"),
    cancelled: items.filter((a) => a.status === "cancelled"),
    postponed: items.filter((a) => a.status === "postponed"),
  }), [items, today, tmw, weekEnd]);

  const newCount = items.filter((a) => !a.is_read && a.status === "pending").length;

  const [postpone, setPostpone] = useState<{ id: string; date: string; time: string; status?: typeof STATUSES[number] } | null>(null);
  const [manual, setManual] = useState(false);
  const [createClientOpen, setCreateClientOpen] = useState(false);
  const [presentOpen, setPresentOpen] = useState(false);

  const presentFn = useServerFn(adminListPresentToday);
  const presentQ = useQuery({ queryKey: ["present-today"], queryFn: () => presentFn(), enabled: presentOpen });

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
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-2xl text-primary">{t("nav.appointments")}</h1>
          {newCount > 0 && <Badge className="bg-destructive text-destructive-foreground"><Bell className="h-3 w-3 me-1" />{newCount} {t("admin.newRequests")}</Badge>}
        </div>
        {can("appointments", "edit") && (
          <Button onClick={() => setManual(true)}>
            <Plus className="h-4 w-4 me-1" />
            {t("admin.createAppointment")}
          </Button>
        )}
        {can("clients", "edit") && (
          <Button variant="outline" onClick={() => setCreateClientOpen(true)}>
            <User className="h-4 w-4 me-1" />
            {t("admin.createClient")}
          </Button>
        )}
        <Button variant="secondary" onClick={() => setPresentOpen(true)}>
          <UserCheck className="h-4 w-4 me-1" />
          {t("admin.presentToday") || "الحضور"}
        </Button>
      </div>

      <Tabs defaultValue="new">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="new">{t("admin.newRequests")} ({filtered.new.length})</TabsTrigger>
          <TabsTrigger value="today">{t("common.today")} ({filtered.today.length})</TabsTrigger>
          <TabsTrigger value="tomorrow">{t("common.tomorrow")} ({filtered.tomorrow.length})</TabsTrigger>
          <TabsTrigger value="week">7j ({filtered.week.length})</TabsTrigger>
          <TabsTrigger value="confirmed">{t("admin.statusConfirmed")} ({filtered.confirmed.length})</TabsTrigger>
          <TabsTrigger value="completed">{t("admin.statusCompleted")} ({filtered.completed.length})</TabsTrigger>
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
                        <Button size="sm" variant="outline" onClick={() => setPostpone({ id: a.id, date: a.appointment_date, time: "09:00", status: "confirmed" })}>
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

      <ManualBookingDialog open={manual} onOpenChange={setManual} />

      <Dialog open={presentOpen} onOpenChange={setPresentOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-primary" />
              {t("admin.presentToday") || "الحضور"} — {new Date().toLocaleDateString()}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-2">
            {(presentQ.data?.items ?? []).length === 0 && (
              <div className="rounded-xl border-2 border-dashed p-8 text-center text-muted-foreground">
                {t("admin.noAppointments") || "لا يوجد حضور"}
              </div>
            )}
            {(presentQ.data?.items ?? []).map((a) => {
              const client = (a as any).clients as { full_name?: string; phone?: string; code?: string } | null;
              const svc = (a as any).services as { name?: string; price_dzd?: number } | null;
              return (
                <Card key={a.id} className="border-primary/20">
                  <CardContent className="p-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <UserCheck className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="font-semibold">{client?.full_name}</div>
                        <div className="text-xs text-muted-foreground">{client?.phone} · {client?.code}</div>
                        <div className="text-sm mt-1 flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-medium">{svc?.name ?? "—"}</span>
                          <span className="text-xs text-primary">
                            {Number(svc?.price_dzd ?? 0).toLocaleString()} {t("common.currency")}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {a.appointment_time ? String(a.appointment_time).slice(0, 5) : "—"}
                        </div>
                      </div>
                    </div>
                    <Badge className="bg-primary/15 text-primary text-xs">{t("admin.markPresent")}</Badge>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ManualBookingDialog({ open, onOpenChange }: { open: boolean, onOpenChange: (o: boolean) => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const listClients = useServerFn(adminListClients);
  const listServices = useServerFn(adminListServices);
  const createFn = useServerFn(adminCreateAppointment);

  const clientsQ = useQuery({ queryKey: ["clients"], queryFn: () => listClients(), enabled: open });
  const servicesQ = useQuery({ queryKey: ["svc"], queryFn: () => listServices(), enabled: open });

  const [search, setSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState("09:00");
  const [busy, setBusy] = useState(false);

  const filteredClients = useMemo(() => {
    const items = clientsQ.data?.items ?? [];
    if (!search) return [];
    const s = search.toLowerCase();
    return items.filter(c => c.full_name.toLowerCase().includes(s) || c.phone.includes(s) || c.code.toLowerCase().includes(s)).slice(0, 5);
  }, [clientsQ.data?.items, search]);

  const onConfirm = async () => {
    if (!selectedClient || !selectedService) return;
    setBusy(true);
    try {
      await createFn({ data: { clientId: selectedClient, serviceId: selectedService, date, time } });
      toast.success("✓");
      onOpenChange(false);
      qc.invalidateQueries({ queryKey: ["appts"] });
      setSelectedClient(null);
      setSelectedService(null);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{t("admin.createAppointment")}</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>{t("admin.searchClient")}</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Nom, Tel, Code..." 
                value={search} 
                onChange={(e) => setSearch(e.target.value)} 
                className="pl-9"
              />
            </div>
            {filteredClients.length > 0 && (
              <div className="mt-1 rounded-md border bg-popover text-popover-foreground shadow-md p-1">
                {filteredClients.map(c => (
                  <button 
                    key={c.id} 
                    onClick={() => { setSelectedClient(c.id); setSearch(c.full_name); }}
                    className={`w-full text-start px-2 py-1.5 text-sm rounded-sm hover:bg-accent ${selectedClient === c.id ? "bg-accent" : ""}`}
                  >
                    {c.full_name} <span className="text-xs text-muted-foreground">({c.code})</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-2">
            <Label>{t("nav.services")}</Label>
            <Select value={selectedService ?? ""} onValueChange={setSelectedService}>
              <SelectTrigger><SelectValue placeholder={t("admin.chooseSessions")} /></SelectTrigger>
              <SelectContent>
                {(servicesQ.data?.items ?? []).filter(s => s.active !== false).map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name} ({Number(s.price_dzd).toLocaleString()} dج)</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>{t("common.date")}</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>{t("common.time")}</Label>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
          <Button onClick={onConfirm} disabled={!selectedClient || !selectedService || busy}>
            {busy ? t("common.loading") : t("common.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
