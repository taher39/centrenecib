import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminListGallery, addGalleryImage, deleteGalleryImage } from "@/lib/admin.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/gallery")({ component: GalleryPage });

function GalleryPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const listFn = useServerFn(adminListGallery);
  const addFn = useServerFn(addGalleryImage);
  const delFn = useServerFn(deleteGalleryImage);
  const q = useQuery({ queryKey: ["gallery"], queryFn: () => listFn() });
  const [uploading, setUploading] = useState(false);

  const upload = async (f: File) => {
    setUploading(true);
    try {
      const path = `${Date.now()}-${f.name.replace(/[^a-zA-Z0-9.]/g, "_")}`;
      const { error } = await supabase.storage.from("gallery").upload(path, f);
      if (error) throw error;
      const { data } = supabase.storage.from("gallery").getPublicUrl(path);
      await addFn({ data: { image_url: data.publicUrl } });
      qc.invalidateQueries({ queryKey: ["gallery"] });
      toast.success("✓");
    } catch (e) { toast.error((e as Error).message); } finally { setUploading(false); }
  };

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl text-primary">{t("nav.gallery")}</h1>
        <Input type="file" accept="image/*" multiple onChange={async (e) => { for (const f of Array.from(e.target.files ?? [])) await upload(f); e.target.value=""; }} className="max-w-xs" />
      </div>
      {uploading && <div className="text-xs text-muted-foreground">…</div>}
      <div className="grid gap-2 grid-cols-2 md:grid-cols-4">
        {(q.data?.items ?? []).map((g) => (
          <Card key={g.id} className="overflow-hidden group relative">
            <CardContent className="p-0">
              <img src={g.image_url} alt="" className="h-32 w-full object-cover" />
              <Button size="icon" variant="destructive" className="absolute top-1 end-1 h-7 w-7" onClick={() => delFn({ data: { id: g.id } }).then(() => qc.invalidateQueries({ queryKey: ["gallery"] }))}><Trash2 className="h-3 w-3" /></Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
