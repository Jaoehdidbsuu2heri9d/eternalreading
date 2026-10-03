CREATE TABLE public.scan_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scan_name text NOT NULL CHECK (char_length(scan_name) BETWEEN 2 AND 80),
  contact text NOT NULL CHECK (char_length(contact) BETWEEN 3 AND 160),
  community_url text CHECK (community_url IS NULL OR char_length(community_url) <= 300),
  message text NOT NULL CHECK (char_length(message) BETWEEN 10 AND 2000),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.scan_requests TO authenticated;
GRANT ALL ON public.scan_requests TO service_role;
ALTER TABLE public.scan_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own requests readable" ON public.scan_requests FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Create own pending request" ON public.scan_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND status = 'pending');
CREATE INDEX scan_requests_user_idx ON public.scan_requests(user_id);