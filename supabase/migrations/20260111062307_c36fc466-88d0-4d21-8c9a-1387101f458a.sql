-- Add new columns to payment_boxes for the enhanced payment flow
ALTER TABLE public.payment_boxes 
ADD COLUMN IF NOT EXISTS payment_duration TEXT,
ADD COLUMN IF NOT EXISTS payment_duration_days INTEGER,
ADD COLUMN IF NOT EXISTS admin_confirmed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS seller_cancelled_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS refund_requested_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS refund_approved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS transaction_fee TEXT,
ADD COLUMN IF NOT EXISTS has_fee BOOLEAN DEFAULT true;

-- Update status enum to support more states
-- Status values: 'pending', 'buyer_paid', 'admin_confirmed', 'cancelled', 'refund_requested', 'refunded', 'rejected'

-- Create admin payment box settings table for global payment box content
CREATE TABLE IF NOT EXISTS public.admin_payment_box_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  image_url TEXT,
  content TEXT,
  transaction_fee TEXT,
  has_fee BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on admin_payment_box_settings
ALTER TABLE public.admin_payment_box_settings ENABLE ROW LEVEL SECURITY;

-- Everyone can view admin payment box settings
CREATE POLICY "Everyone can view admin payment box settings"
ON public.admin_payment_box_settings
FOR SELECT
USING (true);

-- Only admin can insert/update/delete admin payment box settings
CREATE POLICY "Admin can manage admin payment box settings"
ON public.admin_payment_box_settings
FOR ALL
USING (is_admin())
WITH CHECK (is_admin());

-- Update existing RLS policy for payment_boxes to allow admin to update
DROP POLICY IF EXISTS "Users can update payment boxes they're involved in" ON public.payment_boxes;

CREATE POLICY "Users can update payment boxes they're involved in or admin"
ON public.payment_boxes
FOR UPDATE
USING ((auth.uid() = sender_id) OR (auth.uid() = receiver_id) OR is_admin());

-- Enable realtime for admin_payment_box_settings
ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_payment_box_settings;