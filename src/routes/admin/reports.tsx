import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listMedicalReports, getMedicalReport, saveMedicalReport,
  addReportNote, deleteReportNote,
} from "@/lib/admin.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Search, FileText, User, ChevronRight, Phone, MapPin, Cake,
  Calendar, Clock, Plus, Trash2, Award, Activity,
} from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { usePerms } from "@/hooks/use-perms";
import { Pagination } from "@/components/Pagination";

export const Route = createFileRoute("/admin/reports")({ component: AdminReportsPage });

function AdminReportsPage() {
  const { t } = useTranslation();
  const { can } = usePerms();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const perPage = 30;
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [newNote, setNewNote] = useState("");

  const listFn = useServerFn(listMedicalReports);
  const getFn = useServerFn(getMedicalReport);
  const saveFn = useServerFn(saveMedicalReport);
  const addNoteFn = useServerFn(addReportNote);
  const delNoteFn = useServerFn(deleteReportNote);

  const listQ = useQuery({ queryKey: ["reports"], queryFn: () => listFn() });
  const detailQ = useQuery({
    queryKey: ["report-detail", selectedClientId],
    queryFn: () => getFn({ data: { clientId: selectedClientId! } }),
    enabled: !!selectedClientId,
  });

  const [editDiagnosis, setEditDiagnosis] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editRecommendations, setEditRecommendations] = useState("");

  const openReport = (clientId: string) => {
    setSelectedClientId(clientId);
    setNewNote("");
  };

  const closeReport = () => {
    setSelectedClientId(null);
    setEditDiagnosis("");
    setEditDescription("");
    setEditRecommendations("");
  };

  const report = detailQ.data?.report;
  const appointments = detailQ.data?.appointments ?? [];
  const notes = (detailQ.data?.notes ?? []) as { id: string; note: string; created_at: string; created_by?: string | null }[];

  const onSave = async () => {
    if (!selectedClientId) return;
    try {
      await saveFn({
        data: {
          client_id: selectedClientId,
          diagnosis: editDiagnosis || null,
          description: editDescription || null,
          recommendations: editRecommendations || null,
        },
      });
      qc.invalidateQueries({ queryKey: ["reports"] });
      qc.invalidateQueries({ queryKey: ["report-detail"] });
      toast.success("✓");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const onAddNote = async () => {
    if (!newNote.trim() || !report?.id) return;
    try {
      await addNoteFn({ data: { reportId: report.id, note: newNote.trim() } });
      setNewNote("");
      qc.invalidateQueries({ queryKey: ["report-detail"] });
      toast.success("✓");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const onDeleteNote = async (id: string) => {
    try {
      await delNoteFn({ data: { id } });
      qc.invalidateQueries({ queryKey: ["report-detail"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const filtered = useMemo(() => {
    const items = listQ.data?.items ?? [];
    if (!search) return items;
    const s = search.toLowerCase();
    return items.filter((i) =>
      (i.clients as any)?.full_name?.toLowerCase().includes(s) ||
      (i.clients as any)?.code?.toLowerCase().includes(s)
    );
  }, [listQ.data?.items, search]);

  const totalPages = Math.ceil(filtered.length / perPage);
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);
  useEffect(() => { setPage(1); }, [search]);

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl text-primary">{t("nav.reports")}</h1>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("common.search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="grid gap-3">
        {paginated.map((item) => {
          const client = (item as any).clients;
          return (
            <Card
              key={item.id}
              className="hover:border-primary/50 transition cursor-pointer"
              onClick={() => openReport(item.client_id)}
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-semibold">{client?.full_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {t("admin.clientInfo")}: {client?.code}
                      {client?.phone && ` · ${client.phone}`}
                    </div>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </CardContent>
            </Card>
          );
        })}
          {filtered.length === 0 && !listQ.isLoading && (
          <div className="rounded-xl border-2 border-dashed p-12 text-center text-muted-foreground">
            {t("admin.noReports")}
          </div>
        )}
      </div>

      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />

      <Dialog open={!!selectedClientId} onOpenChange={(o) => !o && closeReport()}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {report && (() => {
            const client = (report as any).clients as {
              full_name?: string; code?: string; phone?: string;
              age?: number; address?: string; gender?: string;
            } | null;

            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-lg">
                    <User className="h-5 w-5 text-primary" />
                    {client?.full_name ?? ""}
                    <span className="text-sm font-normal text-muted-foreground">
                      · {client?.code}
                    </span>
                  </DialogTitle>
                </DialogHeader>

                <div className="grid gap-6">
                  {/* Client Info */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                        <User className="h-4 w-4" />
                        {t("admin.clientInfo")}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <div className="flex items-center gap-2">
                          <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{client?.phone ?? "—"}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Cake className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{client?.age ? `${client.age} ${client.age > 1 ? "ans" : "an"}` : "—"}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{client?.address ?? "—"}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Award className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{client?.gender === "male" ? "ذكر" : client?.gender === "female" ? "أنثى" : "—"}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Sessions History */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                        <Activity className="h-4 w-4" />
                        {t("admin.sessionsHistory")} ({appointments.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {appointments.length === 0 ? (
                        <div className="text-sm text-muted-foreground">—</div>
                      ) : (
                        <div className="grid gap-2">
                          {appointments.map((a) => {
                            const svc = (a as any).services;
                            return (
                              <div key={a.id} className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0">
                                <div className="flex items-center gap-3">
                                  <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                                  <div>
                                    <div className="text-sm font-medium">{svc?.name ?? "—"}</div>
                                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                                      <span>{a.appointment_date}</span>
                                      {a.appointment_time && (
                                        <>
                                          <Clock className="h-3 w-3" />
                                          <span>{String(a.appointment_time).slice(0, 5)}</span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <div className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                                  {a.status}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Diagnosis / Description / Recommendations */}
                  <div className="grid gap-4">
                    <div className="grid gap-2">
                      <Label>{t("admin.diagnosis")}</Label>
                      <Input
                        value={editDiagnosis}
                        onChange={(e) => setEditDiagnosis(e.target.value)}
                        placeholder="..."
                        onBlur={onSave}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>{t("admin.description")}</Label>
                      <Textarea
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        rows={3}
                        onBlur={onSave}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>{t("admin.recommendations")}</Label>
                      <Textarea
                        value={editRecommendations}
                        onChange={(e) => setEditRecommendations(e.target.value)}
                        rows={2}
                        onBlur={onSave}
                      />
                    </div>
                  </div>

                  {/* Notes */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-muted-foreground">
                        {t("admin.reportNotes")} ({notes.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-3">
                      {notes.length === 0 && (
                        <div className="text-sm text-muted-foreground">{t("admin.noNotes")}</div>
                      )}
                      {notes.map((n) => (
                        <div key={n.id} className="border rounded-lg p-3 relative group">
                          <div className="text-sm whitespace-pre-wrap">{n.note}</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {new Date(n.created_at).toLocaleString()}
                          </div>
                          {can("reports", "delete") && (
                            <button
                              onClick={() => onDeleteNote(n.id)}
                              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition text-destructive hover:text-destructive/80"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      ))}
                      {can("reports", "edit") && (
                        <div className="flex gap-2 pt-2">
                          <Input
                            value={newNote}
                            onChange={(e) => setNewNote(e.target.value)}
                            placeholder={t("admin.addNote")}
                            onKeyDown={(e) => e.key === "Enter" && onAddNote()}
                          />
                          <Button size="sm" onClick={onAddNote} disabled={!newNote.trim()}>
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                <DialogFooter className="gap-2">
                  <Button variant="outline" onClick={closeReport}>
                    {t("common.close")}
                  </Button>
                  {can("reports", "edit") && (
                    <Button onClick={onSave}>{t("common.save")}</Button>
                  )}
                </DialogFooter>
              </>
            );
          })()}
          {!report && detailQ.isLoading && (
            <div className="p-12 text-center text-muted-foreground">{t("common.loading")}</div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}