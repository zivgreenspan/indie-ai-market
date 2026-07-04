-- Add a 'rejected' product status and rejection reason so admins can reject
-- a submitted product with a note, and creators can see why + move it back
-- to draft. Also tighten the creator UPDATE policy so creators cannot set
-- their own product to 'rejected' (only admins can, via the existing
-- "Admins can manage all products" ALL policy).

ALTER TYPE public.product_status ADD VALUE IF NOT EXISTS 'rejected';
