
-- ═══════════════════════════════════════════════════════════
-- PadelZero — V7-02 FIX LIGA RLS RECURSION & ADMIN INVITES
-- ═══════════════════════════════════════════════════════════

-- 1. Helper Function to check admin status without recursion (Security Definer)
create or replace function public.is_liga_admin(v_liga_id uuid, v_user_id uuid)
returns boolean as $$
begin
  return exists (
    select 1 from public.liga_members
    where liga_id = v_liga_id
    and player_id = v_user_id
    and role = 'admin'
  );
end;
$$ language plpgsql security definer;

-- 2. Fix liga_members policies
drop policy if exists "Members can read liga members" on public.liga_members;
drop policy if exists "Users can join ligas" on public.liga_members;
drop policy if exists "Admin or self can delete membership" on public.liga_members;

-- Everyone can see who is in the league (requirement: public tournament)
create policy "Anyone can read liga members" 
on public.liga_members for select 
using (true);

-- Admins can invite others, users can join themselves
create policy "Admins can invite or users can join" 
on public.liga_members for insert 
with check (
  auth.uid() = player_id 
  or public.is_liga_admin(liga_id, auth.uid())
);

-- Admins can update status (invite -> active) or roles
create policy "Admins can update members" 
on public.liga_members for update 
using (public.is_liga_admin(liga_id, auth.uid()));

-- Admins can remove members, players can leave
create policy "Admins can kick or users can leave" 
on public.liga_members for delete 
using (
  auth.uid() = player_id 
  or public.is_liga_admin(liga_id, auth.uid())
);


-- 3. Fix jornadas policies (Remove recursion)
drop policy if exists "Members can read jornadas" on public.jornadas;
drop policy if exists "Admin can create jornadas" on public.jornadas;
drop policy if exists "Admin can update jornadas" on public.jornadas;

create policy "Anyone can read jornadas" 
on public.jornadas for select 
using (true);

create policy "Admins can manage jornadas" 
on public.jornadas for all 
using (public.is_liga_admin(liga_id, auth.uid()));


-- 4. Fix standings policies
drop policy if exists "Anyone can read standings" on public.liga_standings;
drop policy if exists "Admin can manage standings" on public.liga_standings;

create policy "Anyone can read standings" 
on public.liga_standings for select 
using (true);

create policy "Admins can manage standings" 
on public.liga_standings for all 
using (public.is_liga_admin(liga_id, auth.uid()));


-- 5. Fix crown_history policies
drop policy if exists "Anyone can read crown history" on public.crown_history;
drop policy if exists "Admin can insert crown history" on public.crown_history;

create policy "Anyone can read crown history" 
on public.crown_history for select 
using (true);

create policy "Admins can manage crown history" 
on public.crown_history for all 
using (public.is_liga_admin(liga_id, auth.uid()));


-- Update PostgREST schema cache
notify pgrst, 'reload schema';
