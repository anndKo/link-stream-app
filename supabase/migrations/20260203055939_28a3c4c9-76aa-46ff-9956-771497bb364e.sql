-- Add sender_role column to payment_boxes table
ALTER TABLE public.payment_boxes ADD COLUMN IF NOT EXISTS sender_role text DEFAULT 'seller';

-- Add comment for the column
COMMENT ON COLUMN public.payment_boxes.sender_role IS 'Role of the sender: buyer or seller';