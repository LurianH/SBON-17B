-- Preserve legacy engineering values; new weekly entries record execution only.
-- Existing CHECK (value >= 0) constraints allow NULL and remain unchanged.
alter table public.weekly_progress
  alter column economies_available drop not null,
  alter column network_approved_m drop not null;
