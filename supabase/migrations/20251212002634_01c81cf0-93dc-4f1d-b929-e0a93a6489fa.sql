-- Create likes table
CREATE TABLE public.likes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(post_id, user_id)
);

-- Enable RLS
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Likes are viewable by everyone" 
ON public.likes 
FOR SELECT 
USING (true);

CREATE POLICY "Users can create likes" 
ON public.likes 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own likes" 
ON public.likes 
FOR DELETE 
USING (auth.uid() = user_id);