CREATE TYPE public.deployment_status AS ENUM ('none','pending','deploying','live','failed');
ALTER TABLE public.products ADD COLUMN deployment_status public.deployment_status NOT NULL DEFAULT 'none';