import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listActivity } from "@/lib/admin.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useTranslation } from "react-i18next";
import { useMemo, useState, useEffect } from "react";
import { Pagination } from "@/components/Pagination";

export const Route = createFileRoute("/admin/activity")({ component: ActivityPage });

function actionLabel(action: string, entity: string) {
  const map: Record<string, string> = {
    login: "تسجيل دخول / Connexion",
    logout: "تسجيل خروج / Déconnexion",
    appointment_pending: "حجز موعد / Réservation",
    appointment_confirmed: "تأكيد موعد / Confirmé",
    appointment_completed: "إنجاز موعد / Terminé",
    appointment_cancelled: "إلغاء موعد / Annulé",
    appointment_postponed: "تأجيل موعد / Reporté",
    create_manual: "إنشاء موعد يدوي / Manuel",
    delete_appointment: "حذف موعد / Supprimé",
    create_client: "إنشاء عميل / Nouveau client",
    update_client: "تعديل عميل / Modifié",
    delete_client: "حذف عميل / Supprimé",
    create_service: "إضافة جلسة / Nouveau soin",
    update_service: "تعديل جلسة / Soin modifié",
    delete_service: "حذف جلسة / Soin supprimé",
    update_credentials: "تعديل بيانات الدخول / Identifiants",
    update_settings: "تعديل الإعدادات / Paramètres",
    create_staff: "إضافة سكرتيرة / Nouvelle secrétaire",
    update_staff_permissions: "تعديل صلاحيات / Permissions",
    delete_staff: "حذف سكرتيرة / Secrétaire supprimée",
    create_offer: "إضافة عرض / Nouvelle offre",
    update_offer: "تعديل عرض / Offre modifiée",
    delete_offer: "حذف عرض / Offre supprimée",
    create_gallery: "إضافة صورة / Nouvelle image",
    delete_gallery: "حذف صورة / Image supprimée",
    update_invoice: "تعديل فاتورة / Facture modifiée",
    delete_invoice: "حذف فاتورة / Facture supprimée",
    create_income: "إضافة مدخول / Nouvelle entrée",
    create_expense: "إضافة مصروف / Nouvelle sortie",
    delete_income: "حذف مدخول / Entrée supprimée",
    delete_expense: "مصروف محذوف / Sortie supprimée",
    create_product: "إضافة منتج / Nouveau produit",
    update_product: "تعديل منتج / Produit modifié",
    delete_product: "حذف منتج / Produit supprimé",
    save_report: "حفظ تقرير / Rapport sauvegardé",
  };
  return map[`${action}_${entity}`] ?? map[action] ?? `${action} · ${entity}`;
}

const FILTER_ALL = "__all__";

function ActivityPage() {
  const { t } = useTranslation();
  const fn = useServerFn(listActivity);
  const q = useQuery({ queryKey: ["activity"], queryFn: () => fn() });
  const [filter, setFilter] = useState(FILTER_ALL);
  const [page, setPage] = useState(1);
  const perPage = 30;

  const items = q.data?.items ?? [];

  const filterOptions = useMemo(() => {
    const keys = new Set<string>();
    for (const a of items) {
      keys.add(`${a.action}_${a.entity}`);
    }
    return Array.from(keys).sort();
  }, [items]);

  const filtered = useMemo(() => {
    if (filter === FILTER_ALL) return items;
    return items.filter((a) => `${a.action}_${a.entity}` === filter);
  }, [items, filter]);

  useEffect(() => { setPage(1); }, [filter]);

  const totalPages = Math.ceil(filtered.length / perPage);
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-display text-2xl text-primary">{t("nav.activity")}</h1>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder={t("admin.filterByType") || "تصفية حسب النوع"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={FILTER_ALL}>{t("admin.allActivities") || "الكل"}</SelectItem>
            {filterOptions.map((key) => (
              <SelectItem key={key} value={key}>{actionLabel(key.split("_")[0], key.split("_").slice(1).join("_"))}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-1">
        {paginated.map((a) => {
          const label = actionLabel(a.action, a.entity);
          return (
            <Card key={a.id}>
              <CardContent className="p-3 flex items-center justify-between gap-2 text-sm">
                <div className="min-w-0 flex-1">
                  <span className="font-semibold">{a.actor_display}</span>
                  <Badge variant="outline" className="mx-1.5 text-[10px] align-middle">{label}</Badge>
                  {a.entity_id && (
                    <span className="text-muted-foreground font-mono text-[10px]">#{String(a.entity_id).slice(0, 8)}</span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground shrink-0">{new Date(a.created_at).toLocaleString()}</span>
              </CardContent>
            </Card>
          );
        })}
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        {filtered.length === 0 && (
          <div className="rounded-xl border-2 border-dashed p-6 text-center text-muted-foreground">—</div>
        )}
      </div>
    </div>
  );
}
