-- Add ban_reason column to profiles table to store the reason for banning
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ban_reason text;

-- Add post_reports table to track reported posts
CREATE TABLE IF NOT EXISTS public.post_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_id UUID NOT NULL,
  post_id UUID NOT NULL,
  post_type TEXT NOT NULL DEFAULT 'post', -- 'post' or 'transaction_post'
  reason TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.post_reports ENABLE ROW LEVEL SECURITY;

-- Create policies for post_reports
CREATE POLICY "Users can create post reports" 
ON public.post_reports 
FOR INSERT 
WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Users can view own reports or admin can view all" 
ON public.post_reports 
FOR SELECT 
USING (auth.uid() = reporter_id OR is_admin());

CREATE POLICY "Admin can update post reports" 
ON public.post_reports 
FOR UPDATE 
USING (is_admin());

-- Create updated_at trigger for post_reports
CREATE TRIGGER update_post_reports_updated_at
BEFORE UPDATE ON public.post_reports
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();