import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { clientDashboard, listPublic } from "@/lib/booking.functions";
import { Logo } from "@/components/Logo";
import { LangSwitcher } from "@/components/LangSwitcher";
import { InstallPWA } from "@/components/InstallPWA";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarPlus, LogOut } from "lucide-react";
import { motion } from "framer-motion";

export const Route = createFileRoute("/me")({ component: MePage });

function MePage() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const navigate = useNavigate();
  const dashFn = useServerFn(clientDashboard);
  const pubFn = useServerFn(listPublic);
  const [clientId, setClientId] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("nassib_client");
    if (!saved) { navigate({ to: "/" }); return; }
    try { setClientId((JSON.parse(saved) as { id: string }).id); } catch { navigate({ to: "/" }); }
  }, [navigate]);

  const dash = useQuery({ enabled: !!clientId, queryKey: ["dash", clientId], queryFn: () => dashFn({ data: { clientId: clientId! } }) });
  const pub = useQuery({ queryKey: ["public-feed"], queryFn: () => pubFn() });

  if (!dash.data) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">{t("common.loading")}</div>;
  const { client, upcoming, past } = dash.data;
  const offer = pub.data?.offers?.[0];

  return (
    <div className="min-h-screen bg-rose-gradient">
      <header className={`mx-auto flex max-w-5xl items-center justify-between px-4 py-4 ${isAr ? "flex-row-reverse" : ""}`}>
        <div className={`flex items-center gap-3 ${isAr ? "flex-row-reverse" : ""}`}>
          <Logo size={48} />
          <div className={isAr ? "text-right" : "text-left"}>
            <div className="font-display text-lg text-primary">{client.full_name}</div>
            <div className="text-[10px] text-muted-foreground font-mono tracking-widest">{client.code}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <InstallPWA variant="client" />
          <LangSwitcher />
          <Button variant="ghost" size="sm" onClick={() => { localStorage.clear(); navigate({ to: "/" }); }}><LogOut className="h-4 w-4" /></Button>
        </div>
      </header>

      {/* Gallery marquee */}
      {pub.data?.gallery && pub.data.gallery.length > 0 && (
        <div className="overflow-hidden border-y border-border/60 bg-card/50">
          <div className="marquee-track flex gap-3 py-3 w-fit">
            {[...pub.data.gallery, ...pub.data.gallery].map((g, i) => (
              <img key={i} src={g.image_url} alt={g.caption ?? ""} className="h-24 w-36 rounded-xl object-cover" />
            ))}
          </div>
        </div>
      )}

      <main className="mx-auto max-w-3xl px-4 py-6 grid gap-6">
        {Number(client.debt) > 0 && (
          <Card className="border-destructive/40 bg-destructive/5">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <div className="text-xs text-destructive">{t("client.debt")}</div>
                <div className="font-display text-2xl font-bold text-destructive">{Number(client.debt).toLocaleString()} {t("common.currency")}</div>
              </div>
            </CardContent>
          </Card>
        )}

        {offer && <OfferBanner offer={offer} />}

        <Button onClick={() => navigate({ to: "/book" })} size="lg" className="h-14 rounded-2xl text-base shadow-soft">
          <CalendarPlus className="h-5 w-5 me-2" />{t("client.book")}
        </Button>

        <section>
          <h2 className="font-display text-xl text-primary mb-3">{t("client.upcoming")}</h2>
          <div className="grid gap-2">
            {upcoming.length === 0 && <div className="rounded-xl border-2 border-dashed p-4 text-center text-muted-foreground text-sm">—</div>}
            {upcoming.map((a) => (
              <Card key={a.id}>
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <div className="font-semibold">{(a as { services?: { name?: string } }).services?.name}</div>
                    <div className="text-xs text-muted-foreground">{a.appointment_date} · {String(a.appointment_time).slice(0, 5)}</div>
                  </div>
                  <Badge variant="outline">{t(`admin.status${a.status[0].toUpperCase() + a.status.slice(1)}`)}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section>
          <h2 className="font-display text-xl text-primary mb-3">{t("client.past")}</h2>
          <div className="grid gap-2">
            {past.length === 0 && <div className="rounded-xl border-2 border-dashed p-4 text-center text-muted-foreground text-sm">—</div>}
            {past.slice(0, 10).map((a) => (
              <Card key={a.id}>
                <CardContent className="flex items-center justify-between p-3 text-sm">
                  <span>{(a as { services?: { name?: string } }).services?.name}</span>
                  <span className="text-muted-foreground">{a.appointment_date}</span>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

function OfferBanner({ offer }: { offer: { title: string; image_url: string | null; original_price: number | null; offer_price: number; ends_at: string; description: string | null } }) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(true);
  const [countdown, setCountdown] = useState("");

  useEffect(() => {
    const tick = () => {
      const ms = new Date(offer.ends_at).getTime() - Date.now();
      if (ms <= 0) { setCountdown("—"); return; }
      const d = Math.floor(ms / 86400000);
      const h = Math.floor((ms / 3600000) % 24);
      const m = Math.floor((ms / 60000) % 60);
      const s = Math.floor((ms / 1000) % 60);
      setCountdown(`${d}${t("client.days")} ${h}${t("client.hours")} ${m}${t("client.mins")} ${s}${t("client.secs")}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    const blink = setInterval(() => setVisible((v) => !v), 5500);
    return () => { clearInterval(id); clearInterval(blink); };
  }, [offer.ends_at, t]);

  return (
    <motion.div animate={{ opacity: visible ? 1 : 0.15, scale: visible ? 1 : 0.98 }} transition={{ duration: 0.6 }}>
      <div className="offer-banner rounded-2xl p-5">
        <div className="flex items-center gap-4">
          {offer.image_url && <img src={offer.image_url} alt="" className="h-16 w-16 rounded-xl object-cover" />}
          <div className="flex-1">
            <div className="font-display text-xl font-bold">{offer.title}</div>
            {offer.description && <div className="text-xs opacity-80">{offer.description}</div>}
          </div>
          <div className="text-end">
            {offer.original_price && <div className="text-xs line-through opacity-60">{Number(offer.original_price).toLocaleString()}</div>}
            <div className="text-2xl font-bold text-destructive">{Number(offer.offer_price).toLocaleString()} {t("common.currency")}</div>
          </div>
        </div>
        <div className="mt-3 text-xs">{t("client.countdownEnds")}: <span className="font-mono font-bold">{countdown}</span></div>
      </div>
    </motion.div>
  );
}

void Link;
