import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listServices, book, loginByCode } from "@/lib/booking.functions";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Logo } from "@/components/Logo";
import { LangSwitcher } from "@/components/LangSwitcher";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Check, Clock, Calendar as CalendarIcon } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

export const Route = createFileRoute("/book")({ component: BookPage });

const DAYS_FR = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const DAYS_AR = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

function BookPage() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const navigate = useNavigate();
  const fetchServices = useServerFn(listServices);
  const bookFn = useServerFn(book);
  const codeLoginFn = useServerFn(loginByCode);

  const [clientInfo, setClientInfo] = useState<{ id?: string; fullName?: string; age?: number; phone?: string } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [date, setDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [confirmation, setConfirmation] = useState<{ code: string | null; isNew: boolean; appointments: { serviceName: string; time: string; date: string }[]; clientId: string } | null>(null);

  // Restore client from localStorage
  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("nassib_client") : null;
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as { id: string; fullName: string };
        setClientInfo({ id: parsed.id, fullName: parsed.fullName });
      } catch { /* noop */ }
    } else {
      const code = typeof window !== "undefined" ? localStorage.getItem("nassib_code") : null;
      if (code) {
        codeLoginFn({ data: { code } }).then((r) => {
          if (r.client) {
            setClientInfo({ id: r.client.id, fullName: r.client.full_name, age: r.client.age ?? undefined, phone: r.client.phone });
            localStorage.setItem("nassib_client", JSON.stringify({ id: r.client.id, fullName: r.client.full_name }));
          }
        }).catch(() => undefined);
      }
    }
  }, [codeLoginFn]);

  const svcQuery = useQuery({ queryKey: ["services-public"], queryFn: () => fetchServices() });
  const services = svcQuery.data?.services ?? [];

  const dateOptions = useMemo(() => {
    const opts: { value: string; label: string; dow: number }[] = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const dow = d.getDay();
      opts.push({
        value: d.toISOString().slice(0, 10),
        label: `${isAr ? DAYS_AR[dow] : DAYS_FR[dow]} ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`,
        dow,
      });
    }
    return opts;
  }, [isAr]);

  const toggle = (id: string) => {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (selected.size === 0) throw new Error(t("client.pickAtLeastOne"));
      const payload = clientInfo?.id
        ? { clientId: clientInfo.id, date, serviceIds: Array.from(selected) }
        : { fullName: clientInfo!.fullName!, age: clientInfo!.age, phone: clientInfo!.phone!, date, serviceIds: Array.from(selected) };
      return bookFn({ data: payload });
    },
    onSuccess: (res) => {
      if (res.code) localStorage.setItem("nassib_code", res.code);
      localStorage.setItem("nassib_client", JSON.stringify({ id: res.clientId, fullName: clientInfo?.fullName ?? "" }));
      setConfirmation({ code: res.code, isNew: res.isNew, appointments: res.appointments, clientId: res.clientId });
    },
    onError: (e: Error) => toast.error(e.message ?? t("client.bookingError")),
  });

  if (!clientInfo) {
    return (
      <div className="min-h-screen bg-rose-gradient">
        <NewClientHeader />
        <main className="mx-auto max-w-md px-4 py-8">
          <Card className="rounded-2xl shadow-soft">
            <CardContent className="grid gap-4 p-6">
              <h2 className="font-display text-2xl text-primary">{t("client.newClient")}</h2>
              <NewClientForm onSubmit={(info) => setClientInfo(info)} />
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  if (confirmation) {
    return (
      <div className="min-h-screen bg-rose-gradient">
        <NewClientHeader />
        <main className="mx-auto max-w-md px-4 py-8">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="rounded-2xl bg-card p-8 shadow-soft text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/15">
              <Check className="h-8 w-8 text-primary" />
            </div>
            <h2 className="font-display text-2xl text-primary">{t("client.confirmed")}</h2>
            <div className="mt-6 grid gap-3 text-start">
              {confirmation.appointments.map((a, i) => (
                <div key={i} className="rounded-xl border bg-secondary/40 p-3">
                  <div className="font-semibold text-foreground">{a.serviceName}</div>
                  <div className="text-sm text-muted-foreground"><CalendarIcon className="inline h-3 w-3 me-1" /> {a.date} · <Clock className="inline h-3 w-3 ms-2 me-1" /> {a.time}</div>
                </div>
              ))}
            </div>
            {confirmation.code && (
              <div className="mt-6 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 p-4">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">{t("client.yourCode")}</div>
                <div className="mt-1 font-mono text-2xl font-bold tracking-[0.3em] text-primary">{confirmation.code}</div>
                <div className="mt-2 text-xs text-muted-foreground">{t("client.saveCode")}</div>
              </div>
            )}
            <div className="mt-6 grid gap-2">
              <Button onClick={() => navigate({ to: "/me" })} className="h-12 rounded-xl">{t("client.yourAppointments")}</Button>
              <Button variant="outline" onClick={() => { setConfirmation(null); setSelected(new Set()); }}>{t("common.back")}</Button>
            </div>
          </motion.div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-rose-gradient">
      <NewClientHeader />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <div className="mb-2 text-sm text-muted-foreground">{t("client.welcome")}, <span className="font-semibold text-primary">{clientInfo.fullName}</span></div>
        <h2 className="font-display text-2xl text-primary">{t("client.chooseServices")}</h2>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {services.map((s) => {
            const isSel = selected.has(s.id);
            return (
              <button key={s.id} onClick={() => toggle(s.id)} className={`text-start rounded-2xl border p-4 transition shadow-sm ${isSel ? "border-primary bg-primary/5 ring-2 ring-primary/30" : "border-border bg-card hover:bg-secondary/40"}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold text-foreground">{s.name}</div>
                    {s.description && <div className="text-xs text-muted-foreground mt-1">{s.description}</div>}
                  </div>
                  {isSel && <Check className="h-5 w-5 text-primary shrink-0" />}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <Badge variant="secondary"><Clock className="h-3 w-3 me-1" />{s.duration_min} {t("common.minutes")}</Badge>
                  <Badge className="bg-destructive text-destructive-foreground hover:bg-destructive">{Number(s.price_dzd).toLocaleString()} {t("common.currency")}</Badge>
                </div>
              </button>
            );
          })}
          {services.length === 0 && !svcQuery.isLoading && <div className="col-span-2 rounded-xl border-2 border-dashed p-6 text-center text-muted-foreground">—</div>}
        </div>

        <h2 className="font-display text-xl text-primary mt-8">{t("client.chooseDate")}</h2>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
          {dateOptions.map((d) => (
            <button key={d.value} onClick={() => setDate(d.value)} className={`shrink-0 rounded-xl border px-4 py-2 text-sm ${date === d.value ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}>
              {d.label}
            </button>
          ))}
        </div>

        <div className="sticky bottom-4 mt-8">
          <Button disabled={selected.size === 0 || mutation.isPending} onClick={() => mutation.mutate()} size="lg" className="h-14 w-full rounded-2xl text-base shadow-soft">
            {mutation.isPending ? t("common.loading") : `${t("client.selectAll")} (${selected.size})`}
          </Button>
        </div>
      </main>
    </div>
  );
}

function NewClientHeader() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === "ar";
  return (
    <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
      <div className={`flex items-center gap-3 ${isRtl ? "flex-row-reverse" : ""}`}>
        <Logo size={48} />
        <div className={isRtl ? "text-right" : "text-left"}>
          <div className="font-display text-lg text-primary">{t("brand.name")}</div>
          <div className="text-[10px] text-muted-foreground">{t("brand.exclusive")}</div>
        </div>
      </div>
      <LangSwitcher />
    </header>
  );
}

function NewClientForm({ onSubmit }: { onSubmit: (i: { fullName: string; age: number; phone: string }) => void }) {
  const { t } = useTranslation();
  const [fullName, setFullName] = useState("");
  const [age, setAge] = useState("");
  const [phone, setPhone] = useState("");
  return (
    <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); if (!fullName || !phone || !age) return; onSubmit({ fullName, age: Number(age), phone }); }}>
      <div className="grid gap-2"><Label>{t("common.name")}</Label><Input value={fullName} onChange={(e) => setFullName(e.target.value)} required minLength={2} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-2"><Label>{t("common.age")}</Label><Input type="number" min={10} max={99} value={age} onChange={(e) => setAge(e.target.value)} required /></div>
        <div className="grid gap-2"><Label>{t("common.phone")}</Label><Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required /></div>
      </div>
      <Button type="submit" className="h-11 rounded-xl">{t("client.book")}</Button>
    </form>
  );
}

// Avoid unused import warning when devtools strip them
void AnimatePresence;
