import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminListAttendance, markAttendance } from "@/lib/admin.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, Calendar as CalendarIcon, UserCheck } from "lucide-react";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { usePerms } from "@/hooks/use-perms";
import { Pagination } from "@/components/Pagination";

export const Route = createFileRoute("/admin/attendance")({ component: AdminAttendancePage });

function AdminAttendancePage() {
  const { t } = useTranslation();
  const { can } = usePerms();
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  
  const listFn = useServerFn(adminListAttendance);
  const markFn = useServerFn(markAttendance);

  const q = useQuery({ 
    queryKey: ["attendance", date], 
    queryFn: () => listFn({ data: { date } }) 
  });

  const [page, setPage] = useState(1);
  const perPage = 30;
  const items = q.data?.items ?? [];
  const totalPages = Math.ceil(items.length / perPage);
  const paginated = items.slice((page - 1) * perPage, page * perPage);
  useEffect(() => { setPage(1); }, [date]);

  const onMark = async (id: string, attendance: string | null) => {
    try {
      await markFn({ data: { id, attendance } });
      qc.invalidateQueries({ queryKey: ["attendance", date] });
      toast.success("✓");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl text-primary">{t("nav.attendance")}</h1>
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-4 w-4 text-muted-foreground" />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="flex h-9 w-40 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
      </div>

      <div className="grid gap-2">
        {paginated.map((a) => {
          const client = (a as any).clients as { full_name?: string; phone?: string; code?: string } | null;
          const svc = (a as any).services as { name?: string; price_dzd?: number } | null;
          return (
            <Card key={a.id} className={a.attendance === "present" ? "border-primary/30 bg-primary/5" : a.attendance === "absent" ? "border-destructive/30 bg-destructive/5" : ""}>
              <CardContent className="p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${a.attendance === "present" ? "bg-primary text-primary-foreground" : a.attendance === "absent" ? "bg-destructive text-destructive-foreground" : "bg-muted text-muted-foreground"}`}>
                    <UserCheck className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{client?.full_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {a.appointment_time ? String(a.appointment_time).slice(0, 5) : "—"}
                    </div>
                    <div className="text-sm mt-1 flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-xs">
                        {svc?.name ?? "—"}
                      </Badge>
                      <span className="text-xs font-medium text-primary">
                        {Number(svc?.price_dzd ?? 0).toLocaleString()} {t("common.currency")}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant={a.attendance === "present" ? "default" : "outline"}
                    className="gap-1 h-9 rounded-xl"
                    onClick={() => onMark(a.id, a.attendance === "present" ? null : "present")}
                    disabled={!can("attendance", "edit")}
                  >
                    <Check className="h-4 w-4" />
                    {t("admin.markPresent")}
                  </Button>
                  <Button
                    size="sm"
                    variant={a.attendance === "absent" ? "destructive" : "outline"}
                    className="gap-1 h-9 rounded-xl"
                    onClick={() => onMark(a.id, a.attendance === "absent" ? null : "absent")}
                    disabled={!can("attendance", "edit")}
                  >
                    <X className="h-4 w-4" />
                    {t("admin.markAbsent")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        {q.data?.items?.length === 0 && !q.isLoading && (
          <div className="rounded-xl border-2 border-dashed p-12 text-center text-muted-foreground">
            {date === today ? t("admin.noAppointments") || t("common.today") : date}
          </div>
        )}
      </div>
    </div>
  );
}