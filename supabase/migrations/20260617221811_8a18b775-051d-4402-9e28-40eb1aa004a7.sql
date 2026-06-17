
-- ENUMS
CREATE TYPE public.book_status AS ENUM ('queue','reading','paused','dropped','finished');
CREATE TYPE public.note_type AS ENUM ('quote','text','photo','chapter','other','summary');
CREATE TYPE public.gigi_privacy AS ENUM ('off','current_book','notes_only','full','full_plus_chats');

-- updated_at helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- APP CONFIG (single-user lockdown)
CREATE TABLE public.app_config (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  owner_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO public.app_config (id) VALUES (1);
GRANT SELECT ON public.app_config TO anon, authenticated;
GRANT ALL ON public.app_config TO service_role;
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone can read owner status" ON public.app_config FOR SELECT TO anon, authenticated USING (true);

-- Claim ownership: first user becomes owner
CREATE OR REPLACE FUNCTION public.claim_ownership()
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE current_owner UUID;
BEGIN
  SELECT owner_user_id INTO current_owner FROM public.app_config WHERE id = 1;
  IF current_owner IS NULL THEN
    UPDATE public.app_config SET owner_user_id = auth.uid() WHERE id = 1;
    RETURN TRUE;
  END IF;
  RETURN current_owner = auth.uid();
END $$;
GRANT EXECUTE ON FUNCTION public.claim_ownership() TO authenticated;

-- BOOKS
CREATE TABLE public.books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  author TEXT,
  isbn TEXT,
  cover_url TEXT,
  description TEXT,
  page_count INT,
  published_date TEXT,
  category TEXT,
  status public.book_status NOT NULL DEFAULT 'queue',
  current_page INT NOT NULL DEFAULT 0,
  rating INT CHECK (rating BETWEEN 1 AND 10),
  is_favourite BOOLEAN NOT NULL DEFAULT false,
  source TEXT NOT NULL DEFAULT 'manual',
  external_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX books_user_status_idx ON public.books(user_id, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.books TO authenticated;
GRANT ALL ON public.books TO service_role;
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own books" ON public.books FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER books_updated_at BEFORE UPDATE ON public.books FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- NOTES
CREATE TABLE public.notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id UUID REFERENCES public.books(id) ON DELETE CASCADE,
  type public.note_type NOT NULL DEFAULT 'text',
  title TEXT,
  content TEXT,
  quote_text TEXT,
  comment TEXT,
  page_number INT,
  chapter_number INT,
  chapter_title TEXT,
  image_path TEXT,
  is_favourite BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX notes_user_book_idx ON public.notes(user_id, book_id);
CREATE INDEX notes_user_type_idx ON public.notes(user_id, type);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notes TO authenticated;
GRANT ALL ON public.notes TO service_role;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own notes" ON public.notes FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER notes_updated_at BEFORE UPDATE ON public.notes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- TAGS
CREATE TABLE public.tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tags TO authenticated;
GRANT ALL ON public.tags TO service_role;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own tags" ON public.tags FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.note_tags (
  note_id UUID NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  PRIMARY KEY (note_id, tag_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.note_tags TO authenticated;
GRANT ALL ON public.note_tags TO service_role;
ALTER TABLE public.note_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own note_tags" ON public.note_tags FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- READING SESSIONS
CREATE TABLE public.reading_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  duration_minutes INT,
  start_page INT,
  end_page INT,
  pages_read INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reading_sessions TO authenticated;
GRANT ALL ON public.reading_sessions TO service_role;
ALTER TABLE public.reading_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own sessions" ON public.reading_sessions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- RATINGS
CREATE TABLE public.ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id UUID NOT NULL UNIQUE REFERENCES public.books(id) ON DELETE CASCADE,
  overall INT CHECK (overall BETWEEN 1 AND 10),
  writing_style INT CHECK (writing_style BETWEEN 1 AND 10),
  emotional_impact INT CHECK (emotional_impact BETWEEN 1 AND 10),
  usefulness INT CHECK (usefulness BETWEEN 1 AND 10),
  would_read_again BOOLEAN,
  summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ratings TO authenticated;
GRANT ALL ON public.ratings TO service_role;
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own ratings" ON public.ratings FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER ratings_updated_at BEFORE UPDATE ON public.ratings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- GIGI
CREATE TABLE public.gigi_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  context_book_id UUID REFERENCES public.books(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gigi_conversations TO authenticated;
GRANT ALL ON public.gigi_conversations TO service_role;
ALTER TABLE public.gigi_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own conv" ON public.gigi_conversations FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER gigi_conv_updated BEFORE UPDATE ON public.gigi_conversations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.gigi_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.gigi_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX gigi_messages_conv_idx ON public.gigi_messages(conversation_id, created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gigi_messages TO authenticated;
GRANT ALL ON public.gigi_messages TO service_role;
ALTER TABLE public.gigi_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own msgs" ON public.gigi_messages FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- USER SETTINGS
CREATE TABLE public.user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  theme TEXT NOT NULL DEFAULT 'cream',
  gigi_privacy public.gigi_privacy NOT NULL DEFAULT 'full',
  font TEXT,
  density TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_settings TO authenticated;
GRANT ALL ON public.user_settings TO service_role;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own settings" ON public.user_settings FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER settings_updated_at BEFORE UPDATE ON public.user_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- STORAGE policies for book-assets bucket (user_id is the first path segment)
CREATE POLICY "own bucket read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'book-assets' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "own bucket write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'book-assets' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "own bucket update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'book-assets' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "own bucket delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'book-assets' AND auth.uid()::text = (storage.foldername(name))[1]);
