-- Add columns for seller rejection and admin-buyer communication
ALTER TABLE public.payment_boxes 
ADD COLUMN IF NOT EXISTS seller_rejection_reason text,
ADD COLUMN IF NOT EXISTS admin_message text,
ADD COLUMN IF NOT EXISTS buyer_reply text,
ADD COLUMN IF NOT EXISTS admin_message_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS buyer_reply_at timestamp with time zone;