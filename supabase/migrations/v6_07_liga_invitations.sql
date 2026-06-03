-- ═══════════════════════════════════════════════════════════
-- PadelZero — V6-07 LIGA INVITATIONS & NOTIFICATIONS
-- Add status column to liga_members and trigger notifications
-- ═══════════════════════════════════════════════════════════

alter table public.liga_members add column if not exists status text default 'active';
alter table public.liga_members drop constraint if exists liga_members_status_check;
alter table public.liga_members add constraint liga_members_status_check check (status in ('active', 'pending', 'invited', 'rejected'));

-- Create notification type check override if necessary to allow 'liga_invite'
alter table public.notifications drop constraint if exists notification_type_check;
alter table public.notifications add constraint notification_type_check check (type in ('friend_request', 'match_result', 'achievement', 'liga_event', 'liga_invite', 'general'));


-- Function for sending a notification when added as 'invited' to a league
create or replace function public.notify_liga_invitation()
returns trigger as $$
declare
  v_liga_name text;
begin
  if new.status = 'invited' and (tg_op = 'INSERT' or (tg_op = 'UPDATE' and old.status <> 'invited')) then
    -- Get liga name
    select name into v_liga_name from public.ligas where id = new.liga_id;
    
    insert into public.notifications (
      recipient_id,
      sender_id,
      type,
      title,
      message,
      data
    ) values (
      new.player_id,
      auth.uid(),
      'liga_invite',
      'Invitación a Liga',
      'Te han invitado a participar en ' || coalesce(v_liga_name, 'una liga'),
      jsonb_build_object(
        'liga_id', new.liga_id,
        'member_id', new.id
      )
    );
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trigger_notify_liga_invitation on public.liga_members;

create trigger trigger_notify_liga_invitation
after insert or update on public.liga_members
for each row
execute function public.notify_liga_invitation();

-- Update PostgREST schema cache
notify pgrst, 'reload schema';
