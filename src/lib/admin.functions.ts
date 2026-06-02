import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function admin() {
  return createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

type PermScope = "appointments" | "clients" | "services" | "offers" | "gallery" | "invoices" | "finance" | "discounts";
type PermAction = "view" | "edit" | "delete";

async function isAdminUser(userId: string) {
  const sb = admin();
  const { data } = await sb.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  return !!data;
}

async function requirePerm(userId: string, scope: PermScope, action: PermAction) {
  if (await isAdminUser(userId)) return;
  const sb = admin();
  const { data } = await sb.from("staff_permissions").select("id").eq("user_id", userId).eq("scope", scope).eq("action", action).maybeSingle();
  if (!data) throw new Error("Permission refusée");
}

async function requireAdmin(userId: string) {
  if (!(await isAdminUser(userId))) throw new Error("Réservé à l'administrateur");
}

async function logActivity(
  actorId: string,
  actorName: string | null,
  action: string,
  entity: string,
  entityId?: string,
  details?: Record<string, unknown>
) {
  const sb = admin();
  await sb.from("activity_log").insert({
    actor_id: actorId,
    actor_name: actorName ?? null,
    action,
    entity,
    entity_id: entityId ?? null,
    details: (details as never) ?? null,
  });
}

// ===== Bootstrap initial admin =====
export const bootstrapAdmin = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        username: z.string().min(3).max(40).regex(/^[a-zA-Z0-9_.-]+$/),
        password: z.string().min(6).max(120),
        displayName: z.string().min(1).max(80).optional(),
      })
      .parse(d)
  )
  .handler(async () => {
    // Bootstrap is permanently disabled — initial admin already exists.
    throw new Error("Inscription désactivée");
  });

// ===== Me =====
export const me = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = admin();
    const { data: roles } = await sb.from("user_roles").select("*").eq("user_id", context.userId);
    const { data: perms } = await sb.from("staff_permissions").select("*").eq("user_id", context.userId);
    const isAdmin = (roles ?? []).some((r) => r.role === "admin");
    const myName = roles?.[0]?.display_name ?? roles?.[0]?.username ?? null;
    return { userId: context.userId, isAdmin, perms: perms ?? [], displayName: myName };
  });

// ===== Appointments =====
export const adminAppointments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const sb = admin();
    const { data } = await sb
      .from("appointments")
      .select("*, clients(id, full_name, phone, code), services(id, name, price_dzd, duration_min), offers(id, title, offer_price)")
      .order("appointment_date", { ascending: false })
      .order("appointment_time", { ascending: true });
    return { items: data ?? [] };
  });

export const setAppointmentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["pending", "confirmed", "completed", "cancelled", "postponed"]),
        newDate: z.string().optional(),
        newTime: z.string().optional(),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    await requirePerm(context.userId, "appointments", "edit");
    const sb = admin();
    const update: {
      status: typeof data.status;
      is_read: boolean;
      appointment_date?: string;
      appointment_time?: string;
    } = { status: data.status, is_read: true };
    if (data.newDate) update.appointment_date = data.newDate;
    if (data.newTime) update.appointment_time = data.newTime.length === 5 ? data.newTime + ":00" : data.newTime;
    const { data: appt } = await sb.from("appointments").update(update).eq("id", data.id).select("*, services(name, price_dzd), offers(title, offer_price)").single();

    // Auto-generate invoice on completion
    if (data.status === "completed" && appt) {
      const a = appt as { services?: { name?: string; price_dzd?: number }; offers?: { title?: string; offer_price?: number }; client_id: string };
      const price = Number(a.offers?.offer_price ?? a.services?.price_dzd ?? 0);
      const svcName = a.offers?.title ?? a.services?.name ?? "Soin";
      const { data: inv } = await sb
        .from("invoices")
        .insert({
          client_id: a.client_id,
          appointment_id: data.id,
          subtotal: price,
          total: price,
          amount_paid: 0,
        })
        .select()
        .single();
      if (inv) {
        await sb.from("invoice_items").insert({
          invoice_id: inv.id,
          service_name: svcName,
          quantity: 1,
          unit_price: price,
          total: price,
        });
      }
    }
    await logActivity(context.userId, null, `appointment_${data.status}`, "appointment", data.id);
    return { ok: true };
  });

export const markAppointmentRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requirePerm(context.userId, "appointments", "edit");
    const sb = admin();
    await sb.from("appointments").update({ is_read: true }).eq("id", data.id);
    return { ok: true };
  });

export const deleteAppointment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requirePerm(context.userId, "appointments", "delete");
    const sb = admin();
    await sb.from("appointments").delete().eq("id", data.id);
    await logActivity(context.userId, null, "delete", "appointment", data.id);
    return { ok: true };
  });

// ===== Services =====
const serviceSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  name_fr: z.string().max(120).optional().nullable(),
  name_en: z.string().max(120).optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  duration_min: z.number().int().min(5).max(480),
  price_dzd: z.number().min(0),
  capacity: z.number().int().min(1).max(20),
  available_days: z.array(z.number().int().min(0).max(6)),
  active: z.boolean().optional(),
});

export const adminListServices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const sb = admin();
    const { data } = await sb.from("services").select("*").order("created_at");
    return { items: data ?? [] };
  });

export const saveService = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => serviceSchema.parse(d))
  .handler(async ({ data, context }) => {
    await requirePerm(context.userId, "services", "edit");
    const sb = admin();
    const { id, ...rest } = data;
    if (id) {
      await sb.from("services").update(rest).eq("id", id);
      await logActivity(context.userId, null, "update", "service", id);
    } else {
      const { data: created } = await sb.from("services").insert(rest).select().single();
      await logActivity(context.userId, null, "create", "service", created?.id);
    }
    return { ok: true };
  });

export const deleteService = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requirePerm(context.userId, "services", "delete");
    const sb = admin();
    await sb.from("services").delete().eq("id", data.id);
    await logActivity(context.userId, null, "delete", "service", data.id);
    return { ok: true };
  });

// ===== Working Hours =====
export const listWorkingHours = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const sb = admin();
    const { data } = await sb.from("working_hours").select("*").order("position");
    return { items: data ?? [] };
  });

export const saveWorkingHours = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        slots: z.array(
          z.object({
            label: z.string().max(40).optional().nullable(),
            start_time: z.string().regex(/^\d{2}:\d{2}$/),
            end_time: z.string().regex(/^\d{2}:\d{2}$/),
          })
        ),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    await requirePerm(context.userId, "services", "edit");
    const sb = admin();
    await sb.from("working_hours").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (data.slots.length) {
      await sb.from("working_hours").insert(
        data.slots.map((s, i) => ({
          label: s.label ?? null,
          start_time: s.start_time + ":00",
          end_time: s.end_time + ":00",
          position: i,
        }))
      );
    }
    await logActivity(context.userId, null, "update", "working_hours");
    return { ok: true };
  });

// ===== Clients =====
export const adminListClients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const sb = admin();
    const { data: clients } = await sb.from("clients").select("*").order("created_at", { ascending: false });
    const { data: pending } = await sb.from("appointments").select("client_id").eq("status", "pending");
    const pendingSet = new Set((pending ?? []).map((p) => p.client_id));
    const items = (clients ?? [])
      .map((c) => ({ ...c, hasPending: pendingSet.has(c.id) }))
      .sort((a, b) => {
        const ad = Number(a.debt) > 0 ? 0 : a.hasPending ? 1 : 2;
        const bd = Number(b.debt) > 0 ? 0 : b.hasPending ? 1 : 2;
        return ad - bd;
      });
    return { items };
  });

export const clientDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const sb = admin();
    const [{ data: client }, { data: appts }, { data: invoices }] = await Promise.all([
      sb.from("clients").select("*").eq("id", data.id).single(),
      sb.from("appointments").select("*, services(name, price_dzd)").eq("client_id", data.id).order("appointment_date", { ascending: false }),
      sb.from("invoices").select("*, invoice_items(*)").eq("client_id", data.id).order("issued_at", { ascending: false }),
    ]);
    return { client, appts: appts ?? [], invoices: invoices ?? [] };
  });

export const saveClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        full_name: z.string().min(2).max(120),
        age: z.number().int().min(8).max(110).nullable(),
        phone: z.string().min(6).max(30),
        notes: z.string().max(2000).optional().nullable(),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    await requirePerm(context.userId, "clients", "edit");
    const sb = admin();
    const { id, ...rest } = data;
    await sb.from("clients").update(rest).eq("id", id);
    await logActivity(context.userId, null, "update", "client", id);
    return { ok: true };
  });

export const deleteClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requirePerm(context.userId, "clients", "delete");
    const sb = admin();
    await sb.from("appointments").delete().eq("client_id", data.id);
    await sb.from("invoices").delete().eq("client_id", data.id);
    await sb.from("clients").delete().eq("id", data.id);
    await logActivity(context.userId, null, "delete", "client", data.id);
    return { ok: true };
  });

// ===== Offers =====
export const adminListOffers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const sb = admin();
    const { data } = await sb.from("offers").select("*").order("created_at", { ascending: false });
    return { items: data ?? [] };
  });

export const saveOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        title: z.string().min(1).max(120),
        description: z.string().max(500).optional().nullable(),
        image_url: z.string().url().optional().nullable(),
        original_price: z.number().min(0).optional().nullable(),
        offer_price: z.number().min(0),
        ends_at: z.string(),
        active: z.boolean().optional(),
        available_dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).max(60).optional(),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    await requirePerm(context.userId, "offers", "edit");
    const sb = admin();
    const { id, ...rest } = data;
    if (id) {
      await sb.from("offers").update(rest).eq("id", id);
    } else {
      await sb.from("offers").insert(rest);
    }
    await logActivity(context.userId, null, id ? "update" : "create", "offer", id);
    return { ok: true };
  });

export const deleteOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requirePerm(context.userId, "offers", "delete");
    const sb = admin();
    await sb.from("offers").delete().eq("id", data.id);
    await logActivity(context.userId, null, "delete", "offer", data.id);
    return { ok: true };
  });

export const uploadAdminImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        bucket: z.enum(["gallery", "offers"]),
        fileName: z.string().min(1).max(200),
        mimeType: z.string().min(1).max(120),
        dataUrl: z.string().min(32).max(12_000_000),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    const scope = data.bucket === "gallery" ? "gallery" : "offers";
    await requirePerm(context.userId, scope, "edit");

    const match = data.dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!match) throw new Error("Image invalide");

    const mimeType = match[1].toLowerCase();
    const base64 = match[2];
    const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);
    if (!allowedMimeTypes.has(mimeType)) {
      throw new Error("Format d'image non pris en charge");
    }

    const bytes = Buffer.from(base64, "base64");
    if (!bytes.byteLength) throw new Error("Image vide");
    if (bytes.byteLength > 6 * 1024 * 1024) {
      throw new Error("L'image dépasse la taille autorisée");
    }

    const extByMime: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/gif": "gif",
      "image/avif": "avif",
    };
    const safeBaseName = data.fileName
      .replace(/\.[^.]+$/, "")
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "image";
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${safeBaseName}.${extByMime[mimeType]}`;

    const sb = admin();
    const { error } = await sb.storage.from(data.bucket).upload(path, bytes, {
      cacheControl: "3600",
      contentType: mimeType,
      upsert: false,
    });
    if (error) throw new Error(error.message);

    const { data: publicData } = sb.storage.from(data.bucket).getPublicUrl(path);
    return { url: publicData.publicUrl, path };
  });

// ===== Gallery =====
export const adminListGallery = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const sb = admin();
    const { data } = await sb.from("gallery_images").select("*").order("position");
    return { items: data ?? [] };
  });

export const addGalleryImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ image_url: z.string().url(), caption: z.string().max(120).optional().nullable() }).parse(d)
  )
  .handler(async ({ data, context }) => {
    await requirePerm(context.userId, "gallery", "edit");
    const sb = admin();
    const { count } = await sb.from("gallery_images").select("*", { count: "exact", head: true });
    await sb.from("gallery_images").insert({ image_url: data.image_url, caption: data.caption ?? null, position: count ?? 0 });
    await logActivity(context.userId, null, "create", "gallery");
    return { ok: true };
  });

export const deleteGalleryImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requirePerm(context.userId, "gallery", "delete");
    const sb = admin();
    await sb.from("gallery_images").delete().eq("id", data.id);
    await logActivity(context.userId, null, "delete", "gallery", data.id);
    return { ok: true };
  });

// ===== Invoices =====
export const adminListInvoices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const sb = admin();
    const { data } = await sb
      .from("invoices")
      .select("*, clients(full_name, phone), invoice_items(*)")
      .order("issued_at", { ascending: false });
    return { items: data ?? [] };
  });

export const updateInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        discount: z.number().min(0).optional(),
        amount_paid: z.number().min(0).optional(),
        payment_type: z.enum(["full", "partial"]).optional(),
        notes: z.string().max(500).optional().nullable(),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    await requirePerm(context.userId, "invoices", "edit");
    const sb = admin();
    const { id, ...rest } = data;
    const { data: inv } = await sb.from("invoices").select("*").eq("id", id).single();
    if (!inv) throw new Error("Facture introuvable");
    const discount = rest.discount ?? Number(inv.discount);
    const subtotal = Number(inv.subtotal);
    const total = Math.max(0, subtotal - discount);
    const amount_paid = rest.amount_paid ?? Number(inv.amount_paid);
    const payment_type = rest.payment_type ?? (amount_paid >= total ? "full" : "partial");
    await sb.from("invoices").update({ ...rest, discount, total, amount_paid, payment_type }).eq("id", id);
    // Recompute client debt
    const { data: clientInvoices } = await sb.from("invoices").select("total, amount_paid").eq("client_id", inv.client_id);
    const debt = (clientInvoices ?? []).reduce((acc, i) => acc + (Number(i.total) - Number(i.amount_paid)), 0);
    await sb.from("clients").update({ debt: Math.max(0, debt) }).eq("id", inv.client_id);
    // Record discount
    if (rest.discount && rest.discount > 0) {
      const { data: client } = await sb.from("clients").select("full_name").eq("id", inv.client_id).single();
      await sb.from("discounts").insert({
        invoice_id: id,
        client_id: inv.client_id,
        client_name: client?.full_name ?? "—",
        invoice_number: inv.number,
        amount: rest.discount,
      });
    }
    await logActivity(context.userId, null, "update", "invoice", id);
    return { ok: true };
  });

export const deleteInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requirePerm(context.userId, "invoices", "delete");
    const sb = admin();
    await sb.from("invoices").delete().eq("id", data.id);
    await logActivity(context.userId, null, "delete", "invoice", data.id);
    return { ok: true };
  });

// ===== Discounts =====
export const adminListDiscounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const sb = admin();
    const { data } = await sb.from("discounts").select("*").order("created_at", { ascending: false });
    return { items: data ?? [] };
  });

// ===== Finance =====
export const finance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const sb = admin();
    const [{ data: payments }, { data: expenses }, { data: invoices }] = await Promise.all([
      sb.from("payments").select("*").order("occurred_at", { ascending: false }),
      sb.from("expenses").select("*").order("occurred_at", { ascending: false }),
      sb.from("invoices").select("amount_paid, issued_at"),
    ]);
    const invIncome = (invoices ?? []).reduce((a, i) => a + Number(i.amount_paid), 0);
    const manualIncome = (payments ?? []).reduce((a, p) => a + Number(p.amount), 0);
    const totalExp = (expenses ?? []).reduce((a, e) => a + Number(e.amount), 0);
    return {
      payments: payments ?? [],
      expenses: expenses ?? [],
      income: invIncome + manualIncome,
      expense: totalExp,
      balance: invIncome + manualIncome - totalExp,
    };
  });

export const addFinanceEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        kind: z.enum(["income", "expense"]),
        amount: z.number().min(0),
        reason: z.string().min(1).max(200),
        occurred_at: z.string().optional(),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    await requirePerm(context.userId, "finance", "edit");
    const sb = admin();
    const occurred_at = data.occurred_at ?? new Date().toISOString();
    if (data.kind === "income") {
      await sb.from("payments").insert({ amount: data.amount, reason: data.reason, occurred_at, created_by: context.userId });
    } else {
      await sb.from("expenses").insert({ amount: data.amount, reason: data.reason, occurred_at, created_by: context.userId });
    }
    await logActivity(context.userId, null, "create", data.kind);
    return { ok: true };
  });

export const deleteFinanceEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), kind: z.enum(["income", "expense"]) }).parse(d))
  .handler(async ({ data, context }) => {
    await requirePerm(context.userId, "finance", "delete");
    const sb = admin();
    await sb.from(data.kind === "income" ? "payments" : "expenses").delete().eq("id", data.id);
    await logActivity(context.userId, null, "delete", data.kind, data.id);
    return { ok: true };
  });

// ===== Settings =====
export const getSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const sb = admin();
    const { data } = await sb.from("center_settings").select("*").limit(1).maybeSingle();
    return { settings: data };
  });

export const saveSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        name: z.string().min(1).max(120),
        address: z.string().max(200).optional().nullable(),
        phone: z.string().max(40).optional().nullable(),
        email: z.string().email().optional().nullable().or(z.literal("")),
        nif: z.string().max(40).optional().nullable(),
        nis: z.string().max(40).optional().nullable(),
        rc: z.string().max(40).optional().nullable(),
        article: z.string().max(40).optional().nullable(),
        ai: z.string().max(40).optional().nullable(),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    const sb = admin();
    const { data: existing } = await sb.from("center_settings").select("id").limit(1).maybeSingle();
    const payload = { ...data, email: data.email || null };
    if (existing) await sb.from("center_settings").update(payload).eq("id", existing.id);
    else await sb.from("center_settings").insert(payload);
    await logActivity(context.userId, null, "update", "settings");
    return { ok: true };
  });

// ===== Staff =====
const PERM_SCOPES = ["appointments", "clients", "services", "offers", "gallery", "invoices", "finance", "discounts"] as const;
const PERM_ACTIONS = ["view", "edit", "delete"] as const;

export const listStaff = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const sb = admin();
    const { data: roles } = await sb.from("user_roles").select("*").eq("role", "secretary");
    const { data: perms } = await sb.from("staff_permissions").select("*");
    return { staff: roles ?? [], perms: perms ?? [] };
  });

export const createStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        username: z.string().min(3).max(40).regex(/^[a-zA-Z0-9_.-]+$/),
        password: z.string().min(6).max(120),
        displayName: z.string().min(1).max(80),
        permissions: z.array(z.object({ scope: z.enum(PERM_SCOPES), action: z.enum(PERM_ACTIONS) })),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    const sb = admin();
    const email = `${data.username.toLowerCase()}@nassib.local`;
    const { data: created, error } = await sb.auth.admin.createUser({ email, password: data.password, email_confirm: true });
    if (error || !created.user) throw new Error(error?.message ?? "Erreur");
    await sb.from("user_roles").insert({ user_id: created.user.id, role: "secretary", username: data.username, display_name: data.displayName });
    if (data.permissions.length) {
      await sb.from("staff_permissions").insert(data.permissions.map((p) => ({ user_id: created.user!.id, scope: p.scope, action: p.action })));
    }
    await logActivity(context.userId, null, "create", "staff", created.user.id);
    return { ok: true };
  });

export const updateStaffPermissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        permissions: z.array(z.object({ scope: z.enum(PERM_SCOPES), action: z.enum(PERM_ACTIONS) })),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    const sb = admin();
    await sb.from("staff_permissions").delete().eq("user_id", data.userId);
    if (data.permissions.length) {
      await sb.from("staff_permissions").insert(data.permissions.map((p) => ({ user_id: data.userId, scope: p.scope, action: p.action })));
    }
    await logActivity(context.userId, null, "update", "staff_permissions", data.userId);
    return { ok: true };
  });

export const deleteStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string }) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    const sb = admin();
    await sb.auth.admin.deleteUser(data.userId);
    await logActivity(context.userId, null, "delete", "staff", data.userId);
    return { ok: true };
  });

// ===== Activity =====
export const listActivity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    const sb = admin();
    const { data } = await sb.from("activity_log").select("*").order("created_at", { ascending: false }).limit(200);
    const ids = Array.from(new Set((data ?? []).map((a) => a.actor_id).filter(Boolean) as string[]));
    const { data: roles } = await sb.from("user_roles").select("user_id, display_name, username").in("user_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
    const nameMap = Object.fromEntries((roles ?? []).map((r) => [r.user_id, r.display_name ?? r.username ?? "—"]));
    return { items: (data ?? []).map((a) => ({ ...a, actor_display: a.actor_id ? nameMap[a.actor_id] ?? "—" : "—" })) };
  });

// ===== Update admin credentials =====
export const updateMyCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        newDisplayName: z.string().min(1).max(80).optional(),
        newUsername: z.string().min(3).max(40).regex(/^[a-zA-Z0-9_.-]+$/).optional(),
        newPassword: z.string().min(6).max(120).optional(),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    const sb = admin();
    const updates: Record<string, unknown> = {};
    if (data.newUsername) updates.email = `${data.newUsername.toLowerCase()}@nassib.local`;
    if (data.newPassword) updates.password = data.newPassword;
    if (Object.keys(updates).length) await sb.auth.admin.updateUserById(context.userId, updates);
    const roleUpdate: { username?: string; display_name?: string } = {};
    if (data.newUsername) roleUpdate.username = data.newUsername;
    if (data.newDisplayName) roleUpdate.display_name = data.newDisplayName;
    if (Object.keys(roleUpdate).length) await sb.from("user_roles").update(roleUpdate).eq("user_id", context.userId);
    await logActivity(context.userId, null, "update", "credentials");
    return { ok: true };
  });
