-- ========================================
-- StockandCrypto - Supabase Database Schema
-- Run this in Supabase SQL Editor
-- ========================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ==================== USERS TABLE ====================
-- Supabase Auth handles users, we extend with profiles
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique,
  avatar_url text,
  bio text,
  preferences jsonb default '{}',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.profiles enable row level security;

-- Policies
create policy "Public profiles are viewable by everyone"
  on public.profiles for select
  using (true);

create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Trigger to create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, avatar_url)
  values (new.id, new.raw_user_meta_data->>'username', new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ==================== NOTES TABLE ====================
create table if not exists public.notes (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  title text not null,
  content text,
  market text default 'General',
  tags text[] default '{}',
  is_public boolean default false,
  likes_count integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Indexes
create index if not exists notes_user_id_idx on public.notes(user_id);
create index if not exists notes_market_idx on public.notes(market);
create index if not exists notes_created_at_idx on public.notes(created_at desc);

-- Enable RLS
alter table public.notes enable row level security;

-- Policies
create policy "Users can view their own notes"
  on public.notes for select
  using (auth.uid() = user_id);

create policy "Users can view public notes"
  on public.notes for select
  using (is_public = true);

create policy "Users can create notes"
  on public.notes for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own notes"
  on public.notes for update
  using (auth.uid() = user_id);

create policy "Users can delete their own notes"
  on public.notes for delete
  using (auth.uid() = user_id);

-- ==================== LIKES TABLE ====================
create table if not exists public.likes (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  note_id uuid references public.notes on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, note_id)
);

-- Enable RLS
alter table public.likes enable row level security;

create policy "Users can view all likes"
  on public.likes for select
  using (true);

create policy "Users can like notes"
  on public.likes for insert
  with check (auth.uid() = user_id);

create policy "Users can unlike their likes"
  on public.likes for delete
  using (auth.uid() = user_id);

-- ==================== CHAT BOARDS TABLE ====================
create table if not exists public.chat_boards (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  topic text,
  description text,
  icon text,
  is_public boolean default true,
  created_by uuid references auth.users on delete set null,
  members_count integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.chat_boards enable row level security;

create policy "Public boards are viewable by everyone"
  on public.chat_boards for select
  using (is_public = true);

create policy "Users can create boards"
  on public.chat_boards for insert
  with check (auth.uid() = created_by);

-- ==================== CHAT MEMBERS TABLE ====================
create table if not exists public.chat_members (
  id uuid default uuid_generate_v4() primary key,
  board_id uuid references public.chat_boards on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  role text default 'member' check (role in ('member', 'moderator', 'admin')),
  joined_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(board_id, user_id)
);

-- Enable RLS
alter table public.chat_members enable row level security;

create policy "Users can view members of public boards"
  on public.chat_members for select
  using (
    exists (
      select 1 from public.chat_boards
      where chat_boards.id = chat_members.board_id
      and chat_boards.is_public = true
    )
  );

create policy "Users can join boards"
  on public.chat_members for insert
  with check (auth.uid() = user_id);

create policy "Users can leave boards"
  on public.chat_members for delete
  using (auth.uid() = user_id);

-- ==================== CHAT MESSAGES TABLE ====================
create table if not exists public.chat_messages (
  id uuid default uuid_generate_v4() primary key,
  board_id uuid references public.chat_boards on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Indexes
create index if not exists chat_messages_board_id_idx on public.chat_messages(board_id);
create index if not exists chat_messages_created_at_idx on public.chat_messages(created_at);

-- Enable RLS
alter table public.chat_messages enable row level security;

create policy "Users can view messages of public boards"
  on public.chat_messages for select
  using (
    exists (
      select 1 from public.chat_boards
      where chat_boards.id = chat_messages.board_id
      and chat_boards.is_public = true
    )
  );

create policy "Members can send messages"
  on public.chat_messages for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.chat_members
      where chat_members.board_id = chat_messages.board_id
      and chat_members.user_id = auth.uid()
    )
  );

-- ==================== INSERT DEFAULT BOARDS ====================
insert into public.chat_boards (id, name, topic, description, icon, is_public) values
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Crypto General', 'All things cryptocurrency', 'Discuss Bitcoin, Ethereum, altcoins, and the broader crypto market', 'â‚¿', true),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'Bitcoin', 'BTC price analysis and discussion', 'Bitcoin-specific discussions, price analysis, and news', 'â‚¿', true),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 'Ethereum', 'ETH and DeFi ecosystem', 'Ethereum, DeFi protocols, NFTs, and smart contracts', 'Îž', true),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14', 'A-Shares', 'Chinese stock market', 'ä¸­å›½Aè‚¡è®¨è®ºåŒºï¼Œåˆ†æžæ²ªæ·±å¸‚åœº', 'ðŸ‡¨ðŸ‡³', true),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a15', 'US Stocks', 'US equity markets', 'Discuss NYSE, NASDAQ, and US market trends', 'ðŸ‡ºðŸ‡¸', true),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a16', 'Trading Strategies', 'Share your strategies', 'Technical analysis, trading systems, and risk management', 'ðŸ“Š', true),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a17', 'Off-Topic', 'General community chat', 'Non-trading discussions, introductions, and casual chat', 'ðŸ’¬', true)
on conflict do nothing;

-- ==================== ENABLE REALTIME ====================
-- Enable Realtime for chat messages
alter publication supabase_realtime add table public.chat_messages;
alter publication supabase_realtime add table public.notes;

-- ==================== FUNCTIONS ====================

-- Function to update members count
create or replace function update_board_members_count()
returns trigger as $$
begin
  if tg_op = 'INSERT' then
    update public.chat_boards
    set members_count = members_count + 1
    where id = new.board_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.chat_boards
    set members_count = members_count - 1
    where id = old.board_id;
    return old;
  end if;
  return null;
end;
$$ language plpgsql;

create trigger members_count_trigger
  after insert or delete on public.chat_members
  for each row execute function update_board_members_count();

-- Function to update likes count
create or replace function update_note_likes_count()
returns trigger as $$
begin
  if tg_op = 'INSERT' then
    update public.notes
    set likes_count = likes_count + 1
    where id = new.note_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.notes
    set likes_count = likes_count - 1
    where id = old.note_id;
    return old;
  end if;
  return null;
end;
$$ language plpgsql;

create trigger likes_count_trigger
  after insert or delete on public.likes
  for each row execute function update_note_likes_count();

-- Function to automatically add user to board when they join
create or replace function auto_join_public_boards()
returns trigger as $$
begin
  -- Auto-join user to all public boards
  insert into public.chat_members (board_id, user_id, role)
  select id, new.id, 'member'
  from public.chat_boards
  where is_public = true
  on conflict do nothing;
  
  return new;
end;
$$ language plpgsql security definer;

create trigger auto_join_boards_trigger
  after insert on public.profiles
  for each row execute function auto_join_public_boards();

-- ==================== VIEWS ====================

-- View for getting board details with user membership status
create or replace view public.boards_with_membership as
select
  b.id,
  b.name,
  b.topic,
  b.description,
  b.icon,
  b.members_count,
  b.created_at,
  case when m.user_id is not null then true else false end as is_member,
  m.role as user_role
from public.chat_boards b
left join public.chat_members m on b.id = m.board_id and m.user_id = auth.uid();

-- Grant access
grant select on public.boards_with_membership to authenticated;
grant select on public.boards_with_membership to anon;

-- ==================== STORAGE ====================
-- Create storage bucket for avatars
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict do nothing;

-- Storage policies
create policy "Anyone can view avatars"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "Users can upload their own avatar"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can update their own avatar"
  on storage.objects for update
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

-- ==================== COMPLETION MESSAGE ====================
do $$
begin
  raise notice 'âœ… StockandCrypto database schema created successfully!';
  raise notice 'ðŸ“Š Tables: profiles, notes, likes, chat_boards, chat_members, chat_messages';
  raise notice 'ðŸ”’ RLS enabled on all tables';
  raise notice 'âš¡ Realtime enabled for chat_messages and notes';
end $$;

