CREATE TABLE public.households (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invite_code text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.household_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (household_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.households TO authenticated;
GRANT ALL ON public.households TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.household_members TO authenticated;
GRANT ALL ON public.household_members TO service_role;

ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_household_member(_household_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.household_members
    WHERE household_id = _household_id AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_household_owner(_household_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.households
    WHERE id = _household_id AND owner_id = auth.uid()
  );
$$;

CREATE POLICY "members read household" ON public.households
  FOR SELECT TO authenticated USING (public.is_household_member(id));
CREATE POLICY "owner updates household" ON public.households
  FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "owner deletes household" ON public.households
  FOR DELETE TO authenticated USING (owner_id = auth.uid());

CREATE POLICY "members read roster" ON public.household_members
  FOR SELECT TO authenticated USING (public.is_household_member(household_id));
CREATE POLICY "leave or owner removes" ON public.household_members
  FOR DELETE TO authenticated USING (user_id = auth.uid() OR public.is_household_owner(household_id));

ALTER TABLE public.transactions ADD COLUMN household_id uuid REFERENCES public.households(id) ON DELETE SET NULL;
ALTER TABLE public.transaction_categories ADD COLUMN household_id uuid REFERENCES public.households(id) ON DELETE SET NULL;
ALTER TABLE public.budgets ADD COLUMN household_id uuid REFERENCES public.households(id) ON DELETE SET NULL;

CREATE INDEX idx_transactions_household ON public.transactions(household_id);
CREATE INDEX idx_categories_household ON public.transaction_categories(household_id);
CREATE INDEX idx_budgets_household ON public.budgets(household_id);

DROP POLICY "own transactions" ON public.transactions;
CREATE POLICY "own or household transactions" ON public.transactions
  FOR ALL TO authenticated
  USING (auth.uid() = user_id OR (household_id IS NOT NULL AND public.is_household_member(household_id)))
  WITH CHECK (
    (auth.uid() = user_id OR (household_id IS NOT NULL AND public.is_household_member(household_id)))
    AND (household_id IS NULL OR public.is_household_member(household_id))
  );

DROP POLICY "own categories" ON public.transaction_categories;
CREATE POLICY "own or household categories" ON public.transaction_categories
  FOR ALL TO authenticated
  USING (auth.uid() = user_id OR (household_id IS NOT NULL AND public.is_household_member(household_id)))
  WITH CHECK (
    (auth.uid() = user_id OR (household_id IS NOT NULL AND public.is_household_member(household_id)))
    AND (household_id IS NULL OR public.is_household_member(household_id))
  );

DROP POLICY "own budgets" ON public.budgets;
CREATE POLICY "own or household budgets" ON public.budgets
  FOR ALL TO authenticated
  USING (auth.uid() = user_id OR (household_id IS NOT NULL AND public.is_household_member(household_id)))
  WITH CHECK (
    (auth.uid() = user_id OR (household_id IS NOT NULL AND public.is_household_member(household_id)))
    AND (household_id IS NULL OR public.is_household_member(household_id))
  );

CREATE OR REPLACE FUNCTION public.create_household(_name text)
RETURNS public.households LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  h public.households;
  uid uuid := auth.uid();
  code text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF EXISTS (SELECT 1 FROM public.household_members WHERE user_id = uid) THEN
    RAISE EXCEPTION 'You already belong to a household';
  END IF;
  LOOP
    code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.households WHERE invite_code = code);
  END LOOP;

  INSERT INTO public.households (name, owner_id, invite_code)
  VALUES (coalesce(nullif(btrim(_name), ''), 'Our household'), uid, code)
  RETURNING * INTO h;

  INSERT INTO public.household_members (household_id, user_id, role)
  VALUES (h.id, uid, 'owner');

  UPDATE public.transactions SET household_id = h.id WHERE user_id = uid AND household_id IS NULL;
  UPDATE public.transaction_categories SET household_id = h.id WHERE user_id = uid AND household_id IS NULL;
  UPDATE public.budgets SET household_id = h.id WHERE user_id = uid AND household_id IS NULL;

  RETURN h;
END;
$$;

CREATE OR REPLACE FUNCTION public.join_household(_code text)
RETURNS public.households LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  h public.households;
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  SELECT * INTO h FROM public.households WHERE invite_code = upper(btrim(_code));
  IF h.id IS NULL THEN RAISE EXCEPTION 'Invite code not found'; END IF;
  IF EXISTS (SELECT 1 FROM public.household_members WHERE user_id = uid AND household_id <> h.id) THEN
    RAISE EXCEPTION 'You already belong to another household';
  END IF;
  INSERT INTO public.household_members (household_id, user_id, role)
  VALUES (h.id, uid, 'member')
  ON CONFLICT (household_id, user_id) DO NOTHING;
  RETURN h;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_household(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.join_household(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_household(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_household(text) TO authenticated;