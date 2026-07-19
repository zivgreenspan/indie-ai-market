-- Creator analytics dashboard needs historical traffic trends, but
-- products only ever stores the CURRENT month's count
-- (monthly_visit_count/visit_count_month), reset lazily on the next visit
-- after a month boundary (see recordProductVisit in
-- product-visits.functions.ts). This table captures a permanent snapshot
-- of each month's final count at the moment that lazy rollover happens,
-- so charts can show trends across months instead of only ever the
-- current one. Populated exclusively by recordProductVisit (service role);
-- no other write path needed per this feature's scope.
CREATE TABLE public.product_traffic_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  visit_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product_id, month)
);

GRANT SELECT ON public.product_traffic_history TO authenticated;
GRANT ALL ON public.product_traffic_history TO service_role;

ALTER TABLE public.product_traffic_history ENABLE ROW LEVEL SECURITY;

-- No authenticated INSERT/UPDATE policy - only the service-role-backed
-- recordProductVisit server function ever writes here, same treatment as
-- monthly_visit_count itself.
CREATE POLICY "Creators view own product traffic history" ON public.product_traffic_history
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.products
      WHERE id = product_traffic_history.product_id AND creator_id = auth.uid()
    )
  );

CREATE POLICY "Admins view all product traffic history" ON public.product_traffic_history
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'));

CREATE INDEX product_traffic_history_product_month_idx
  ON public.product_traffic_history(product_id, month);
