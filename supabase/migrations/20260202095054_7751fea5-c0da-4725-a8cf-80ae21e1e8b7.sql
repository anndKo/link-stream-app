-- Add bill_image_url column to payment_boxes table for storing payment bill/receipt images
ALTER TABLE public.payment_boxes
ADD COLUMN IF NOT EXISTS bill_image_url text DEFAULT NULL;