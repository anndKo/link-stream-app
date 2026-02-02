-- Add new columns for the complete transaction flow
ALTER TABLE public.payment_boxes
ADD COLUMN IF NOT EXISTS buyer_bank_account text,
ADD COLUMN IF NOT EXISTS buyer_bank_name text,
ADD COLUMN IF NOT EXISTS refund_reason text,
ADD COLUMN IF NOT EXISTS seller_completed_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS buyer_confirmed_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS transaction_start_at timestamp with time zone;

-- Update the status to include more states
-- New statuses: 'pending', 'buyer_paid', 'admin_confirmed', 'seller_completed', 'buyer_confirmed', 'completed', 'cancelled', 'refund_requested', 'refunded', 'rejected'