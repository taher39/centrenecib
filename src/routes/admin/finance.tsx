import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { finance, addFinanceEntry, deleteFinanceEntry } from "@/lib/admin.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Trash2, TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { toast } from "sonner";
import { usePerms } from "@/hooks/use-perms";

export const Route = createFileRoute("/admin/finance")({ component: FinancePage });

function FinancePage() {
  const { t } = useTranslation();
  const { can } = usePerms();
  const qc = useQueryClient();
  const fn = useServerFn(finance);
  const addFn = useServerFn(addFinanceEntry);
  const delFn = useServerFn(deleteFinanceEntry);
  const q = useQuery({ queryKey: ["finance"], queryFn: () => fn() });
  const [add, setAdd] = useState<{ kind: "income" | "expense"; amount: number; reason: string } | null>(null);

  const onSave = async () => {
    if (!add) return;
    try { await addFn({ data: add }); setAdd(null); qc.invalidateQueries({ queryKey: ["finance"] }); toast.success("✓"); }
    catch (e) { toast.error((e as Error).message); }
  };

  return (
    <div className="grid gap-4">
      <h1 className="font-display text-2xl text-primary">{t("admin.netRevenue")}</h1>
      <div className="grid gap-3 md:grid-cols-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2 text-primary"><TrendingUp className="h-4 w-4" />{t("admin.income")}</CardTitle></CardHeader><CardContent className="text-2xl font-bold text-primary">{Math.round(q.data?.income ?? 0).toLocaleString()} {t("common.currency")}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2 text-destructive"><TrendingDown className="h-4 w-4" />{t("admin.expense")}</CardTitle></CardHeader><CardContent className="text-2xl font-bold text-destructive">{Math.round(q.data?.expense ?? 0).toLocaleString()} {t("common.currency")}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Wallet className="h-4 w-4" />{t("admin.balance")}</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{Math.round(q.data?.balance ?? 0).toLocaleString()} {t("common.currency")}</CardContent></Card>
      </div>

      {can("finance", "edit") && (
        <div className="flex gap-2">
          <Button onClick={() => setAdd({ kind: "income", amount: 0, reason: "" })}><TrendingUp className="h-4 w-4 me-1" />{t("admin.addIncome")}</Button>
          <Button variant="destructive" onClick={() => setAdd({ kind: "expense", amount: 0, reason: "" })}><TrendingDown className="h-4 w-4 me-1" />{t("admin.addExpense")}</Button>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">{t("admin.income")}</CardTitle></CardHeader>
          <CardContent className="grid gap-1 text-sm">
            {(q.data?.payments ?? []).map((p) => (
              <div key={p.id} className="flex items-center justify-between border-b pb-1">
                <span>{p.reason}</span>
                <span className="flex items-center gap-2"><span className="text-primary font-medium">{Number(p.amount).toLocaleString()}</span><Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => delFn({ data: { id: p.id, kind: "income" } }).then(() => qc.invalidateQueries({ queryKey: ["finance"] }))}><Trash2 className="h-3 w-3 text-destructive" /></Button></span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">{t("admin.expense")}</CardTitle></CardHeader>
          <CardContent className="grid gap-1 text-sm">
            {(q.data?.expenses ?? []).map((p) => (
              <div key={p.id} className="flex items-center justify-between border-b pb-1">
                <span>{p.reason}</span>
                <span className="flex items-center gap-2"><span className="text-destructive font-medium">{Number(p.amount).toLocaleString()}</span><Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => delFn({ data: { id: p.id, kind: "expense" } }).then(() => qc.invalidateQueries({ queryKey: ["finance"] }))}><Trash2 className="h-3 w-3 text-destructive" /></Button></span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!add} onOpenChange={(o) => !o && setAdd(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{add?.kind === "income" ? t("admin.addIncome") : t("admin.addExpense")}</DialogTitle></DialogHeader>
          {add && (
            <div className="grid gap-3">
              <div className="grid gap-2"><Label>{t("admin.reason")}</Label><Input value={add.reason} onChange={(e) => setAdd({ ...add, reason: e.target.value })} /></div>
              <div className="grid gap-2"><Label>{t("admin.amount")}</Label><Input type="number" value={add.amount} onChange={(e) => setAdd({ ...add, amount: Number(e.target.value) })} /></div>
            </div>
          )}
          <DialogFooter><Button onClick={onSave}>{t("common.save")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
