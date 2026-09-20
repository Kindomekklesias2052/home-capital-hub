CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone_number)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'phone_number');

  INSERT INTO public.transaction_categories (user_id, name, scope, is_custom)
  SELECT NEW.id, c.name, c.scope::public.ledger_scope, false
  FROM (VALUES
    ('Business Revenue','business'),('Stock','business'),('Supplies','business'),
    ('Transport','business'),('Salaries','business'),('Rent','business'),
    ('Utilities','business'),('Marketing','business'),('Loan Repayment','business'),
    ('Other Business','business'),
    ('Food','personal'),('Transport','personal'),('Clothing','personal'),
    ('Entertainment','personal'),('Personal Bills','personal'),('Savings','personal'),
    ('Other Personal','personal'),
    ('School Fees','family'),('Household Food','family'),('Rent','family'),
    ('Utilities','family'),('Healthcare','family'),('Family Transport','family'),
    ('Family Support','family'),('Other Family','family')
  ) AS c(name, scope);

  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

DELETE FROM public.transactions WHERE reference LIKE 'DEMO-%';