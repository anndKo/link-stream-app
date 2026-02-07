
-- Add seller rejection bank info and admin-to-seller message fields
ALTER TABLE public.payment_boxes 
  ADD COLUMN IF NOT EXISTS seller_rejection_bank_account text,
  ADD COLUMN IF NOT EXISTS seller_rejection_bank_name text,
  ADD COLUMN IF NOT EXISTS admin_seller_message text,
  ADD COLUMN IF NOT EXISTS admin_seller_message_at timestamptz;
