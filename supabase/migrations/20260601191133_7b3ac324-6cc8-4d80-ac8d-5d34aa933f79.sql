-- Allow appointments to be created from an offer with the time set by admin later
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS offer_id uuid;
ALTER TABLE public.appointments ALTER COLUMN service_id DROP NOT NULL;
ALTER TABLE public.appointments ALTER COLUMN appointment_time DROP NOT NULL;
ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_service_or_offer_chk
  CHECK (service_id IS NOT NULL OR offer_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_appointments_offer_id ON public.appointments(offer_id);