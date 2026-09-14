
CREATE TYPE public.transaction_type AS ENUM ('income','expense','transfer','loan','withdrawal','deposit');
CREATE TYPE public.transaction_source AS ENUM ('mpesa','kcb','equity','bank','cash','manual');
CREATE TYPE public.ledger_scope AS ENUM ('business','personal','family');
CREATE TYPE public.budget_period AS ENUM ('weekly','monthly','quarterly','yearly');
CREATE TYPE public.device_status AS ENUM ('pending','active','revoked');
CREATE TYPE public.consensus_status AS ENUM ('not_required','pending','agreed','disputed');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  full_name TEXT,
  phone_number TEXT,
  base_currency TEXT NOT NULL DEFAULT 'KES',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile" ON public.profiles FOR ALL TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE TABLE public.transaction_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL,
  scope public.ledger_scope NOT NULL,
  is_custom BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, scope, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transaction_categories TO authenticated;
GRANT ALL ON public.transaction_categories TO service_role;
ALTER TABLE public.transaction_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own categories" ON public.transaction_categories FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.sms_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  device_id UUID,
  sender TEXT NOT NULL,
  body TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  parsed BOOLEAN NOT NULL DEFAULT false,
  parse_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sms_messages TO authenticated;
GRANT ALL ON public.sms_messages TO service_role;
ALTER TABLE public.sms_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own sms" ON public.sms_messages FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  transaction_type public.transaction_type NOT NULL,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'KES',
  description TEXT,
  merchant TEXT,
  sender TEXT,
  recipient TEXT,
  reference TEXT,
  source public.transaction_source NOT NULL DEFAULT 'manual',
  scope public.ledger_scope NOT NULL DEFAULT 'personal',
  category_id UUID REFERENCES public.transaction_categories ON DELETE SET NULL,
  transaction_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  confidence_score NUMERIC(4,3) NOT NULL DEFAULT 1.0 CHECK (confidence_score >= 0 AND confidence_score <= 1),
  is_manual BOOLEAN NOT NULL DEFAULT true,
  needs_review BOOLEAN NOT NULL DEFAULT false,
  confirmed_at TIMESTAMPTZ,
  funded_from public.ledger_scope,
  consensus_state public.consensus_status NOT NULL DEFAULT 'not_required',
  sms_message_id UUID REFERENCES public.sms_messages ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, reference)
);
CREATE INDEX transactions_user_date_idx ON public.transactions (user_id, transaction_date DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own transactions" ON public.transactions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  category_id UUID REFERENCES public.transaction_categories ON DELETE CASCADE,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  period public.budget_period NOT NULL DEFAULT 'monthly',
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.budgets TO authenticated;
GRANT ALL ON public.budgets TO service_role;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own budgets" ON public.budgets FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.paired_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  device_name TEXT NOT NULL,
  device_token TEXT NOT NULL UNIQUE,
  pairing_code TEXT,
  pairing_code_expires_at TIMESTAMPTZ,
  device_type TEXT NOT NULL DEFAULT 'android',
  push_token TEXT,
  last_seen_at TIMESTAMPTZ,
  paired_at TIMESTAMPTZ,
  status public.device_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.paired_devices TO authenticated;
GRANT ALL ON public.paired_devices TO service_role;
ALTER TABLE public.paired_devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own devices" ON public.paired_devices FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.category_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  category_id UUID REFERENCES public.transaction_categories ON DELETE CASCADE,
  scope public.ledger_scope NOT NULL,
  transaction_type public.transaction_type,
  hits INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, keyword)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.category_rules TO authenticated;
GRANT ALL ON public.category_rules TO service_role;
ALTER TABLE public.category_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own rules" ON public.category_rules FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.financial_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  firewall_index NUMERIC(6,2) NOT NULL DEFAULT 0,
  latency_speed NUMERIC(10,2) NOT NULL DEFAULT 0,
  consensus_ratio NUMERIC(6,2) NOT NULL DEFAULT 0,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financial_metrics TO authenticated;
GRANT ALL ON public.financial_metrics TO service_role;
ALTER TABLE public.financial_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own metrics" ON public.financial_metrics FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cat RECORD;
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

  INSERT INTO public.transactions
    (user_id, transaction_type, amount, currency, description, merchant, sender, recipient,
     reference, source, scope, category_id, transaction_date, confidence_score, is_manual,
     needs_review, confirmed_at, funded_from, consensus_state)
  SELECT NEW.id, d.ttype::public.transaction_type, d.amount, 'KES', d.description, d.merchant,
         d.sender, d.recipient, d.reference, d.source::public.transaction_source,
         d.scope::public.ledger_scope,
         (SELECT id FROM public.transaction_categories tc
           WHERE tc.user_id = NEW.id AND tc.scope = d.scope::public.ledger_scope AND tc.name = d.cat),
         now() - (d.days_ago || ' days')::interval,
         d.confidence, d.is_manual, d.needs_review,
         CASE WHEN d.needs_review THEN NULL ELSE now() - (d.days_ago || ' days')::interval + interval '35 minutes' END,
         d.funded_from::public.ledger_scope,
         d.consensus::public.consensus_status
  FROM (VALUES
    ('income',  48500.00,'Monthly salary credited','Employer','KCB BANK',NULL,'DEMO-SAL-01','bank','personal','Savings',1,0.99,false,false,NULL,'not_required'),
    ('income',  12800.00,'Shop sales collection','Duka','MPESA',NULL,'DEMO-BIZ-01','mpesa','business','Business Revenue',1,0.96,false,false,NULL,'not_required'),
    ('expense', 3200.00,'Stock purchase from supplier','Mwangi Wholesalers',NULL,'Mwangi Wholesalers','DEMO-BIZ-02','mpesa','business','Stock',2,0.93,false,false,NULL,'not_required'),
    ('expense', 1500.00,'Boda and matatu fare',NULL,NULL,NULL,'DEMO-BIZ-03','cash','business','Transport',3,1.00,true,false,NULL,'not_required'),
    ('expense', 22000.00,'Term 2 school fees','Nyeri Academy',NULL,'Nyeri Academy','DEMO-FAM-01','bank','family','School Fees',4,0.91,false,false,'personal','agreed'),
    ('expense', 6400.00,'Naivas household shopping','Naivas',NULL,'Naivas','DEMO-FAM-02','mpesa','family','Household Food',5,0.88,false,false,'personal','agreed'),
    ('expense', 18000.00,'House rent','Landlord',NULL,'James Kariuki','DEMO-FAM-03','mpesa','family','Rent',6,0.95,false,false,'personal','agreed'),
    ('expense', 2450.00,'KPLC tokens','KPLC',NULL,'KPLC PREPAID','DEMO-FAM-04','mpesa','family','Utilities',7,0.90,false,false,'personal','not_required'),
    ('expense', 3100.00,'Clinic visit and medicine','Mediheal',NULL,'Mediheal','DEMO-FAM-05','mpesa','family','Healthcare',8,0.72,false,true,'personal','pending'),
    ('expense', 950.00,'Lunch at Java','Java House',NULL,'Java House','DEMO-PER-01','mpesa','personal','Food',2,0.94,false,false,NULL,'not_required'),
    ('expense', 2300.00,'New shoes','Bata',NULL,'Bata','DEMO-PER-02','mpesa','personal','Clothing',9,0.81,false,false,NULL,'not_required'),
    ('expense', 1100.00,'Safaricom airtime and bundles','Safaricom',NULL,'Safaricom','DEMO-PER-03','mpesa','personal','Personal Bills',3,0.97,false,false,NULL,'not_required'),
    ('withdrawal', 5000.00,'Cash withdrawal at agent','M-PESA Agent 204567',NULL,NULL,'DEMO-PER-04','mpesa','personal','Other Personal',4,0.62,false,true,NULL,'not_required'),
    ('deposit', 7000.00,'Deposit to business float','M-PESA Agent 118330',NULL,NULL,'DEMO-BIZ-04','mpesa','business','Business Revenue',6,0.86,false,false,NULL,'not_required'),
    ('loan', 15000.00,'Fuliza/KCB M-PESA loan received','KCB M-PESA','KCB',NULL,'DEMO-BIZ-05','kcb','business','Other Business',10,0.78,false,false,NULL,'not_required'),
    ('expense', 5200.00,'Loan repayment instalment','KCB M-PESA',NULL,'KCB M-PESA','DEMO-BIZ-06','kcb','business','Loan Repayment',11,0.89,false,false,NULL,'not_required'),
    ('expense', 8000.00,'Support to upcountry family','Mum',NULL,'Grace Wanjiru','DEMO-FAM-06','mpesa','family','Family Support',12,0.83,false,false,'personal','agreed'),
    ('expense', 4300.00,'Shop electricity bill','KPLC',NULL,'KPLC','DEMO-BIZ-07','mpesa','business','Utilities',13,0.92,false,false,NULL,'not_required'),
    ('income', 9400.00,'Weekend sales','Duka','MPESA',NULL,'DEMO-BIZ-08','mpesa','business','Business Revenue',14,0.95,false,false,NULL,'not_required'),
    ('expense', 1750.00,'Family matatu fare to shags',NULL,NULL,NULL,'DEMO-FAM-07','cash','family','Family Transport',15,1.00,true,false,'personal','not_required')
  ) AS d(ttype, amount, description, merchant, sender, recipient, reference, source, scope, cat,
         days_ago, confidence, is_manual, needs_review, funded_from, consensus);

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
