import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminListProducts, saveProduct, deleteProduct } from "@/lib/admin.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Edit, Package } from "lucide-react";
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
  active?: boolean;
};

function AdminProductsPage() {
  const { t } = useTranslation();
  const { can } = usePerms();
  const qc = useQueryClient();
  const listFn = useServerFn(adminListProducts);
  const saveFn = useServerFn(saveProduct);
  const delFn = useServerFn(deleteProduct);

  const products = useQuery({ queryKey: ["products"], queryFn: () => listFn() });
  const [edit, setEdit] = useState<Product | null>(null);

  const onSave = async () => {
    if (!edit) return;
    try {
      await saveFn({
        data: {
          id: edit.id,
          name: edit.name,
          price: Number(edit.price),
          stock: edit.stock !== null ? Number(edit.stock) : null,
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

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl text-primary">{t("nav.products")}</h1>
        {can("products", "edit") && (
          <Button onClick={() => setEdit({ name: "", price: 0, stock: 0, active: true })}>
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
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Package className="h-5 w-5" />
                </div>
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
                  <Button size="icon" variant="ghost" onClick={() => setEdit(p as Product)}>
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
