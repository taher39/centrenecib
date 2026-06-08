import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminListOffers, saveOffer, deleteOffer, uploadAdminImage } from "@/lib/admin.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Trash2, Edit, X } from "lucide-react";
import { toast } from "sonner";
import { usePerms } from "@/hooks/use-perms";

export const Route = createFileRoute("/admin/offers")({ component: OffersPage });

type Offer = {
  id?: string; title: string; description?: string | null;
  image_url?: string | null; original_price?: number | null;
  offer_price: number; ends_at: string; active?: boolean;
  available_dates?: string[];
  gender_target?: "male" | "female" | "both";
};

const DAYS_AR = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const DAYS_FR = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

function OffersPage() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const { can } = usePerms();
  const qc = useQueryClient();
  const listFn = useServerFn(adminListOffers);
  const saveFn = useServerFn(saveOffer);
  const delFn = useServerFn(deleteOffer);
  const uploadImageFn = useServerFn(uploadAdminImage);
  const q = useQuery({ queryKey: ["offers"], queryFn: () => listFn() });
  const [edit, setEdit] = useState<Offer | null>(null);
  const [uploading, setUploading] = useState(false);
  const [newDate, setNewDate] = useState("");

  const onSave = async () => {
    if (!edit) return;
    if (!edit.available_dates || edit.available_dates.length === 0) {
      toast.error(isAr ? "اختر يومًا واحدًا على الأقل" : "Choisissez au moins une date");
      return;
    }
    try {
      await saveFn({ data: { ...edit, ends_at: new Date(edit.ends_at).toISOString() } });
      setEdit(null); qc.invalidateQueries({ queryKey: ["offers"] }); toast.success("✓");
    } catch (e) { toast.error((e as Error).message); }
  };

  const addDate = () => {
    if (!newDate || !edit) return;
    const set = new Set([...(edit.available_dates ?? []), newDate]);
    setEdit({ ...edit, available_dates: Array.from(set).sort() });
    setNewDate("");
  };
  const removeDate = (d: string) => {
    if (!edit) return;
    setEdit({ ...edit, available_dates: (edit.available_dates ?? []).filter((x) => x !== d) });
  };

  const upload = async (f: File) => {
    setUploading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ""));
        reader.onerror = () => reject(new Error("تعذر قراءة الصورة"));
        reader.readAsDataURL(f);
      });
      const res = await uploadImageFn({
        data: { bucket: "offers", fileName: f.name, mimeType: f.type || "image/jpeg", dataUrl },
      });
      setEdit((p) => p ? { ...p, image_url: res.url } : p);
      toast.success("✓");
    } catch (e) { toast.error((e as Error).message); } finally { setUploading(false); }
  };

  const fmtDate = (s: string) => {
    const d = new Date(s + "T00:00:00");
    const dow = d.getDay();
    return `${isAr ? DAYS_AR[dow] : DAYS_FR[dow]} ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  };

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl text-primary">{t("nav.offers")}</h1>
        {can("offers", "edit") && <Button onClick={() => setEdit({ title: "", offer_price: 0, ends_at: new Date(Date.now() + 7*86400000).toISOString().slice(0, 16), active: true, available_dates: [] })}><Plus className="h-4 w-4 me-1" />{t("admin.addOffer")}</Button>}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {(q.data?.items ?? []).map((o) => {
          const dates = ((o as { available_dates?: string[] }).available_dates ?? []);
          return (
          <Card key={o.id} className="overflow-hidden">
            {o.image_url && <img src={o.image_url} alt="" className="h-32 w-full object-cover" />}
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold">{o.title}</div>
                  <div className="text-xs text-muted-foreground">{t("admin.offerEnds")}: {new Date(o.ends_at).toLocaleString()}</div>
                  <div className="mt-1 text-destructive font-bold">{Number(o.offer_price).toLocaleString()} {t("common.currency")} {o.original_price && <span className="line-through text-xs text-muted-foreground ms-1">{Number(o.original_price).toLocaleString()}</span>}</div>
                  {dates.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {dates.map((d) => <span key={d} className="text-[10px] rounded-full bg-secondary px-2 py-0.5">{fmtDate(d)}</span>)}
                    </div>
                  )}
                </div>
                <div className="flex gap-1">
                  {can("offers", "edit") && <Button size="icon" variant="ghost" onClick={() => setEdit({ ...o, ends_at: new Date(o.ends_at).toISOString().slice(0, 16), available_dates: dates } as Offer)}><Edit className="h-4 w-4" /></Button>}
                  {can("offers", "delete") && <Button size="icon" variant="ghost" onClick={() => { if (confirm("?")) delFn({ data: { id: o.id } }).then(() => qc.invalidateQueries({ queryKey: ["offers"] })); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                </div>
              </div>
            </CardContent>
          </Card>
        );})}
      </div>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{edit?.id ? t("common.edit") : t("admin.addOffer")}</DialogTitle></DialogHeader>
          {edit && (
            <div className="grid gap-3">
              <div className="grid gap-2"><Label>Titre</Label><Input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></div>
              <div className="grid gap-2"><Label>Description</Label><Textarea value={edit.description ?? ""} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></div>
              <div className="grid gap-2"><Label>Image</Label>
                <Input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} />
                {uploading && <div className="text-xs">…</div>}
                {edit.image_url && <img src={edit.image_url} className="h-24 w-full object-cover rounded" alt="" />}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="grid gap-2"><Label>Prix initial</Label><Input type="number" value={edit.original_price ?? ""} onChange={(e) => setEdit({ ...edit, original_price: e.target.value ? Number(e.target.value) : null })} /></div>
                <div className="grid gap-2"><Label>Prix promo</Label><Input type="number" value={edit.offer_price} onChange={(e) => setEdit({ ...edit, offer_price: Number(e.target.value) })} /></div>
              </div>
              <div className="grid gap-2"><Label>{t("admin.offerEnds")}</Label><Input type="datetime-local" value={edit.ends_at} onChange={(e) => setEdit({ ...edit, ends_at: e.target.value })} /></div>

              <div className="grid gap-2 rounded-lg border p-3">
                <Label>{isAr ? "أيام العرض المتاحة للحجز" : "Dates disponibles pour cette offre"}</Label>
                <p className="text-[11px] text-muted-foreground">{isAr ? "أضف الأيام التي يستطيع الزبون اختيارها لهذا العرض" : "Ajoutez les jours que le client pourra choisir"}</p>
                <div className="flex gap-2">
                  <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
                  <Button type="button" variant="outline" onClick={addDate}><Plus className="h-4 w-4" /></Button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {(edit.available_dates ?? []).map((d) => (
                    <span key={d} className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary text-xs px-2 py-1">
                      {fmtDate(d)}
                      <button type="button" onClick={() => removeDate(d)}><X className="h-3 w-3" /></button>
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid gap-2">
                <Label>{t("admin.genderTarget")}</Label>
                <div className="grid grid-cols-3 gap-2">
                  {(["both","female","male"] as const).map((g) => (
                    <button key={g} type="button" onClick={() => setEdit({ ...edit, gender_target: g })} className={`rounded-lg px-3 py-2 text-xs border ${(edit.gender_target ?? "both") === g ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border"}`}>
                      {g === "both" ? t("admin.genderBoth") : g === "female" ? t("admin.genderFemale") : t("admin.genderMale")}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2"><Switch checked={edit.active !== false} onCheckedChange={(v) => setEdit({ ...edit, active: v })} /><Label>Actif</Label></div>
            </div>
          )}
          <DialogFooter><Button onClick={onSave} disabled={uploading}>{uploading ? "…" : t("common.save")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
