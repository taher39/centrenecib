CREATE TABLE IF NOT EXISTS public.report_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.medical_reports(id) ON DELETE CASCADE,
  note text NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.report_notes TO authenticated;
GRANT ALL ON public.report_notes TO service_role;
ALTER TABLE public.report_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view report_notes" ON public.report_notes FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), 'reports'::permission_scope, 'view'::permission_action));
CREATE POLICY "Staff insert report_notes" ON public.report_notes FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(), 'reports'::permission_scope, 'edit'::permission_action));
CREATE POLICY "Staff update report_notes" ON public.report_notes FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(), 'reports'::permission_scope, 'edit'::permission_action));
CREATE POLICY "Staff delete report_notes" ON public.report_notes FOR DELETE TO authenticated
  USING (public.has_permission(auth.uid(), 'reports'::permission_scope, 'delete'::permission_action));
