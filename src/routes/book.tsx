import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listServices, book, loginByCode, listPublic, bookOffer } from "@/lib/booking.functions";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Logo } from "@/components/Logo";
import { LangSwitcher } from "@/components/LangSwitcher";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Check, Clock, Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { InstallPWA } from "@/components/InstallPWA";

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

  const [clientInfo, setClientInfo] = useState<{ id?: string; fullName?: string; age?: number; phone?: string } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Per-service chosen date
  const [dates, setDates] = useState<Record<string, string>>({});
  const [confirmation, setConfirmation] = useState<{ code: string | null; isNew: boolean; appointments: { serviceName: string; time: string; date: string }[]; clientId: string } | null>(null);
  const [offerModal, setOfferModal] = useState<{ offerId: string; title: string; date: string } | null>(null);

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
  const fetchPublic = useServerFn(listPublic);
  const pubQuery = useQuery({ queryKey: ["public-feed"], queryFn: () => fetchPublic() });
  const offers = pubQuery.data?.offers ?? [];
  const gallery = pubQuery.data?.gallery ?? [];

  // Generate next 21 days, then filter per service by available_days
  const next21 = useMemo(() => {
    const arr: { value: string; dow: number; dayLabel: string }[] = [];
    for (let i = 0; i < 21; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const dow = d.getDay();
      arr.push({
        value: d.toISOString().slice(0, 10),
        dow,
        dayLabel: `${isAr ? DAYS_AR[dow] : DAYS_FR[dow]} ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`,
      });
    }
    return arr;
  }, [isAr]);

  const toggle = (id: string) => {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
    setDates((d) => {
      const n = { ...d };
      if (n[id]) delete n[id];
      return n;
    });
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (selected.size === 0) throw new Error(t("client.pickAtLeastOne"));
      const bookings = Array.from(selected).map((sid) => ({ serviceId: sid, date: dates[sid] }));
      const missing = bookings.find((b) => !b.date);
      if (missing) throw new Error(t("client.pickDateForEach"));
      const payload = clientInfo?.id
        ? { clientId: clientInfo.id, bookings: bookings as { serviceId: string; date: string }[] }
        : { fullName: clientInfo!.fullName!, age: clientInfo!.age, phone: clientInfo!.phone!, bookings: bookings as { serviceId: string; date: string }[] };
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

        {gallery.length > 0 && <GalleryCarousel images={gallery.map((g) => ({ url: g.image_url, caption: g.caption }))} />}

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

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {services.map((s) => {
            const isSel = selected.has(s.id);
            const availDays = (s.available_days as number[]) ?? [0, 1, 2, 3, 4, 5, 6];
            const daysLabels = availDays.map((d) => (isAr ? DAYS_AR[d] : DAYS_FR[d])).join(" · ");
            return (
              <div key={s.id} className={`rounded-2xl border p-4 transition shadow-sm ${isSel ? "border-primary bg-primary/5 ring-2 ring-primary/30" : "border-border bg-card"}`}>
                <button onClick={() => toggle(s.id)} className="w-full text-start">
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
                  </div>
                </button>

                {isSel && (
                  <div className="mt-4 border-t pt-3">
                    <div className="text-xs font-medium text-muted-foreground mb-2">{t("client.chooseDate")}</div>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {next21.filter((d) => availDays.includes(d.dow)).slice(0, 14).map((d) => {
                        const sel = dates[s.id] === d.value;
                        return (
                          <button
                            key={d.value}
                            onClick={() => setDates((prev) => ({ ...prev, [s.id]: d.value }))}
                            className={`shrink-0 rounded-xl border px-3 py-2 text-xs ${sel ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-secondary/40"}`}
                          >
                            {d.dayLabel}
                          </button>
                        );
                      })}
                      {next21.filter((d) => availDays.includes(d.dow)).length === 0 && (
                        <div className="text-xs text-muted-foreground">—</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {services.length === 0 && !svcQuery.isLoading && <div className="col-span-2 rounded-xl border-2 border-dashed p-6 text-center text-muted-foreground">—</div>}
        </div>

        <div className="sticky bottom-4 mt-8">
          <Button disabled={selected.size === 0 || mutation.isPending} onClick={() => mutation.mutate()} size="lg" className="h-14 w-full rounded-2xl text-base shadow-soft">
            {mutation.isPending ? t("common.loading") : `${t("client.selectAll")} (${selected.size})`}
          </Button>
        </div>

      </main>

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
                    : { offerId: offerModal.offerId, date: offerModal.date, fullName: clientInfo!.fullName!, age: clientInfo!.age, phone: clientInfo!.phone! };
                  const res = await bookOfferFn({ data: payload });
                  if (res.code) localStorage.setItem("nassib_code", res.code);
                  localStorage.setItem("nassib_client", JSON.stringify({ id: res.clientId, fullName: clientInfo?.fullName ?? "" }));
                  setOfferModal(null);
                  setConfirmation({ code: res.code, isNew: res.isNew, clientId: res.clientId, appointments: [{ serviceName: res.offerTitle, time: "—", date: res.date }] });
                } catch (e) { toast.error((e as Error).message); }
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

function GalleryCarousel({ images }: { images: { url: string; caption?: string | null }[] }) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, align: "center" }, [Autoplay({ delay: 5000, stopOnInteraction: false, stopOnMouseEnter: true })]);
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (!emblaApi) return;
    const onSel = () => setIdx(emblaApi.selectedScrollSnap());
    emblaApi.on("select", onSel);
    onSel();
    return () => { emblaApi.off("select", onSel); };
  }, [emblaApi]);
  return (
    <div className="relative mb-4 overflow-hidden rounded-2xl border border-border/60 bg-card/50 shadow-soft">
      <div ref={emblaRef} className="overflow-hidden">
        <div className="flex">
          {images.map((g, i) => (
            <div key={i} className="min-w-0 shrink-0 grow-0 basis-full">
              <img src={g.url} alt={g.caption ?? ""} className="h-56 sm:h-72 w-full object-cover" draggable={false} />
            </div>
          ))}
        </div>
      </div>
      {images.length > 1 && (
        <>
          <button type="button" aria-label="prev" onClick={() => emblaApi?.scrollPrev()} className="absolute start-2 top-1/2 -translate-y-1/2 grid h-9 w-9 place-items-center rounded-full bg-background/80 backdrop-blur hover:bg-background shadow-soft">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button type="button" aria-label="next" onClick={() => emblaApi?.scrollNext()} className="absolute end-2 top-1/2 -translate-y-1/2 grid h-9 w-9 place-items-center rounded-full bg-background/80 backdrop-blur hover:bg-background shadow-soft">
            <ChevronRight className="h-5 w-5" />
          </button>
          <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1.5">
            {images.map((_, i) => (
              <button key={i} aria-label={`go to ${i + 1}`} onClick={() => emblaApi?.scrollTo(i)} className={`h-1.5 rounded-full transition-all ${i === idx ? "w-6 bg-primary" : "w-1.5 bg-background/70"}`} />
            ))}
          </div>
        </>
      )}
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
      <div className="flex items-center gap-2">
        <InstallPWA variant="client" />
        <LangSwitcher />
      </div>
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
