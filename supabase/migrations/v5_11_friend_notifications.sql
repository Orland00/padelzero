-- ═══════════════════════════════════════════════════════════
-- PadelZero — V5-11 FRIEND REQUEST NOTIFICATIONS
-- Real-time notifications for friend requests and other events
-- ═══════════════════════════════════════════════════════════

-- Create notifications table
create table if not exists public.notifications (
  id uuid primary key default uuid_generate_v4(),
  recipient_id uuid not null references auth.users(id) on delete cascade,
  sender_id uuid references auth.users(id) on delete cascade,
  type text not null default 'friend_request', -- friend_request, match_result, achievement, etc.
  title text not null,
  message text,
  data jsonb default '{}', -- Store additional data like friendship_id, match_id, etc.
  is_read boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  constraint notification_type_check check (type in ('friend_request', 'match_result', 'achievement', 'liga_event', 'general'))
);

-- Create index for fast lookups
create index if not exists idx_notifications_recipient on public.notifications(recipient_id);
create index if not exists idx_notifications_unread on public.notifications(recipient_id, is_read) where is_read = false;

-- Enable RLS
alter table public.notifications enable row level security;

-- RLS: Users can only see their own notifications
drop policy if exists "Users can view own notifications" on public.notifications;
create policy "Users can view own notifications"
  on public.notifications for select
  using (recipient_id = auth.uid());

-- RLS: System can insert notifications
drop policy if exists "System can insert notifications" on public.notifications;
create policy "System can insert notifications"
  on public.notifications for insert
  with check (true);

-- RLS: Users can update their own read status
drop policy if exists "Users can update own notification read status" on public.notifications;
create policy "Users can update own notification read status"
  on public.notifications for update
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

-- RLS: Users can delete their own notifications
drop policy if exists "Users can delete own notifications" on public.notifications;
create policy "Users can delete own notifications"
  on public.notifications for delete
  using (recipient_id = auth.uid());

-- Function to automatically create friend request notification
create or replace function public.notify_friend_request()
returns trigger as $$
begin
  if new.status = 'pending' then
    insert into public.notifications (
      recipient_id,
      sender_id,
      type,
      title,
      message,
      data
    ) values (
      new.addressee_id,
      new.requester_id,
      'friend_request',
      'Nueva solicitud de amistad',
      'alguien te ha enviado una solicitud de amistad',
      jsonb_build_object(
        'friendship_id', new.id,
        'requester_id', new.requester_id
      )
    );
  end if;
  return new;
end;
$$ language plpgsql security definer;

-- Drop trigger if it exists
drop trigger if exists trigger_notify_friend_request on public.friendships;

-- Create trigger for friend requests
create trigger trigger_notify_friend_request
after insert on public.friendships
for each row
execute function public.notify_friend_request();

-- Function to mark all notifications as read
create or replace function public.mark_notifications_read(user_id uuid)
returns void as $$
begin
  update public.notifications
  set is_read = true, updated_at = now()
  where recipient_id = user_id and is_read = false;
end;
$$ language plpgsql security definer;
