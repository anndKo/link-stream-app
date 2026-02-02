-- Add reply_to_id column to messages table for message replies
ALTER TABLE public.messages ADD COLUMN reply_to_id UUID REFERENCES public.messages(id) ON DELETE SET NULL;

-- Create table for message deletion settings between users
CREATE TABLE public.message_deletion_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user1_id UUID NOT NULL,
  user2_id UUID NOT NULL,
  is_disabled BOOLEAN NOT NULL DEFAULT false,
  requested_by UUID,
  requested_at TIMESTAMP WITH TIME ZONE,
  confirmed_by UUID,
  confirmed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT unique_user_pair UNIQUE (user1_id, user2_id),
  CONSTRAINT ordered_user_ids CHECK (user1_id < user2_id)
);

-- Enable RLS
ALTER TABLE public.message_deletion_settings ENABLE ROW LEVEL SECURITY;

-- Users can view their own settings
CREATE POLICY "Users can view their message deletion settings"
ON public.message_deletion_settings
FOR SELECT
USING (auth.uid() = user1_id OR auth.uid() = user2_id);

-- Users can insert settings for their conversations
CREATE POLICY "Users can create message deletion settings"
ON public.message_deletion_settings
FOR INSERT
WITH CHECK (auth.uid() = user1_id OR auth.uid() = user2_id);

-- Users can update settings for their conversations
CREATE POLICY "Users can update message deletion settings"
ON public.message_deletion_settings
FOR UPDATE
USING (auth.uid() = user1_id OR auth.uid() = user2_id);

-- Create table for deletion disable requests (pending confirmations)
CREATE TABLE public.deletion_disable_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  requester_id UUID NOT NULL,
  receiver_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.deletion_disable_requests ENABLE ROW LEVEL SECURITY;

-- Users can view requests they're involved in
CREATE POLICY "Users can view their deletion requests"
ON public.deletion_disable_requests
FOR SELECT
USING (auth.uid() = requester_id OR auth.uid() = receiver_id);

-- Users can create requests
CREATE POLICY "Users can create deletion requests"
ON public.deletion_disable_requests
FOR INSERT
WITH CHECK (auth.uid() = requester_id);

-- Users can update requests they received
CREATE POLICY "Users can update received deletion requests"
ON public.deletion_disable_requests
FOR UPDATE
USING (auth.uid() = receiver_id);

-- Add trigger for updated_at
CREATE TRIGGER update_message_deletion_settings_updated_at
BEFORE UPDATE ON public.message_deletion_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_deletion_disable_requests_updated_at
BEFORE UPDATE ON public.deletion_disable_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for deletion requests
ALTER PUBLICATION supabase_realtime ADD TABLE public.deletion_disable_requests;