import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listServices, book, loginByCode, listPublic, bookOffer } from "@/lib/booking.functions";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Check, Clock, Calendar as CalendarIcon } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

import { Carousel } from "@/components/Carousel";

export const Route = createFileRoute("/book")({ component: BookPage });

const DAYS_FR = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const DAYS_AR = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

function BookPage() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const navigate = useNavigate();
  const fetchServices = useServerFn(listServices);
  const bookFn = useServerFn(book);
  const bookOfferFn = useServerFn(bookOffer);
  const codeLoginFn = useServerFn(loginByCode);

  const [clientInfo, setClientInfo] = useState<{ id?: string; fullName?: string; age?: number; phone?: string; address?: string; gender?: "male" | "female" } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Per-service chosen dates (multiple)
  const [dates, setDates] = useState<Record<string, string[]>>({});
  const [datePicker, setDatePicker] = useState<{ serviceId: string; name: string; days: number[] } | null>(null);
  const [offerModal, setOfferModal] = useState<{ offerId: string; title: string; date: string } | null>(null);

  // Restore client from localStorage
  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("nassib_client") : null;
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as { id: string; fullName: string };
        const code = typeof window !== "undefined" ? localStorage.getItem("nassib_code") : null;
        if (code) {
          codeLoginFn({ data: { code } }).then((r) => {
            if (r.client) {
              setClientInfo({ id: r.client.id, fullName: r.client.full_name, age: r.client.age ?? undefined, phone: r.client.phone, address: r.client.address ?? undefined, gender: (r.client.gender as "male" | "female" | null) ?? undefined });
              localStorage.setItem("nassib_client", JSON.stringify({ id: r.client.id, fullName: r.client.full_name }));
            } else {
              setClientInfo({ id: parsed.id, fullName: parsed.fullName });
            }
          }).catch(() => setClientInfo({ id: parsed.id, fullName: parsed.fullName }));
        } else {
          setClientInfo({ id: parsed.id, fullName: parsed.fullName });
        }
      } catch { /* noop */ }
    } else {
      const code = typeof window !== "undefined" ? localStorage.getItem("nassib_code") : null;
      if (code) {
        codeLoginFn({ data: { code } }).then((r) => {
          if (r.client) {
            setClientInfo({ id: r.client.id, fullName: r.client.full_name, age: r.client.age ?? undefined, phone: r.client.phone, address: r.client.address ?? undefined, gender: (r.client.gender as "male" | "female" | null) ?? undefined });
            localStorage.setItem("nassib_client", JSON.stringify({ id: r.client.id, fullName: r.client.full_name }));
          }
        }).catch(() => undefined);
      }
    }
  }, [codeLoginFn]);

  const svcQuery = useQuery({ queryKey: ["services-public"], queryFn: () => fetchServices() });
  const services = svcQuery.data?.services ?? [];
  const fetchPublic = useServerFn(listPublic);
  const pubQuery = useQuery({ queryKey: ["public-feed"], queryFn: () => fetchPublic() });
  const offers = pubQuery.data?.offers ?? [];
  const gallery = pubQuery.data?.gallery ?? [];

  // Generate next 21 days, then filter per service by available_days
  const next21 = useMemo(() => {
    const arr: { value: string; dow: number; dayLabel: string; dayLabelShort: string; fullDate: string }[] = [];
    for (let i = 0; i < 21; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const dow = d.getDay();
      const dayNum = String(d.getDate()).padStart(2, "0");
      const monthNum = String(d.getMonth() + 1).padStart(2, "0");
      arr.push({
        value: d.toISOString().slice(0, 10),
        dow,
        dayLabel: `${isAr ? DAYS_AR[dow] : DAYS_FR[dow]} ${dayNum}/${monthNum}`,
        dayLabelShort: `${isAr ? DAYS_AR[dow].slice(0, 2) : DAYS_FR[dow].slice(0, 3)}`,
        fullDate: `${dayNum}/${monthNum}`,
      });
    }
    return arr;
  }, [isAr]);

  const toggle = (svc: { id: string; gender_target?: string | null; name: string; description?: string | null; price_dzd?: number | null; duration_min?: number | null; available_days?: number[] | null }) => {
    const gt = svc.gender_target ?? "both";
    if (gt !== "both" && clientInfo?.gender && gt !== clientInfo.gender) {
      toast.error(gt === "female" ? t("client.femaleOnly") : t("client.maleOnly"));
      return;
    }
    // Open glass picker directly (selects service automatically)
    setSelected((s) => { const n = new Set(s); n.add(svc.id); return n; });
    setDatePicker({ serviceId: svc.id, name: svc.name, days: (svc.available_days as number[]) ?? [0,1,2,3,4,5,6] });
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (selected.size === 0) throw new Error(t("client.pickAtLeastOne"));
      const bookings: { serviceId: string; date: string }[] = [];
      for (const sid of Array.from(selected)) {
        const list = dates[sid] ?? [];
        if (list.length === 0) throw new Error(t("client.pickDateForEach"));
        for (const d of list) bookings.push({ serviceId: sid, date: d });
      }
      const payload = clientInfo?.id
        ? { clientId: clientInfo.id, bookings }
        : { fullName: clientInfo!.fullName!, age: clientInfo!.age, phone: clientInfo!.phone!, address: clientInfo!.address!, gender: clientInfo!.gender!, bookings };
      return bookFn({ data: payload });
    },
    onSuccess: (res) => {
      if (res.code) localStorage.setItem("nassib_code", res.code);
      localStorage.setItem("nassib_client", JSON.stringify({ id: res.clientId, fullName: clientInfo?.fullName ?? "" }));
      if (res.code) {
        toast.success(t("client.bookSuccess", { code: res.code }));
      } else {
        toast.success(t("client.confirmed"));
      }
      navigate({ to: "/me" });
    },
    onError: (e: Error) => {
      const m = e.message;
      if (m === "GENDER_FEMALE_ONLY") toast.error(t("client.femaleOnly"));
      else if (m === "GENDER_MALE_ONLY") toast.error(t("client.maleOnly"));
      else toast.error(m || t("client.bookingError"));
    },
  });


  if (!clientInfo) {
    return (
      <div className="client-entry-shell min-h-screen bg-rose-gradient">
        <SiteHeader />
        <main className="mx-auto w-full max-w-lg lg:max-w-2xl px-4 py-8">
          <Card className="rounded-2xl border-white/50 bg-card/82 shadow-soft backdrop-blur-sm">
            <CardContent className="grid gap-4 p-6">
              <h2 className="font-display text-2xl text-primary">{t("client.newClient")}</h2>
              <NewClientForm onSubmit={(info) => setClientInfo(info)} />
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="client-entry-shell min-h-screen bg-rose-gradient">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl px-4 sm:px-6 py-6">
        <div className="mb-4 text-sm text-muted-foreground">{t("client.welcome")}, <span className="font-semibold text-primary">{clientInfo.fullName}</span></div>

        {gallery.length > 0 && <Carousel images={gallery.map((g) => ({ url: g.image_url, caption: g.caption }))} height="h-56 sm:h-72 md:h-80" />}

        {offers.length > 0 && (
          <div className="mt-4 mb-4 grid gap-3">
            {offers.map((o) => (
              <button
                key={o.id}
                onClick={() => setOfferModal({ offerId: o.id, title: o.title, date: "" })}
                className="offer-banner rounded-2xl p-4 text-start transition hover:scale-[1.01] active:scale-[0.99]"
              >
                <div className="flex items-center gap-3">
                  {o.image_url && <img src={o.image_url} alt="" className="h-16 w-16 rounded-xl object-cover" />}
                  <div className="flex-1">
                    <div className="font-display text-lg font-bold">{o.title}</div>
                    {o.description && <div className="text-xs opacity-80">{o.description}</div>}
                    <div className="mt-1 text-[11px] underline opacity-90">{t("client.bookThisOffer") || "احجز هذا العرض"}</div>
                  </div>
                  <div className="text-end">
                    {o.original_price && <div className="text-xs line-through opacity-60">{Number(o.original_price).toLocaleString()}</div>}
                    <div className="text-xl font-bold text-destructive">{Number(o.offer_price).toLocaleString()} {t("common.currency")}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        <h2 className="font-display text-2xl text-primary">{t("client.chooseServices")}</h2>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((s) => {
            const isSel = selected.has(s.id);
            const availDays = (s.available_days as number[]) ?? [0, 1, 2, 3, 4, 5, 6];
            const daysLabels = availDays.map((d) => (isAr ? DAYS_AR[d] : DAYS_FR[d])).join(" · ");
            return (
              <div key={s.id} className={`rounded-2xl border p-4 transition shadow-sm ${isSel ? "border-primary bg-primary/5 ring-2 ring-primary/30" : "border-border bg-card"}`}>
                <button onClick={() => toggle(s)} className="w-full text-start">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold text-foreground">{s.name}</div>
                      {s.description && <div className="text-xs text-muted-foreground mt-1">{s.description}</div>}
                    </div>
                    {isSel && <Check className="h-5 w-5 text-primary shrink-0" />}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Badge variant="secondary"><Clock className="h-3 w-3 me-1" />{s.duration_min} {t("common.minutes")}</Badge>
                    <Badge className="bg-destructive text-destructive-foreground hover:bg-destructive">{Number(s.price_dzd).toLocaleString()} {t("common.currency")}</Badge>
                    <Badge variant="outline" className="text-[10px]"><CalendarIcon className="h-3 w-3 me-1" />{daysLabels}</Badge>
                    {((s as { gender_target?: string }).gender_target ?? "both") !== "both" && (
                      <Badge variant="outline" className="text-[10px]">{(s as { gender_target?: string }).gender_target === "female" ? t("common.female") : t("common.male")}</Badge>
                    )}
                  </div>
                </button>

                {isSel && (
                  <div className="mt-4 border-t pt-3 flex items-center justify-between">
                    <div className="text-xs text-muted-foreground">
                      {(dates[s.id]?.length ?? 0) > 0
                        ? t("client.daysSelected", { n: dates[s.id]!.length })
                        : t("client.chooseDate")}
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setDatePicker({ serviceId: s.id, name: s.name, days: availDays })}>
                      <CalendarIcon className="h-3 w-3 me-1" />{t("client.chooseDate")}
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
          {services.length === 0 && !svcQuery.isLoading && <div className="sm:col-span-2 lg:col-span-3 rounded-xl border-2 border-dashed p-6 text-center text-muted-foreground">—</div>}
        </div>

        <div className="sticky bottom-4 mt-8">
          <Button disabled={selected.size === 0 || mutation.isPending} onClick={() => mutation.mutate()} size="lg" className="h-14 w-full rounded-2xl text-base shadow-soft">
            {mutation.isPending ? t("common.loading") : `${t("client.selectAll")} (${selected.size})`}
          </Button>
        </div>

      </main>

      {/* Glass date picker – full screen on mobile, centered on desktop */}
      <Dialog open={!!datePicker} onOpenChange={(o) => { if (!o) { setDatePicker(null); if (datePicker && (dates[datePicker.serviceId]?.length ?? 0) === 0) { setSelected((s) => { const n = new Set(s); n.delete(datePicker.serviceId); return n; }); } } }}>
        <DialogContent className="glass-panel flex max-h-[90dvh] flex-col border-none p-0 sm:max-w-lg sm:rounded-2xl sm:border sm:p-0">
          <DialogHeader className="px-5 pt-12 pb-1 text-center sm:pt-5">
            <DialogTitle className="font-display text-xl text-primary">{datePicker?.name}</DialogTitle>
            <p className="text-xs text-muted-foreground/70">{t("client.pickDates")}</p>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-5 pb-2">
            {datePicker && (() => {
              const months = isAr
                ? ["جانفي", "فيفري", "مارس", "أفريل", "ماي", "جوان", "جويلية", "أوت", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"]
                : ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
              const available = next21.filter((d) => datePicker.days.includes(d.dow));
              return (
                <div className="grid gap-2 py-2">
                  {available.map((d) => {
                    const dt = new Date(d.value + "T00:00:00");
                    const dow = dt.getDay();
                    const dayName = isAr ? DAYS_AR[dow] : DAYS_FR[dow];
                    const monthName = months[dt.getMonth()];
                    const sel = (dates[datePicker.serviceId] ?? []).includes(d.value);
                    return (
                      <button
                        key={d.value}
                        type="button"
                        onClick={() => setDates((prev) => {
                          const cur = prev[datePicker.serviceId] ?? [];
                          const next = cur.includes(d.value) ? cur.filter((x) => x !== d.value) : [...cur, d.value];
                          return { ...prev, [datePicker.serviceId]: next };
                        })}
                        className={`flex items-center justify-between rounded-xl border px-4 py-3 text-start transition-all active:scale-[0.98] ${
                          sel
                            ? "border-primary bg-primary/10 shadow-sm shadow-primary/20"
                            : "border-white/20 bg-white/5 hover:border-primary/40 hover:bg-white/10"
                        }`}
                      >
                        <div className="text-sm text-foreground">
                          <span className="font-semibold">{dayName}</span> <span>{dt.getDate()}</span> <span className="text-muted-foreground">{monthName} {dt.getFullYear()}</span>
                        </div>
                        <div className={`flex h-6 w-6 items-center justify-center rounded-full border-2 transition ${
                          sel ? "border-primary bg-primary text-primary-foreground" : "border-white/30"
                        }`}>
                          {sel && <Check className="h-3.5 w-3.5" />}
                        </div>
                      </button>
                    );
                  })}
                  {available.length === 0 && <div className="py-10 text-center text-xs text-muted-foreground/50">—</div>}
                </div>
              );
            })()}
          </div>
          <div className="sticky bottom-0 rounded-b-2xl border-t border-white/10 bg-black/5 px-5 py-3 backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{t("client.daysSelected", { n: (datePicker ? dates[datePicker.serviceId]?.length ?? 0 : 0) })}</span>
              <Button size="sm" onClick={() => setDatePicker(null)} className="rounded-xl px-6">{t("common.confirm") || "تأكيد"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>


      <Dialog open={!!offerModal} onOpenChange={(o) => !o && setOfferModal(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{offerModal?.title}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="text-sm text-muted-foreground">{t("client.pickOfferDate") || "اختر اليوم المناسب — سيقوم الإدارة بتحديد الساعة"}</div>
            <div className="flex flex-wrap gap-2 pb-1">
              {(() => {
                const offer = offers.find((o) => o.id === offerModal?.offerId) as { available_dates?: string[] } | undefined;
                const allowed = offer?.available_dates ?? [];
                const todayStr = new Date().toISOString().slice(0, 10);
                const future = allowed.filter((d) => d >= todayStr).sort();
                if (future.length === 0) {
                  return <div className="text-xs text-muted-foreground">{isAr ? "لا توجد أيام متاحة حاليًا لهذا العرض" : "Aucune date disponible"}</div>;
                }
                return future.map((value) => {
                  const d = new Date(value + "T00:00:00");
                  const dow = d.getDay();
                  const label = `${isAr ? DAYS_AR[dow] : DAYS_FR[dow]} ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
                  const sel = offerModal?.date === value;
                  return (
                    <button
                      key={value}
                      onClick={() => setOfferModal((p) => p ? { ...p, date: value } : p)}
                      className={`shrink-0 rounded-xl border px-3 py-2 text-xs ${sel ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-secondary/40"}`}
                    >
                      {label}
                    </button>
                  );
                });
              })()}
            </div>
          </div>
          <DialogFooter>
            <Button
              disabled={!offerModal?.date}
              onClick={async () => {
                if (!offerModal?.date) return;
                try {
                  const payload = clientInfo?.id
                    ? { offerId: offerModal.offerId, date: offerModal.date, clientId: clientInfo.id }
                    : { offerId: offerModal.offerId, date: offerModal.date, fullName: clientInfo!.fullName!, age: clientInfo!.age, phone: clientInfo!.phone!, address: clientInfo!.address!, gender: clientInfo!.gender! };
                  const res = await bookOfferFn({ data: payload });
                  if (res.code) localStorage.setItem("nassib_code", res.code);
                  localStorage.setItem("nassib_client", JSON.stringify({ id: res.clientId, fullName: clientInfo?.fullName ?? "" }));
                  setOfferModal(null);
                  if (res.code) {
                    toast.success(t("client.bookSuccess", { code: res.code }));
                  } else {
                    toast.success(t("client.confirmed"));
                  }
                  navigate({ to: "/me" });
                } catch (e) {
                  const m = (e as Error).message;
                  if (m === "GENDER_FEMALE_ONLY") toast.error(t("client.femaleOnly"));
                  else if (m === "GENDER_MALE_ONLY") toast.error(t("client.maleOnly"));
                  else toast.error(m);
                }
              }}
            >
              {t("client.book")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function NewClientForm({ onSubmit }: { onSubmit: (i: { fullName: string; age: number; phone: string; address: string; gender: "male" | "female" }) => void }) {
  const { t } = useTranslation();
  const [fullName, setFullName] = useState("");
  const [age, setAge] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "">("");
  return (
    <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); if (!fullName || !phone || !age || !address || !gender) return; onSubmit({ fullName, age: Number(age), phone, address, gender }); }}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2"><Label>{t("common.name")}</Label><Input value={fullName} onChange={(e) => setFullName(e.target.value)} required minLength={2} /></div>
        <div className="grid gap-2"><Label>{t("common.address")}</Label><Input value={address} onChange={(e) => setAddress(e.target.value)} required minLength={2} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-2"><Label>{t("common.age")}</Label><Input type="number" min={10} max={99} value={age} onChange={(e) => setAge(e.target.value)} required /></div>
        <div className="grid gap-2"><Label>{t("common.phone")}</Label><Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required /></div>
      </div>
      <div className="grid gap-2">
        <Label>{t("common.gender")}</Label>
        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={() => setGender("male")} className={`h-11 rounded-xl border text-sm transition ${gender === "male" ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-secondary/50"}`}>{t("common.male")}</button>
          <button type="button" onClick={() => setGender("female")} className={`h-11 rounded-xl border text-sm transition ${gender === "female" ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-secondary/50"}`}>{t("common.female")}</button>
        </div>
      </div>
      <Button type="submit" className="h-12 rounded-xl w-full sm:w-auto sm:px-8">{t("client.book")}</Button>
    </form>
  );
}
