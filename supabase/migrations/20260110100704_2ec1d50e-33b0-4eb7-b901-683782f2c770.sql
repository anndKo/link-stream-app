-- Create payment_boxes table for trading payment requests
CREATE TABLE public.payment_boxes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID NOT NULL,
  receiver_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  confirmed_at TIMESTAMP WITH TIME ZONE,
  image_url TEXT,
  content TEXT
);

-- Enable RLS
ALTER TABLE public.payment_boxes ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their payment boxes"
ON public.payment_boxes
FOR SELECT
USING (auth.uid() = sender_id OR auth.uid() = receiver_id OR is_admin());

CREATE POLICY "Users can create payment boxes"
ON public.payment_boxes
FOR INSERT
WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can update payment boxes they're involved in"
ON public.payment_boxes
FOR UPDATE
USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Admin can delete payment boxes"
ON public.payment_boxes
FOR DELETE
USING (is_admin());

-- Enable realtime for payment_boxes
ALTER PUBLICATION supabase_realtime ADD TABLE public.payment_boxes;