-- Drop the foreign key constraint on comments.post_id so comments can reference both posts and transaction_posts
ALTER TABLE public.comments DROP CONSTRAINT IF EXISTS comments_post_id_fkey;