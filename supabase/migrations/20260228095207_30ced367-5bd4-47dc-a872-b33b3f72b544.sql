
-- Add category column to transaction_posts
ALTER TABLE public.transaction_posts ADD COLUMN IF NOT EXISTS category TEXT DEFAULT NULL;

-- Create index for category filtering
CREATE INDEX IF NOT EXISTS idx_transaction_posts_category ON public.transaction_posts(category);

-- Create index for created_at (for sorting)
CREATE INDEX IF NOT EXISTS idx_transaction_posts_created_at ON public.transaction_posts(created_at DESC);

-- Add full text search vector column
ALTER TABLE public.transaction_posts ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Create function to update search vector
CREATE OR REPLACE FUNCTION public.update_transaction_post_search_vector()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.search_vector := to_tsvector('simple', COALESCE(NEW.content, ''));
  RETURN NEW;
END;
$$;

-- Create trigger for search vector
DROP TRIGGER IF EXISTS update_transaction_post_search ON public.transaction_posts;
CREATE TRIGGER update_transaction_post_search
BEFORE INSERT OR UPDATE ON public.transaction_posts
FOR EACH ROW
EXECUTE FUNCTION public.update_transaction_post_search_vector();

-- Create GIN index for full text search
CREATE INDEX IF NOT EXISTS idx_transaction_posts_search ON public.transaction_posts USING GIN(search_vector);

-- Update existing rows to populate search_vector
UPDATE public.transaction_posts SET search_vector = to_tsvector('simple', COALESCE(content, ''));
