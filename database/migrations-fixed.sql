-- ========================================
-- StockandCrypto - Notes & Chat Enhancement Migrations
-- Fixed version for Supabase compatibility
-- ========================================

-- ==================== PART 1: NOTES ENHANCEMENTS ====================

-- 1.1 Add columns to notes table
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false;
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN DEFAULT false;
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS share_id UUID DEFAULT uuid_generate_v4();

-- Create unique index on share_id
CREATE UNIQUE INDEX IF NOT EXISTS notes_share_id_idx ON public.notes(share_id) WHERE share_id IS NOT NULL;

-- 1.2 Note Versions Table
CREATE TABLE IF NOT EXISTS public.note_versions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    note_id UUID REFERENCES public.notes(id) ON DELETE CASCADE NOT NULL,
    title TEXT,
    content TEXT,
    tags TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- Index for faster lookup
CREATE INDEX IF NOT EXISTS note_versions_note_id_idx ON public.note_versions(note_id);
CREATE INDEX IF NOT EXISTS note_versions_created_at_idx ON public.note_versions(created_at DESC);

-- Enable RLS
ALTER TABLE public.note_versions ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view versions of their notes" ON public.note_versions FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.notes WHERE notes.id = note_versions.note_id AND notes.user_id = auth.uid())
);

CREATE POLICY "Users can create versions of their notes" ON public.note_versions FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.notes WHERE notes.id = note_versions.note_id AND notes.user_id = auth.uid())
);

-- ==================== PART 2: CHAT ENHANCEMENTS ====================

-- 2.1 Add columns to chat_messages table
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS reply_to UUID REFERENCES public.chat_messages(id);
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS is_edited BOOLEAN DEFAULT false;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS mentions TEXT[] DEFAULT '{}'{};
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS attachment_url TEXT;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS attachment_type TEXT;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS attachment_name TEXT;

-- Index for reply lookup
CREATE INDEX IF NOT EXISTS chat_messages_reply_to_idx ON public.chat_messages(reply_to) WHERE reply_to IS NOT NULL;

-- 2.2 Message Reactions Table
CREATE TABLE IF NOT EXISTS public.message_reactions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    message_id UUID REFERENCES public.chat_messages(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    emoji TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(message_id, user_id, emoji)
);

-- Enable RLS
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all reactions" ON public.message_reactions FOR SELECT USING (true);
CREATE POLICY "Users can add reactions" ON public.message_reactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can remove their reactions" ON public.message_reactions FOR DELETE USING (auth.uid() = user_id);

-- 2.3 Direct Messages Table
CREATE TABLE IF NOT EXISTS public.direct_messages (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    receiver_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT false,
    deleted_at TIMESTAMPTZ
);

-- Indexes for DM lookup
CREATE INDEX IF NOT EXISTS direct_messages_sender_idx ON public.direct_messages(sender_id);
CREATE INDEX IF NOT EXISTS direct_messages_receiver_idx ON public.direct_messages(receiver_id);
CREATE INDEX IF NOT EXISTS direct_messages_created_at_idx ON public.direct_messages(created_at DESC);

-- Enable RLS
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their DMs" ON public.direct_messages FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "Users can send DMs" ON public.direct_messages FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Users can delete their DMs" ON public.direct_messages FOR DELETE USING (auth.uid() = sender_id);

-- 2.4 User Presence Table
CREATE TABLE IF NOT EXISTS public.user_presence (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'away', 'busy')),
    last_seen TIMESTAMPTZ,
    current_channel UUID REFERENCES public.chat_boards(id),
    current_page TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Presence is viewable by authenticated users" ON public.user_presence FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update their presence" ON public.user_presence FOR ALL USING (auth.uid() = user_id);

-- 2.5 Custom Channels Table
CREATE TABLE IF NOT EXISTS public.custom_channels (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    is_public BOOLEAN DEFAULT true,
    icon TEXT,
    category TEXT DEFAULT 'general',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Custom channel members
CREATE TABLE IF NOT EXISTS public.custom_channel_members (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    channel_id UUID REFERENCES public.custom_channels(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role TEXT DEFAULT 'member' CHECK (role IN ('member', 'moderator', 'admin')),
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(channel_id, user_id)
);

-- Enable RLS
ALTER TABLE public.custom_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_channel_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public channels are viewable" ON public.custom_channels FOR SELECT USING (is_public = true OR EXISTS (
    SELECT 1 FROM public.custom_channel_members WHERE custom_channel_members.channel_id = custom_channels.id AND custom_channel_members.user_id = auth.uid()
));

CREATE POLICY "Users can create channels" ON public.custom_channels FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Channel members view" ON public.custom_channel_members FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can join channels" ON public.custom_channel_members FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 2.6 Typing Indicator Table
CREATE TABLE IF NOT EXISTS public.typing_indicators (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    channel_id UUID REFERENCES public.chat_boards(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    is_typing BOOLEAN DEFAULT true,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(channel_id, user_id)
);

-- ==================== PART 3: TRIGGERS ====================

-- Auto-create user presence on profile creation
CREATE OR REPLACE FUNCTION create_user_presence()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_presence (user_id, status, last_seen)
    VALUES (NEW.id, 'online', NOW())
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS create_presence_trigger ON public.profiles;
CREATE TRIGGER create_presence_trigger AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION create_user_presence();

-- Auto-save note version on update
CREATE OR REPLACE FUNCTION save_note_version()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.content IS DISTINCT FROM NEW.content OR OLD.title IS DISTINCT FROM NEW.title THEN
        INSERT INTO public.note_versions (note_id, title, content, tags, created_by)
        VALUES (OLD.id, OLD.title, OLD.content, OLD.tags, OLD.user_id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS note_version_trigger ON public.notes;
CREATE TRIGGER note_version_trigger BEFORE UPDATE ON public.notes
FOR EACH ROW EXECUTE FUNCTION save_note_version();

-- ==================== PART 4: STORAGE ====================

-- Create storage bucket for attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('attachments', 'attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for attachments
CREATE POLICY "Users can view attachments they have access to" ON storage.objects FOR SELECT
USING (bucket_id = 'attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload attachments" ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ==================== PART 5: REALTIME ====================
-- Note: Run these separately if needed via Database > Replication

-- ==================== COMPLETION ====================
SELECT 'Migrations completed successfully!' as status;
