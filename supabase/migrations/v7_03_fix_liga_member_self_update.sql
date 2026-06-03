
-- ═══════════════════════════════════════════════════════════
-- PadelZero — V7-03 LIGA MEMBER SELF-UPDATE RLS
-- Allows players to accept invitations by updating their status
-- ═══════════════════════════════════════════════════════════

-- Drop the overly restrictive admin-only policy if it exists
drop policy if exists "Admins can update members" on public.liga_members;

-- 1. Allow admins to update anything (roles, status)
create policy "Admins can update members" 
on public.liga_members for update 
using (public.is_liga_admin(liga_id, auth.uid()));

-- 2. Allow players to update their OWN status to 'active' if they were invited
-- This is critical for the "Accept" button in notifications to work.
create policy "Users can accept their own invites" 
on public.liga_members for update 
using (auth.uid() = player_id)
with check (
  (status = 'active' or status = 'rejected') -- Can only transition to these
);

-- Update PostgREST schema cache
notify pgrst, 'reload schema';
