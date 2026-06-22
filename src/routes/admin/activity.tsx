import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listActivity } from "@/lib/admin.functions";
import { Card, CardContent } from "@/components/ui/card";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { Pagination } from "@/components/Pagination";

export const Route = createFileRoute("/admin/activity")({ component: ActivityPage });

function ActivityPage() {
  const { t } = useTranslation();
  const fn = useServerFn(listActivity);
  const q = useQuery({ queryKey: ["activity"], queryFn: () => fn() });
  const [page, setPage] = useState(1);
  const perPage = 30;
  const items = q.data?.items ?? [];
  const totalPages = Math.ceil(items.length / perPage);
  const paginated = items.slice((page - 1) * perPage, page * perPage);
  return (
    <div className="grid gap-3">
      <h1 className="font-display text-2xl text-primary">{t("nav.activity")}</h1>
      <div className="grid gap-1">
        {paginated.map((a) => (
          <Card key={a.id}><CardContent className="p-3 flex items-center justify-between text-sm">
            <div>
              <span className="font-semibold">{a.actor_display}</span>
              <span className="text-muted-foreground"> · {a.action} · {a.entity}{a.entity_id ? ` (${String(a.entity_id).slice(0, 8)})` : ""}</span>
            </div>
            <span className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</span>
          </CardContent></Card>
        ))}
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        {items.length === 0 && <div className="rounded-xl border-2 border-dashed p-6 text-center text-muted-foreground">—</div>}
      </div>
    </div>
  );
}
