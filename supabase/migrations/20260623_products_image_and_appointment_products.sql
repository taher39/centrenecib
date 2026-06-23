-- Add image_url to products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS image_url text;

-- Create appointment_products pivot table
CREATE TABLE IF NOT EXISTS public.appointment_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id),
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric(12,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointment_products TO authenticated;
GRANT ALL ON public.appointment_products TO service_role;
ALTER TABLE public.appointment_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view appointment_products" ON public.appointment_products FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), 'products'::permission_scope, 'view'::permission_action));
CREATE POLICY "Staff insert appointment_products" ON public.appointment_products FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(), 'products'::permission_scope, 'edit'::permission_action));
CREATE POLICY "Staff update appointment_products" ON public.appointment_products FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(), 'products'::permission_scope, 'edit'::permission_action));
CREATE POLICY "Staff delete appointment_products" ON public.appointment_products FOR DELETE TO authenticated
  USING (public.has_permission(auth.uid(), 'products'::permission_scope, 'delete'::permission_action));

-- RPC functions for stock management
CREATE OR REPLACE FUNCTION public.decrement_product_stock(p_product_id uuid, p_quantity integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.products SET stock = GREATEST(0, stock - p_quantity) WHERE id = p_product_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_product_stock(p_product_id uuid, p_quantity integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.products SET stock = stock + p_quantity WHERE id = p_product_id;
END;
$$;
