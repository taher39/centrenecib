import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminListOffers, saveOffer, deleteOffer } from "@/lib/admin.functions";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Trash2, Edit } from "lucide-react";
import { toast } from "sonner";
import { usePerms } from "@/hooks/use-perms";

export const Route = createFileRoute("/admin/offers")({ component: OffersPage });

type Offer = {
  id?: string; title: string; description?: string | null;
  image_url?: string | null; original_price?: number | null;
  offer_price: number; ends_at: string; active?: boolean;
};

function OffersPage() {
  const { t } = useTranslation();
  const { can } = usePerms();
  const qc = useQueryClient();
  const listFn = useServerFn(adminListOffers);
  const saveFn = useServerFn(saveOffer);
  const delFn = useServerFn(deleteOffer);
  const q = useQuery({ queryKey: ["offers"], queryFn: () => listFn() });
  const [edit, setEdit] = useState<Offer | null>(null);
  const [uploading, setUploading] = useState(false);

  const onSave = async () => {
    if (!edit) return;
    try {
      await saveFn({ data: { ...edit, ends_at: new Date(edit.ends_at).toISOString() } });
      setEdit(null); qc.invalidateQueries({ queryKey: ["offers"] }); toast.success("✓");
    } catch (e) { toast.error((e as Error).message); }
  };

  const upload = async (f: File) => {
    setUploading(true);
    try {
      const path = `${Date.now()}-${f.name.replace(/[^a-zA-Z0-9.]/g, "_")}`;
      const { error } = await supabase.storage.from("offers").upload(path, f);
      if (error) throw error;
      const { data } = supabase.storage.from("offers").getPublicUrl(path);
      setEdit((p) => p ? { ...p, image_url: data.publicUrl } : p);
    } catch (e) { toast.error((e as Error).message); } finally { setUploading(false); }
  };

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl text-primary">{t("nav.offers")}</h1>
        {can("offers", "edit") && <Button onClick={() => setEdit({ title: "", offer_price: 0, ends_at: new Date(Date.now() + 7*86400000).toISOString().slice(0, 16), active: true })}><Plus className="h-4 w-4 me-1" />{t("admin.addOffer")}</Button>}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {(q.data?.items ?? []).map((o) => (
          <Card key={o.id} className="overflow-hidden">
            {o.image_url && <img src={o.image_url} alt="" className="h-32 w-full object-cover" />}
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold">{o.title}</div>
                  <div className="text-xs text-muted-foreground">{t("admin.offerEnds")}: {new Date(o.ends_at).toLocaleString()}</div>
                  <div className="mt-1 text-destructive font-bold">{Number(o.offer_price).toLocaleString()} {t("common.currency")} {o.original_price && <span className="line-through text-xs text-muted-foreground ms-1">{Number(o.original_price).toLocaleString()}</span>}</div>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => setEdit({ ...o, ends_at: new Date(o.ends_at).toISOString().slice(0, 16) } as Offer)}><Edit className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => { if (confirm("?")) delFn({ data: { id: o.id } }).then(() => qc.invalidateQueries({ queryKey: ["offers"] })); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>
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
              <div className="flex items-center gap-2"><Switch checked={edit.active !== false} onCheckedChange={(v) => setEdit({ ...edit, active: v })} /><Label>Actif</Label></div>
            </div>
          )}
          <DialogFooter><Button onClick={onSave}>{t("common.save")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
