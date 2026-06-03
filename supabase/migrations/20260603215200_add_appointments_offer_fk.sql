alter table public.appointments
  add constraint appointments_offer_id_fkey
  foreign key (offer_id) references public.offers(id);
