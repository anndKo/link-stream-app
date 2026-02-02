-- Add seller bank details columns for receiving money
ALTER TABLE public.payment_boxes 
ADD COLUMN IF NOT EXISTS seller_bank_account text,
ADD COLUMN IF NOT EXISTS seller_bank_name text,
ADD COLUMN IF NOT EXISTS seller_confirmed_at timestamp with time zone;