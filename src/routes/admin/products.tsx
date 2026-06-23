import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminListProducts, saveProduct, deleteProduct, uploadAdminImage } from "@/lib/admin.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Edit, Package, ImagePlus, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { usePerms } from "@/hooks/use-perms";

export const Route = createFileRoute("/admin/products")({ component: AdminProductsPage });

type Product = {
  id?: string;
  name: string;
  price: number;
  stock: number | null;
  image_url: string | null;
  active?: boolean;
};

function AdminProductsPage() {
  const { t } = useTranslation();
  const { can } = usePerms();
  const qc = useQueryClient();
  const listFn = useServerFn(adminListProducts);
  const saveFn = useServerFn(saveProduct);
  const delFn = useServerFn(deleteProduct);
  const uploadFn = useServerFn(uploadAdminImage);

  const products = useQuery({ queryKey: ["products"], queryFn: () => listFn() });
  const [edit, setEdit] = useState<Product | null>(null);
  const [uploading, setUploading] = useState(false);

  const onSave = async () => {
    if (!edit) return;
    try {
      await saveFn({
        data: {
          id: edit.id,
          name: edit.name,
          price: Number(edit.price),
          stock: edit.stock !== null ? Number(edit.stock) : null,
          image_url: edit.image_url,
          active: edit.active ?? true,
        },
      });
      setEdit(null);
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.success("✓");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !edit) return;
    setUploading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(file);
      });
      const res = await uploadFn({ data: { bucket: "products", fileName: file.name, mimeType: file.type, dataUrl } });
      setEdit({ ...edit, image_url: res.url });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl text-primary">{t("nav.products")}</h1>
        {can("products", "edit") && (
          <Button onClick={() => setEdit({ name: "", price: 0, stock: 0, image_url: null, active: true })}>
            <Plus className="h-4 w-4 me-1" />
            {t("admin.addProduct")}
          </Button>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {(products.data?.items ?? []).map((p) => (
          <Card key={p.id}>
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {p.image_url ? (
                  <img src={p.image_url} alt={p.name} className="h-12 w-12 rounded-lg object-cover" />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Package className="h-5 w-5" />
                  </div>
                )}
                <div>
                  <div className="font-semibold">{p.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {Number(p.price).toLocaleString()} {t("common.currency")}
                    {p.stock !== null ? ` · Stock: ${p.stock}` : ""}
                  </div>
                </div>
              </div>
              <div className="flex gap-1">
                {can("products", "edit") && (
                  <Button size="icon" variant="ghost" onClick={() => setEdit({ ...p, image_url: (p as unknown as { image_url?: string | null }).image_url ?? null } as Product)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                )}
                {can("products", "delete") && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      if (confirm("?")) delFn({ data: { id: p.id } }).then(() => qc.invalidateQueries({ queryKey: ["products"] }));
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{edit?.id ? t("common.edit") : t("admin.addProduct")}</DialogTitle>
          </DialogHeader>
          {edit && (
            <div className="grid gap-3">
              {edit.image_url && (
                <div className="relative mx-auto h-32 w-32 overflow-hidden rounded-xl">
                  <img src={edit.image_url} alt="" className="h-full w-full object-cover" />
                  <button
                    onClick={() => setEdit({ ...edit, image_url: null })}
                    className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/50 text-white"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
              <div className="grid gap-2">
                <Label>{t("admin.productName")}</Label>
                <Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1">
                  <Label>{t("admin.productPrice")}</Label>
                  <Input type="number" value={edit.price} onChange={(e) => setEdit({ ...edit, price: Number(e.target.value) })} />
                </div>
                <div className="grid gap-1">
                  <Label>Stock</Label>
                  <Input type="number" value={edit.stock ?? ""} onChange={(e) => setEdit({ ...edit, stock: e.target.value === "" ? null : Number(e.target.value) })} />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Image</Label>
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border p-3 text-sm text-muted-foreground hover:border-primary/50">
                  <ImagePlus className="h-4 w-4" />
                  {uploading ? "Uploading..." : "Choisir une image"}
                  <input type="file" accept="image/*" className="hidden" onChange={handleImage} disabled={uploading} />
                </label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={edit.active !== false} onCheckedChange={(v) => setEdit({ ...edit, active: v })} />
                <Label>Actif</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={onSave}>{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
