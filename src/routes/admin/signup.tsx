import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { bootstrapAdmin } from "@/lib/admin.functions";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/signup")({ component: SignupPage });

function SignupPage() {
  const navigate = useNavigate();
  const fn = useServerFn(bootstrapAdmin);
  const [form, setForm] = useState({ username: "", password: "", displayName: "" });
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await fn({ data: form });
      // Sign in immediately
      await supabase.auth.signInWithPassword({ email: `${form.username.toLowerCase()}@nassib.local`, password: form.password });
      navigate({ to: "/admin" });
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-rose-gradient flex flex-col items-center px-4 pt-16">
      <Logo size={60} />
      <div className="font-display text-xl text-primary mt-3">CENTRE NECIB</div>
      <Card className="mt-6 w-full max-w-md">
        <CardContent className="p-6 grid gap-4">
          <h1 className="font-display text-2xl text-primary">Configuration initiale</h1>
          <p className="text-xs text-muted-foreground">Créez le compte administrateur principal. Ce formulaire ne sera plus accessible après.</p>
          <form className="grid gap-3" onSubmit={submit}>
            <div className="grid gap-2"><Label>Nom</Label><Input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} required /></div>
            <div className="grid gap-2"><Label>Nom d'utilisateur</Label><Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required pattern="[A-Za-z0-9_.\-]+" /></div>
            <div className="grid gap-2"><Label>Mot de passe</Label><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} /></div>
            <Button type="submit" disabled={busy}>{busy ? "…" : "Créer"}</Button>
          </form>
          <Link to="/admin/login" className="text-xs text-center text-muted-foreground">← Connexion</Link>
        </CardContent>
      </Card>
    </div>
  );
}
