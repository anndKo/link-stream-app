-- Create transaction posts table (separate from regular posts)
CREATE TABLE public.transaction_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  content TEXT,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.transaction_posts ENABLE ROW LEVEL SECURITY;

-- RLS policies for transaction posts
CREATE POLICY "Transaction posts are viewable by everyone"
  ON public.transaction_posts FOR SELECT
  USING (true);

CREATE POLICY "Users can create own transaction posts"
  ON public.transaction_posts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own transaction posts"
  ON public.transaction_posts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own posts or admin can delete any"
  ON public.transaction_posts FOR DELETE
  USING (auth.uid() = user_id OR is_admin());

-- Create transaction messages table (permanent, no edit/delete for users)
CREATE TABLE public.transaction_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID NOT NULL,
  receiver_id UUID NOT NULL,
  content TEXT,
  image_url TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.transaction_messages ENABLE ROW LEVEL SECURITY;

-- RLS policies for transaction messages
CREATE POLICY "Users can view own transaction messages"
  ON public.transaction_messages FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id OR is_admin());

CREATE POLICY "Users can send transaction messages"
  ON public.transaction_messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

-- Only admin can delete transaction messages
CREATE POLICY "Admin can delete transaction messages"
  ON public.transaction_messages FOR DELETE
  USING (is_admin());

-- Create indexes
CREATE INDEX idx_transaction_posts_user_id ON public.transaction_posts(user_id);
CREATE INDEX idx_transaction_posts_created_at ON public.transaction_posts(created_at DESC);
CREATE INDEX idx_transaction_messages_sender ON public.transaction_messages(sender_id);
CREATE INDEX idx_transaction_messages_receiver ON public.transaction_messages(receiver_id);
CREATE INDEX idx_transaction_messages_created_at ON public.transaction_messages(created_at DESC);

-- Enable realtime for transaction messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.transaction_messages;