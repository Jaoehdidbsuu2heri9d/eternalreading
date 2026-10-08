-- Limit Hall of Fame financial and recognition tables to the privileges actually needed.
-- Supabase/Postgres can grant broader default public-schema privileges at creation time.
-- RLS already guards data, but removing unneeded table privileges adds defense in depth.
-- No existing donation, profile, role, or payment data is changed.

REVOKE ALL PRIVILEGES ON TABLE public.supporter_levels
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.supporter_levels TO authenticated;

REVOKE ALL PRIVILEGES ON TABLE public.donations
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.donations TO authenticated;

REVOKE ALL PRIVILEGES ON TABLE public.supporter_preferences
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.supporter_preferences TO authenticated;

REVOKE ALL PRIVILEGES ON TABLE public.supporter_manual_grants
  FROM PUBLIC, anon, authenticated;

-- Service role retains existing privileges; the admin RPC continues to use
-- SECURITY DEFINER and verifies 'admin' via public.has_role.
-- No anon access, financial status writes, or honorary grant direct writes.
