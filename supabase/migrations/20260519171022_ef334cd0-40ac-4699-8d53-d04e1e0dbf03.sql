
-- ============================================================
-- ENUMS
-- ============================================================
CREATE TYPE public.app_role AS ENUM ('admin', 'secretary');
CREATE TYPE public.appointment_status AS ENUM ('pending', 'confirmed', 'completed', 'cancelled', 'postponed');
CREATE TYPE public.payment_type AS ENUM ('full', 'partial');
CREATE TYPE public.permission_scope AS ENUM (
  'appointments', 'clients', 'services', 'invoices', 'finance',
  'discounts', 'offers', 'gallery', 'staff', 'activity', 'settings'
);
CREATE TYPE public.permission_action AS ENUM ('view', 'edit', 'delete');

-- ============================================================
-- USER ROLES
-- ============================================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  display_name TEXT,
  username TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_authenticated_staff(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id)
$$;

CREATE POLICY "Staff can view roles" ON public.user_roles FOR SELECT TO authenticated
USING (public.is_authenticated_staff(auth.uid()));
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- STAFF PERMISSIONS (for secretaries)
-- ============================================================
CREATE TABLE public.staff_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  scope public.permission_scope NOT NULL,
  action public.permission_action NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, scope, action)
);
ALTER TABLE public.staff_permissions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_permission(_user_id UUID, _scope public.permission_scope, _action public.permission_action)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin')
      OR EXISTS (SELECT 1 FROM public.staff_permissions
                 WHERE user_id = _user_id AND scope = _scope AND action = _action)
$$;

CREATE POLICY "Staff view own perms" ON public.staff_permissions FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage perms" ON public.staff_permissions FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- CENTER SETTINGS (singleton-ish for invoice header)
-- ============================================================
CREATE TABLE public.center_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'Centre Nassib',
  address TEXT,
  phone TEXT,
  email TEXT,
  nif TEXT,
  nis TEXT,
  rc TEXT,
  ai TEXT,
  article TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.center_settings ENABLE ROW LEVEL SECURITY;
INSERT INTO public.center_settings (name) VALUES ('Centre Nassib');

CREATE POLICY "Public read settings" ON public.center_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admin write settings" ON public.center_settings FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- CLIENTS
-- ============================================================
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE CHECK (code ~ '^[0-9]{10}$'),
  full_name TEXT NOT NULL,
  age INT,
  phone TEXT NOT NULL,
  notes TEXT,
  debt NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE INDEX clients_phone_idx ON public.clients(phone);
CREATE INDEX clients_name_idx ON public.clients(full_name);

CREATE POLICY "Staff view clients" ON public.clients FOR SELECT TO authenticated
USING (public.has_permission(auth.uid(), 'clients', 'view'));
CREATE POLICY "Staff edit clients" ON public.clients FOR UPDATE TO authenticated
USING (public.has_permission(auth.uid(), 'clients', 'edit'));
CREATE POLICY "Staff insert clients" ON public.clients FOR INSERT TO authenticated
WITH CHECK (public.has_permission(auth.uid(), 'clients', 'edit'));
CREATE POLICY "Staff delete clients" ON public.clients FOR DELETE TO authenticated
USING (public.has_permission(auth.uid(), 'clients', 'delete'));

-- ============================================================
-- SERVICES
-- ============================================================
CREATE TABLE public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_fr TEXT,
  name_en TEXT,
  description TEXT,
  duration_min INT NOT NULL CHECK (duration_min > 0),
  price_dzd NUMERIC(12,2) NOT NULL CHECK (price_dzd >= 0),
  capacity INT NOT NULL DEFAULT 1 CHECK (capacity > 0),
  available_days INT[] NOT NULL DEFAULT ARRAY[0,1,2,3,4,5,6], -- 0=Sun..6=Sat
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read services" ON public.services FOR SELECT TO anon, authenticated USING (active = true OR public.is_authenticated_staff(auth.uid()));
CREATE POLICY "Staff manage services" ON public.services FOR ALL TO authenticated
USING (public.has_permission(auth.uid(), 'services', 'edit'))
WITH CHECK (public.has_permission(auth.uid(), 'services', 'edit'));

-- ============================================================
-- WORKING HOURS
-- ============================================================
CREATE TABLE public.working_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  position INT NOT NULL DEFAULT 0,
  CHECK (end_time > start_time)
);
ALTER TABLE public.working_hours ENABLE ROW LEVEL SECURITY;
INSERT INTO public.working_hours (label, start_time, end_time, position) VALUES
  ('Matin', '09:00', '12:00', 0),
  ('Après-midi', '14:00', '17:00', 1);

CREATE POLICY "Public read hours" ON public.working_hours FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Staff manage hours" ON public.working_hours FOR ALL TO authenticated
USING (public.has_permission(auth.uid(), 'services', 'edit'))
WITH CHECK (public.has_permission(auth.uid(), 'services', 'edit'));

-- ============================================================
-- APPOINTMENTS
-- ============================================================
CREATE TABLE public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  service_id UUID REFERENCES public.services(id) NOT NULL,
  appointment_date DATE NOT NULL,
  appointment_time TIME NOT NULL,
  status public.appointment_status NOT NULL DEFAULT 'pending',
  is_read BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  group_id UUID, -- pour grouper plusieurs réservations d'un même client en une seule session
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
CREATE INDEX appointments_date_idx ON public.appointments(appointment_date);
CREATE INDEX appointments_client_idx ON public.appointments(client_id);
CREATE INDEX appointments_status_idx ON public.appointments(status);

CREATE POLICY "Staff view appts" ON public.appointments FOR SELECT TO authenticated
USING (public.has_permission(auth.uid(), 'appointments', 'view'));
CREATE POLICY "Staff edit appts" ON public.appointments FOR UPDATE TO authenticated
USING (public.has_permission(auth.uid(), 'appointments', 'edit'));
CREATE POLICY "Staff insert appts" ON public.appointments FOR INSERT TO authenticated
WITH CHECK (public.has_permission(auth.uid(), 'appointments', 'edit'));
CREATE POLICY "Staff delete appts" ON public.appointments FOR DELETE TO authenticated
USING (public.has_permission(auth.uid(), 'appointments', 'delete'));

-- ============================================================
-- INVOICES
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS public.invoice_number_seq START 1000;

CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number TEXT NOT NULL UNIQUE DEFAULT ('F-' || lpad(nextval('public.invoice_number_seq')::text, 6, '0')),
  client_id UUID REFERENCES public.clients(id) NOT NULL,
  appointment_id UUID REFERENCES public.appointments(id),
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_type public.payment_type NOT NULL DEFAULT 'full',
  notes TEXT,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE INDEX invoices_client_idx ON public.invoices(client_id);

CREATE POLICY "Staff view invoices" ON public.invoices FOR SELECT TO authenticated
USING (public.has_permission(auth.uid(), 'invoices', 'view'));
CREATE POLICY "Staff edit invoices" ON public.invoices FOR UPDATE TO authenticated
USING (public.has_permission(auth.uid(), 'invoices', 'edit'));
CREATE POLICY "Staff insert invoices" ON public.invoices FOR INSERT TO authenticated
WITH CHECK (public.has_permission(auth.uid(), 'invoices', 'edit'));
CREATE POLICY "Staff delete invoices" ON public.invoices FOR DELETE TO authenticated
USING (public.has_permission(auth.uid(), 'invoices', 'delete'));

CREATE TABLE public.invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE NOT NULL,
  service_name TEXT NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  unit_price NUMERIC(12,2) NOT NULL,
  total NUMERIC(12,2) NOT NULL
);
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view items" ON public.invoice_items FOR SELECT TO authenticated
USING (public.has_permission(auth.uid(), 'invoices', 'view'));
CREATE POLICY "Staff manage items" ON public.invoice_items FOR ALL TO authenticated
USING (public.has_permission(auth.uid(), 'invoices', 'edit'))
WITH CHECK (public.has_permission(auth.uid(), 'invoices', 'edit'));

-- ============================================================
-- DISCOUNTS
-- ============================================================
CREATE TABLE public.discounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id),
  client_name TEXT NOT NULL,
  invoice_number TEXT,
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.discounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view discounts" ON public.discounts FOR SELECT TO authenticated
USING (public.has_permission(auth.uid(), 'discounts', 'view'));
CREATE POLICY "Staff manage discounts" ON public.discounts FOR ALL TO authenticated
USING (public.has_permission(auth.uid(), 'discounts', 'edit'))
WITH CHECK (public.has_permission(auth.uid(), 'discounts', 'edit'));

-- ============================================================
-- FINANCE (payments + expenses)
-- ============================================================
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  reason TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view payments" ON public.payments FOR SELECT TO authenticated
USING (public.has_permission(auth.uid(), 'finance', 'view'));
CREATE POLICY "Staff manage payments" ON public.payments FOR ALL TO authenticated
USING (public.has_permission(auth.uid(), 'finance', 'edit'))
WITH CHECK (public.has_permission(auth.uid(), 'finance', 'edit'));

CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  reason TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view expenses" ON public.expenses FOR SELECT TO authenticated
USING (public.has_permission(auth.uid(), 'finance', 'view'));
CREATE POLICY "Staff manage expenses" ON public.expenses FOR ALL TO authenticated
USING (public.has_permission(auth.uid(), 'finance', 'edit'))
WITH CHECK (public.has_permission(auth.uid(), 'finance', 'edit'));

-- ============================================================
-- OFFERS
-- ============================================================
CREATE TABLE public.offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  original_price NUMERIC(12,2),
  offer_price NUMERIC(12,2) NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read active offers" ON public.offers FOR SELECT TO anon, authenticated
USING (active = true AND ends_at > now() OR public.is_authenticated_staff(auth.uid()));
CREATE POLICY "Staff manage offers" ON public.offers FOR ALL TO authenticated
USING (public.has_permission(auth.uid(), 'offers', 'edit'))
WITH CHECK (public.has_permission(auth.uid(), 'offers', 'edit'));

-- ============================================================
-- GALLERY
-- ============================================================
CREATE TABLE public.gallery_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url TEXT NOT NULL,
  caption TEXT,
  position INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.gallery_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read gallery" ON public.gallery_images FOR SELECT TO anon, authenticated USING (active = true OR public.is_authenticated_staff(auth.uid()));
CREATE POLICY "Staff manage gallery" ON public.gallery_images FOR ALL TO authenticated
USING (public.has_permission(auth.uid(), 'gallery', 'edit'))
WITH CHECK (public.has_permission(auth.uid(), 'gallery', 'edit'));

-- ============================================================
-- ACTIVITY LOG
-- ============================================================
CREATE TABLE public.activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id),
  actor_name TEXT,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
CREATE INDEX activity_log_created_idx ON public.activity_log(created_at DESC);

CREATE POLICY "Admin reads activity" ON public.activity_log FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Staff append activity" ON public.activity_log FOR INSERT TO authenticated
WITH CHECK (actor_id = auth.uid());

-- ============================================================
-- STORAGE BUCKETS
-- ============================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('gallery', 'gallery', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('offers', 'offers', true) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read gallery bucket" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id IN ('gallery','offers'));
CREATE POLICY "Staff upload gallery" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id IN ('gallery','offers') AND public.is_authenticated_staff(auth.uid()));
CREATE POLICY "Staff delete gallery" ON storage.objects FOR DELETE TO authenticated USING (bucket_id IN ('gallery','offers') AND public.is_authenticated_staff(auth.uid()));

-- ============================================================
-- TRIGGERS
-- ============================================================
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER clients_touch BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER appts_touch BEFORE UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Auto-generate client code (10 digits)
CREATE OR REPLACE FUNCTION public.generate_client_code()
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  new_code TEXT;
  tries INT := 0;
BEGIN
  LOOP
    new_code := lpad(floor(random() * 10000000000)::bigint::text, 10, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.clients WHERE code = new_code);
    tries := tries + 1;
    IF tries > 50 THEN RAISE EXCEPTION 'Unable to generate unique code'; END IF;
  END LOOP;
  RETURN new_code;
END $$;
