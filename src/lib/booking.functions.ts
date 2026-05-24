import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function admin() {
  return createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Public: list services
export const listServices = createServerFn({ method: "GET" }).handler(async () => {
  const sb = admin();
  const [{ data: services }, { data: hours }] = await Promise.all([
    sb.from("services").select("*").eq("active", true).order("created_at"),
    sb.from("working_hours").select("*").order("position"),
  ]);
  return { services: services ?? [], workingHours: hours ?? [] };
});

// Public: list active offers + gallery
export const listPublic = createServerFn({ method: "GET" }).handler(async () => {
  const sb = admin();
  const nowIso = new Date().toISOString();
  const [{ data: offers }, { data: gallery }, { data: settings }] = await Promise.all([
    sb.from("offers").select("*").eq("active", true).gt("ends_at", nowIso).order("created_at", { ascending: false }),
    sb.from("gallery_images").select("*").eq("active", true).order("position"),
    sb.from("center_settings").select("*").limit(1).maybeSingle(),
  ]);
  return { offers: offers ?? [], gallery: gallery ?? [], settings: settings ?? null };
});

// Lookup client by code
export const loginByCode = createServerFn({ method: "POST" })
  .inputValidator((d: { code: string }) => z.object({ code: z.string().regex(/^\d{10}$/) }).parse(d))
  .handler(async ({ data }) => {
    const sb = admin();
    const { data: client } = await sb.from("clients").select("*").eq("code", data.code).maybeSingle();
    if (!client) return { client: null };
    return { client };
  });

// Smart booking: pick first slot of capacity for each requested service on the chosen date
async function findSlot(sb: ReturnType<typeof admin>, serviceId: string, date: string) {
  const { data: svc } = await sb.from("services").select("*").eq("id", serviceId).single();
  if (!svc) throw new Error("Service introuvable");
  const dow = new Date(date + "T00:00:00").getDay();
  if (!(svc.available_days as number[]).includes(dow)) {
    throw new Error(`${svc.name}: jour indisponible`);
  }
  const { data: hours } = await sb.from("working_hours").select("*").order("position");
  if (!hours || hours.length === 0) throw new Error("Horaires non configurés");

  const { data: existing } = await sb
    .from("appointments")
    .select("appointment_time, service_id, status")
    .eq("appointment_date", date)
    .eq("service_id", serviceId)
    .in("status", ["pending", "confirmed"]);

  const taken: Record<string, number> = {};
  (existing ?? []).forEach((a) => {
    const t = (a.appointment_time as string).slice(0, 5);
    taken[t] = (taken[t] ?? 0) + 1;
  });

  const toMin = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  const fmt = (mins: number) =>
    `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;

  for (const block of hours) {
    const start = toMin(block.start_time.slice(0, 5));
    const end = toMin(block.end_time.slice(0, 5));
    for (let m = start; m + svc.duration_min <= end; m += svc.duration_min) {
      const slot = fmt(m);
      if ((taken[slot] ?? 0) < svc.capacity) return { time: slot, service: svc };
    }
  }
  throw new Error(`${svc.name}: aucun créneau disponible`);
}

// Book: create client if new, schedule each chosen service
export const book = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        clientId: z.string().uuid().optional(),
        fullName: z.string().min(2).max(120).optional(),
        age: z.number().int().min(8).max(110).optional(),
        phone: z.string().min(6).max(30).optional(),
        bookings: z
          .array(
            z.object({
              serviceId: z.string().uuid(),
              date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
            })
          )
          .min(1)
          .max(10),
      })
      .parse(d)
  )
  .handler(async ({ data }) => {
    const sb = admin();
    let clientId = data.clientId;
    let code: string | null = null;
    let isNew = false;

    if (!clientId) {
      if (!data.fullName || !data.phone) throw new Error("Informations manquantes");
      const { data: genCode } = await sb.rpc("generate_client_code");
      code = genCode as string;
      const { data: created, error } = await sb
        .from("clients")
        .insert({ full_name: data.fullName, age: data.age ?? null, phone: data.phone, code })
        .select()
        .single();
      if (error || !created) throw new Error(error?.message ?? "Erreur création");
      clientId = created.id;
      isNew = true;
    } else {
      const { data: existing } = await sb.from("clients").select("code").eq("id", clientId).single();
      code = existing?.code ?? null;
    }

    const groupId = crypto.randomUUID();
    const created: Array<{ serviceName: string; time: string; date: string }> = [];

    for (const b of data.bookings) {
      const slot = await findSlot(sb, b.serviceId, b.date);
      const { error: insertErr } = await sb.from("appointments").insert({
        client_id: clientId!,
        service_id: b.serviceId,
        appointment_date: b.date,
        appointment_time: slot.time + ":00",
        status: "pending",
        group_id: groupId,

      });
      if (insertErr) throw new Error(insertErr.message);
      created.push({ serviceName: slot.service.name, time: slot.time, date: data.date });
    }

    return { clientId, code, isNew, appointments: created };
  });

// Client dashboard
export const clientDashboard = createServerFn({ method: "POST" })
  .inputValidator((d: { clientId: string }) => z.object({ clientId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const sb = admin();
    const today = new Date().toISOString().slice(0, 10);
    const [{ data: client }, { data: appts }, { data: invoices }] = await Promise.all([
      sb.from("clients").select("*").eq("id", data.clientId).maybeSingle(),
      sb
        .from("appointments")
        .select("*, services(name, price_dzd, duration_min)")
        .eq("client_id", data.clientId)
        .order("appointment_date", { ascending: false })
        .order("appointment_time", { ascending: false }),
      sb.from("invoices").select("*").eq("client_id", data.clientId).order("issued_at", { ascending: false }),
    ]);
    if (!client) throw new Error("Client introuvable");
    const upcoming = (appts ?? []).filter(
      (a) => a.appointment_date >= today && ["pending", "confirmed", "postponed"].includes(a.status as string)
    );
    const past = (appts ?? []).filter((a) => !upcoming.includes(a));
    return { client, upcoming, past, invoices: invoices ?? [] };
  });
