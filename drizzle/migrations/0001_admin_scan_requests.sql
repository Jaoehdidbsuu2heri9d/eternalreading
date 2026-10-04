GRANT UPDATE ON public.scan_requests TO authenticated;
CREATE POLICY "Admins update requests" ON public.scan_requests FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));