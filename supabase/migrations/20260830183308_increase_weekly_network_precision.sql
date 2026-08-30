-- Amplia apenas a escala decimal; não remove nem arredonda dados existentes.
alter table public.weekly_progress
  alter column network_approved_m type numeric(14,3) using network_approved_m::numeric(14,3),
  alter column network_executed_m type numeric(14,3) using network_executed_m::numeric(14,3);
