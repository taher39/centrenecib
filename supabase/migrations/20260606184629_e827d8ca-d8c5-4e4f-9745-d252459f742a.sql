
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS gender text CHECK (gender IN ('male','female'));
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS attendance text CHECK (attendance IN ('present','absent'));

CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  price numeric(12,2) NOT NULL DEFAULT 0,
  stock integer,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view products" ON public.products FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), 'products'::permission_scope, 'view'::permission_action));
CREATE POLICY "Staff insert products" ON public.products FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(), 'products'::permission_scope, 'edit'::permission_action));
CREATE POLICY "Staff update products" ON public.products FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(), 'products'::permission_scope, 'edit'::permission_action));
CREATE POLICY "Staff delete products" ON public.products FOR DELETE TO authenticated
  USING (public.has_permission(auth.uid(), 'products'::permission_scope, 'delete'::permission_action));
CREATE TRIGGER products_touch BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.products(id);

CREATE TABLE IF NOT EXISTS public.medical_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL UNIQUE REFERENCES public.clients(id) ON DELETE CASCADE,
  diagnosis text,
  description text,
  recommendations text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.medical_reports TO authenticated;
GRANT ALL ON public.medical_reports TO service_role;
ALTER TABLE public.medical_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view reports" ON public.medical_reports FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), 'reports'::permission_scope, 'view'::permission_action));
CREATE POLICY "Staff insert reports" ON public.medical_reports FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(), 'reports'::permission_scope, 'edit'::permission_action));
CREATE POLICY "Staff update reports" ON public.medical_reports FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(), 'reports'::permission_scope, 'edit'::permission_action));
CREATE POLICY "Staff delete reports" ON public.medical_reports FOR DELETE TO authenticated
  USING (public.has_permission(auth.uid(), 'reports'::permission_scope, 'delete'::permission_action));
CREATE TRIGGER medical_reports_touch BEFORE UPDATE ON public.medical_reports FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
