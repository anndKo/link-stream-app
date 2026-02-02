-- Add column to track message deletion for users (but admin can still see)
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS edited_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Create function to auto-delete messages after 24 hours (for regular users, not admin)
-- This will be handled in the frontend by filtering out messages older than 24h

-- Update RLS policy to allow users to delete their own messages
DROP POLICY IF EXISTS "Users can delete own messages" ON public.messages;
CREATE POLICY "Users can delete own messages" 
ON public.messages 
FOR DELETE 
USING (auth.uid() = sender_id);

-- Update existing update policy to include deleted_at and edited_at
DROP POLICY IF EXISTS "Users can update own sent messages" ON public.messages;
CREATE POLICY "Users can update own sent messages" 
ON public.messages 
FOR UPDATE 
USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Create index for faster queries on created_at for 24h filtering
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at);