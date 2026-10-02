CREATE TABLE public.household_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  created_by uuid NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.household_invites TO authenticated;
GRANT ALL ON public.household_invites TO service_role;
ALTER TABLE public.household_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads invites" ON public.household_invites FOR SELECT TO authenticated USING (public.is_household_owner(household_id));
CREATE POLICY "owner revokes invites" ON public.household_invites FOR UPDATE TO authenticated USING (public.is_household_owner(household_id)) WITH CHECK (public.is_household_owner(household_id));

CREATE OR REPLACE FUNCTION public.create_household_invite(_days integer DEFAULT 7)
RETURNS public.household_invites LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE hid uuid; inv public.household_invites;
BEGIN
  SELECT id INTO hid FROM public.households WHERE owner_id = auth.uid();
  IF hid IS NULL THEN RAISE EXCEPTION 'Only the household owner can create invite links'; END IF;
  IF _days < 1 OR _days > 30 THEN RAISE EXCEPTION 'Expiry must be 1 to 30 days'; END IF;
  INSERT INTO public.household_invites (household_id, token, created_by, expires_at)
  VALUES (hid, replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-',''), auth.uid(), now() + make_interval(days => _days))
  RETURNING * INTO inv;
  RETURN inv;
END; $$;

CREATE OR REPLACE FUNCTION public.preview_household_invite(_token text)
RETURNS TABLE(household_name text, valid boolean, reason text) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE inv public.household_invites; hname text;
BEGIN
  SELECT * INTO inv FROM public.household_invites WHERE token = _token;
  IF inv.id IS NULL THEN RETURN QUERY SELECT NULL::text, false, 'not_found'; RETURN; END IF;
  SELECT name INTO hname FROM public.households WHERE id = inv.household_id;
  IF inv.revoked_at IS NOT NULL THEN RETURN QUERY SELECT hname, false, 'revoked'; RETURN; END IF;
  IF inv.expires_at < now() THEN RETURN QUERY SELECT hname, false, 'expired'; RETURN; END IF;
  RETURN QUERY SELECT hname, true, NULL::text;
END; $$;

CREATE OR REPLACE FUNCTION public.accept_household_invite(_token text)
RETURNS public.households LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE inv public.household_invites; h public.households; uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  SELECT * INTO inv FROM public.household_invites WHERE token = _token;
  IF inv.id IS NULL THEN RAISE EXCEPTION 'Invite link not found'; END IF;
  IF inv.revoked_at IS NOT NULL THEN RAISE EXCEPTION 'This invite link was revoked'; END IF;
  IF inv.expires_at < now() THEN RAISE EXCEPTION 'This invite link has expired'; END IF;
  IF EXISTS (SELECT 1 FROM public.household_members WHERE user_id = uid AND household_id <> inv.household_id) THEN
    RAISE EXCEPTION 'You already belong to another household';
  END IF;
  INSERT INTO public.household_members (household_id, user_id, role) VALUES (inv.household_id, uid, 'member')
  ON CONFLICT (household_id, user_id) DO NOTHING;
  SELECT * INTO h FROM public.households WHERE id = inv.household_id;
  RETURN h;
END; $$;

REVOKE EXECUTE ON FUNCTION public.create_household_invite(integer), public.preview_household_invite(text), public.accept_household_invite(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_household_invite(integer), public.preview_household_invite(text), public.accept_household_invite(text) TO authenticated;