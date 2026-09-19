CREATE OR REPLACE FUNCTION public.shares_household(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.household_members me
    JOIN public.household_members other ON other.household_id = me.household_id
    WHERE me.user_id = auth.uid() AND other.user_id = _user_id
  );
$$;

REVOKE EXECUTE ON FUNCTION public.shares_household(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.shares_household(uuid) TO authenticated;

CREATE POLICY "household members read profiles" ON public.profiles
  FOR SELECT TO authenticated USING (public.shares_household(id));