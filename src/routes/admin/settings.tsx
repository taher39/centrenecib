import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getSettings, saveSettings, updateMyCredentials } from "@/lib/admin.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/settings")({ component: SettingsPage });

type S = { name: string; address: string; phone: string; email: string; nif: string; nis: string; rc: string; article: string; ai: string };

function SettingsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const getFn = useServerFn(getSettings);
  const saveFn = useServerFn(saveSettings);
  const credFn = useServerFn(updateMyCredentials);
  const q = useQuery({ queryKey: ["settings"], queryFn: () => getFn() });
  const [form, setForm] = useState<S>({ name: "CENTRE NECIB", address: "", phone: "", email: "", nif: "", nis: "", rc: "", article: "", ai: "" });
  const [cred, setCred] = useState({ newDisplayName: "", newUsername: "", newPassword: "" });

  useEffect(() => {
    if (q.data?.settings) {
      const s = q.data.settings;
      setForm({ name: s.name ?? "CENTRE NECIB", address: s.address ?? "", phone: s.phone ?? "", email: s.email ?? "", nif: s.nif ?? "", nis: s.nis ?? "", rc: s.rc ?? "", article: s.article ?? "", ai: s.ai ?? "" });
    }
  }, [q.data]);

  const save = async () => {
    try { await saveFn({ data: form }); qc.invalidateQueries({ queryKey: ["settings"] }); toast.success("✓"); }
    catch (e) { toast.error((e as Error).message); }
  };

  const updateCred = async () => {
    try {
      const data: { newDisplayName?: string; newUsername?: string; newPassword?: string } = {};
      if (cred.newDisplayName) data.newDisplayName = cred.newDisplayName;
      if (cred.newUsername) data.newUsername = cred.newUsername;
      if (cred.newPassword) data.newPassword = cred.newPassword;
      await credFn({ data });
      setCred({ newDisplayName: "", newUsername: "", newPassword: "" });
      toast.success("✓");
    } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <div className="grid gap-4 max-w-3xl">
      <h1 className="font-display text-2xl text-primary">{t("nav.settings")}</h1>
      <Card>
        <CardHeader><CardTitle>Informations centre</CardTitle></CardHeader>
        <CardContent className="grid gap-3">
          <div className="grid gap-2"><Label>{t("common.name")}</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-2"><Label>{t("common.phone")}</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div className="grid gap-2"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          </div>
          <div className="grid gap-2"><Label>Adresse</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
          <div className="text-sm font-semibold mt-2">Identifiants fiscaux (facture)</div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            <div className="grid gap-1"><Label className="text-xs">NIF</Label><Input value={form.nif} onChange={(e) => setForm({ ...form, nif: e.target.value })} /></div>
            <div className="grid gap-1"><Label className="text-xs">NIS</Label><Input value={form.nis} onChange={(e) => setForm({ ...form, nis: e.target.value })} /></div>
            <div className="grid gap-1"><Label className="text-xs">RC</Label><Input value={form.rc} onChange={(e) => setForm({ ...form, rc: e.target.value })} /></div>
            <div className="grid gap-1"><Label className="text-xs">Article</Label><Input value={form.article} onChange={(e) => setForm({ ...form, article: e.target.value })} /></div>
            <div className="grid gap-1"><Label className="text-xs">AI</Label><Input value={form.ai} onChange={(e) => setForm({ ...form, ai: e.target.value })} /></div>
          </div>
          <Button onClick={save} className="justify-self-end">{t("common.save")}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Mes identifiants</CardTitle></CardHeader>
        <CardContent className="grid gap-3">
          <div className="grid gap-2"><Label>{t("common.name")}</Label><Input value={cred.newDisplayName} onChange={(e) => setCred({ ...cred, newDisplayName: e.target.value })} placeholder="…" /></div>
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-2"><Label>{t("admin.username")}</Label><Input value={cred.newUsername} onChange={(e) => setCred({ ...cred, newUsername: e.target.value })} placeholder="…" pattern="[A-Za-z0-9_.\-]+" /></div>
            <div className="grid gap-2"><Label>{t("admin.password")}</Label><Input type="password" value={cred.newPassword} onChange={(e) => setCred({ ...cred, newPassword: e.target.value })} placeholder="…" /></div>
          </div>
          <Button onClick={updateCred} className="justify-self-end">{t("common.save")}</Button>
        </CardContent>
      </Card>
    </div>
  );
}
