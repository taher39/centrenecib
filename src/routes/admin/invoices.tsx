import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminListInvoices, updateInvoice, deleteInvoice, adminListDiscounts, getSettings } from "@/lib/admin.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Trash2, Edit, Printer } from "lucide-react";
import { toast } from "sonner";
import { InvoicePrintView, openPrintWindow } from "@/components/InvoicePrintView";
import { usePerms } from "@/hooks/use-perms";

export const Route = createFileRoute("/admin/invoices")({ component: InvoicesPage });

type Inv = {
  id: string; number: string; client_id: string; subtotal: number; discount: number; total: number;
  amount_paid: number; payment_type: "full" | "partial"; notes: string | null; issued_at: string;
  clients?: { full_name?: string; phone?: string } | null;
  invoice_items?: { id: string; service_name: string; quantity: number; unit_price: number; total: number }[];
};

function InvoicesPage() {
  const { t } = useTranslation();
  const { can } = usePerms();
  const qc = useQueryClient();
  const listFn = useServerFn(adminListInvoices);
  const updateFn = useServerFn(updateInvoice);
  const delFn = useServerFn(deleteInvoice);
  const discFn = useServerFn(adminListDiscounts);
  const settingsFn = useServerFn(getSettings);

  const q = useQuery({ queryKey: ["invoices"], queryFn: () => listFn() });
  const discounts = useQuery({ queryKey: ["discounts"], queryFn: () => discFn() });
  const settings = useQuery({ queryKey: ["settings"], queryFn: () => settingsFn() });

  const [edit, setEdit] = useState<Inv | null>(null);
  const [printInv, setPrintInv] = useState<Inv | null>(null);

  const onSave = async () => {
    if (!edit) return;
    try {
      await updateFn({ data: {
        id: edit.id, discount: Number(edit.discount), amount_paid: Number(edit.amount_paid),
        payment_type: edit.payment_type, notes: edit.notes,
      } });
      setEdit(null); qc.invalidateQueries({ queryKey: ["invoices"] }); toast.success("✓");
    } catch (e) { toast.error((e as Error).message); }
  };

  const discTotal = (discounts.data?.items ?? []).reduce((a, d) => a + Number(d.amount), 0);

  const doPrint = (inv: Inv) => {
    setPrintInv(inv);
    setTimeout(() => openPrintWindow("invoice-print"), 100);
  };

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="font-display text-2xl text-primary">{t("nav.invoices")}</h1>
        <Badge className="bg-gold text-gold-foreground">{t("admin.discountsTotal")}: {discTotal.toLocaleString()} {t("common.currency")}</Badge>
      </div>
      <div className="grid gap-2">
        {(q.data?.items ?? []).map((i) => {
          const inv = i as Inv;
          const rem = Number(inv.total) - Number(inv.amount_paid);
          return (
            <Card key={inv.id}>
              <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="font-semibold font-mono">{inv.number}</div>
                  <div className="text-xs text-muted-foreground">{inv.clients?.full_name} · {new Date(inv.issued_at).toLocaleDateString()}</div>
                </div>
                <div className="text-end">
                  <div className="font-bold">{Number(inv.total).toLocaleString()} {t("common.currency")}</div>
                  {rem > 0 && <div className="text-xs text-destructive">Reste: {rem.toLocaleString()}</div>}
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => doPrint(inv)}><Printer className="h-4 w-4" /></Button>
                  {can("invoices", "edit") && <Button size="icon" variant="ghost" onClick={() => setEdit(inv)}><Edit className="h-4 w-4" /></Button>}
                  {can("invoices", "delete") && <Button size="icon" variant="ghost" onClick={() => { if (confirm("?")) delFn({ data: { id: inv.id } }).then(() => qc.invalidateQueries({ queryKey: ["invoices"] })); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit?.number}</DialogTitle></DialogHeader>
          {edit && (
            <div className="grid gap-3">
              <div className="text-sm text-muted-foreground">Sous-total: {Number(edit.subtotal).toLocaleString()}</div>
              <div className="grid grid-cols-2 gap-2">
                <div className="grid gap-1"><Label>Remise</Label><Input type="number" value={edit.discount} onChange={(e) => setEdit({ ...edit, discount: Number(e.target.value) })} /></div>
                <div className="grid gap-1"><Label>Payé</Label><Input type="number" value={edit.amount_paid} onChange={(e) => setEdit({ ...edit, amount_paid: Number(e.target.value) })} /></div>
              </div>
              <div className="grid gap-1">
                <Label>Type de paiement</Label>
                <Select value={edit.payment_type} onValueChange={(v) => setEdit({ ...edit, payment_type: v as "full" | "partial" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full">{t("invoice.paymentFull")}</SelectItem>
                    <SelectItem value="partial">{t("invoice.paymentPartial")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter><Button onClick={onSave}>{t("common.save")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {printInv && <div id="invoice-print" className="print-only"><InvoicePrintView invoice={printInv} settings={settings.data?.settings ?? null} /></div>}
    </div>
  );
}
