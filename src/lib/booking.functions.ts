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
// Also handles product selection for the client booking flow
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

// Book: create client if new, schedule each chosen service, add products
export const book = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        clientId: z.string().uuid().optional(),
        fullName: z.string().min(2).max(120).optional(),
        age: z.number().int().min(8).max(110).optional(),
        phone: z.string().min(6).max(30).optional(),
        address: z.string().trim().min(2).max(200).optional(),
        gender: z.enum(["male", "female"]).optional(),
        bookings: z
          .array(
            z.object({
              serviceId: z.string().uuid(),
              date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
            })
          )
          .min(1)
          .max(10),
        products: z.array(z.object({
          productId: z.string().uuid(),
          quantity: z.number().int().min(1),
          unitPrice: z.number().min(0),
        })).optional(),
      })
      .parse(d)
  )
  .handler(async ({ data }) => {
    const sb = admin();
    let clientId = data.clientId;
    let code: string | null = null;
    let isNew = false;
    let clientGender: "male" | "female" | null = null;

    if (!clientId) {
      if (!data.fullName || !data.phone || !data.address || !data.gender) throw new Error("Informations manquantes");
      clientGender = data.gender;
      const { data: genCode } = await sb.rpc("generate_client_code");
      code = genCode as string;
      const { data: created, error } = await sb
        .from("clients")
        .insert({ full_name: data.fullName, age: data.age ?? null, phone: data.phone, address: data.address, gender: data.gender, code })
        .select()
        .single();
      if (error || !created) throw new Error(error?.message ?? "Erreur création");
      clientId = created.id;
      isNew = true;
    } else {
      const { data: existing } = await sb.from("clients").select("code, gender").eq("id", clientId).single();
      code = existing?.code ?? null;
      clientGender = ((existing as { gender?: string | null } | null)?.gender as "male" | "female" | null) ?? null;
    }

    // Pre-validate gender restrictions on all chosen services
    const svcIds = [...new Set(data.bookings.map((b) => b.serviceId))];
    const { data: svcRows } = await sb.from("services").select("id, name, gender_target").in("id", svcIds);
    for (const s of svcRows ?? []) {
      const gt = (s as { gender_target?: string }).gender_target ?? "both";
      if (gt !== "both" && clientGender && gt !== clientGender) {
        throw new Error(gt === "female" ? "GENDER_FEMALE_ONLY" : "GENDER_MALE_ONLY");
      }
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
      created.push({ serviceName: slot.service.name, time: slot.time, date: b.date });
    }

    // Add products to the first appointment of the group
    if (data.products && data.products.length > 0) {
      const firstAppt = created.length > 0 ? await sb.from("appointments").select("id").eq("group_id", groupId).limit(1).maybeSingle() : null;
      if (firstAppt?.data?.id) {
        const apInserts = data.products.map((p) => ({
          appointment_id: firstAppt.data!.id,
          product_id: p.productId,
          quantity: p.quantity,
          unit_price: p.unitPrice,
        }));
        await sb.from("appointment_products").insert(apInserts);
      }
    }

    return { clientId, code, isNew, appointments: created };
  });

// Client dashboard
export const clientDashboard = createServerFn({ method: "POST" })
  .inputValidator((d: { clientId: string }) => z.object({ clientId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const sb = admin();
    const [{ data: client }, { data: appts }, { data: invoices }] = await Promise.all([
      sb.from("clients").select("*").eq("id", data.clientId).maybeSingle(),
      sb
        .from("appointments")
        .select("*")
        .eq("client_id", data.clientId)
        .order("appointment_date", { ascending: false })
        .order("appointment_time", { ascending: false }),
      sb.from("invoices").select("*").eq("client_id", data.clientId).order("issued_at", { ascending: false }),
    ]);
    if (!client) throw new Error("Client introuvable");
    const serviceIds = [...new Set((appts ?? []).map((a) => a.service_id).filter((id): id is string => !!id))];
    const offerIds = [...new Set((appts ?? []).map((a) => a.offer_id).filter((id): id is string => !!id))];

    const [{ data: services }, { data: offers }] = await Promise.all([
      serviceIds.length ? sb.from("services").select("id, name, price_dzd, duration_min").in("id", serviceIds) : Promise.resolve({ data: [] as { id: string; name: string; price_dzd: number; duration_min: number }[] }),
      offerIds.length ? sb.from("offers").select("id, title, offer_price").in("id", offerIds) : Promise.resolve({ data: [] as { id: string; title: string; offer_price: number }[] }),
    ]);

    const serviceMap = new Map((services ?? []).map((item) => [item.id, item]));
    const offerMap = new Map((offers ?? []).map((item) => [item.id, item]));
    const now = new Date();

    const enriched = (appts ?? []).map((appointment) => {
      const service = appointment.service_id ? serviceMap.get(appointment.service_id) ?? null : null;
      const offer = appointment.offer_id ? offerMap.get(appointment.offer_id) ?? null : null;
      const time = typeof appointment.appointment_time === "string" ? appointment.appointment_time.slice(0, 5) : null;
      const effectiveDateTime = new Date(`${appointment.appointment_date}T${time ?? "23:59"}:00`);
      const isUpcoming = ["pending", "confirmed", "postponed"].includes(appointment.status as string) && effectiveDateTime >= now;

      return {
        ...appointment,
        service,
        offer,
        displayTitle: service?.name ?? offer?.title ?? "—",
        displayPrice: service?.price_dzd ?? offer?.offer_price ?? null,
        displayTime: time,
        isUpcoming,
      };
    });

    const upcoming = enriched.filter((appointment) => appointment.isUpcoming);
    const past = enriched.filter((appointment) => !appointment.isUpcoming);
    return { client, upcoming, past, invoices: invoices ?? [] };
  });

// Book an offer: creates an appointment with offer_id; admin sets the time later
export const bookOffer = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        offerId: z.string().uuid(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        clientId: z.string().uuid().optional(),
        fullName: z.string().min(2).max(120).optional(),
        age: z.number().int().min(8).max(110).optional(),
        phone: z.string().min(6).max(30).optional(),
        address: z.string().trim().min(2).max(200).optional(),
        gender: z.enum(["male", "female"]).optional(),
      })
      .parse(d)
  )
  .handler(async ({ data }) => {
    const sb = admin();
    const { data: offer } = await sb.from("offers").select("*").eq("id", data.offerId).maybeSingle();
    if (!offer || !offer.active) throw new Error("Offre introuvable");
    const allowed = (offer as { available_dates?: string[] }).available_dates ?? [];
    if (allowed.length > 0 && !allowed.includes(data.date)) {
      throw new Error("Date non disponible pour cette offre");
    }
    const offerGender = (offer as { gender_target?: string }).gender_target ?? "both";

    let clientId = data.clientId;
    let code: string | null = null;
    let isNew = false;
    let clientGender: "male" | "female" | null = null;
    if (!clientId) {
      if (!data.fullName || !data.phone || !data.address || !data.gender) throw new Error("Informations manquantes");
      clientGender = data.gender;
      const { data: genCode } = await sb.rpc("generate_client_code");
      code = genCode as string;
      const { data: created, error } = await sb
        .from("clients")
        .insert({ full_name: data.fullName, age: data.age ?? null, phone: data.phone, address: data.address, gender: data.gender, code })
        .select()
        .single();
      if (error || !created) throw new Error(error?.message ?? "Erreur création");
      clientId = created.id;
      isNew = true;
    } else {
      const { data: existing } = await sb.from("clients").select("code, gender").eq("id", clientId).single();
      code = existing?.code ?? null;
      clientGender = ((existing as { gender?: string | null } | null)?.gender as "male" | "female" | null) ?? null;
    }

    if (offerGender !== "both" && clientGender && offerGender !== clientGender) {
      throw new Error(offerGender === "female" ? "GENDER_FEMALE_ONLY" : "GENDER_MALE_ONLY");
    }

    const { error: insertErr } = await sb.from("appointments").insert({
      client_id: clientId!,
      offer_id: data.offerId,
      appointment_date: data.date,
      appointment_time: null,
      status: "pending",
      notes: `Offre: ${offer.title}`,
    });
    if (insertErr) throw new Error(insertErr.message);

    return { clientId, code, isNew, offerTitle: offer.title, date: data.date };
  });

// Public: list active products with images for booking page
export const listPublicProducts = createServerFn({ method: "GET" }).handler(async () => {
  const sb = admin();
  const { data } = await sb.from("products").select("*").eq("active", true).order("name");
  return { items: data ?? [] };
});
