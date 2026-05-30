
-- Restrict center_settings to staff only (public site reads via service-role server fn)
DROP POLICY IF EXISTS "Public read settings" ON public.center_settings;
CREATE POLICY "Staff read settings"
ON public.center_settings
FOR SELECT
TO authenticated
USING (is_authenticated_staff(auth.uid()));

-- Add UPDATE policy for storage objects in gallery/offers buckets
CREATE POLICY "Staff update bucket files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id IN ('gallery','offers') AND is_authenticated_staff(auth.uid()))
WITH CHECK (bucket_id IN ('gallery','offers') AND is_authenticated_staff(auth.uid()));
