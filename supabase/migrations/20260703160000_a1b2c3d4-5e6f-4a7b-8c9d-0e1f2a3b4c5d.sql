-- Replace the generic "website" field with a platform-type selector so
-- creators can point at their primary Instagram/YouTube/TikTok/X profile
-- instead of being asked for a personal website.
ALTER TABLE public.creator_profiles RENAME COLUMN website TO platform_link;
ALTER TABLE public.creator_profiles ADD COLUMN IF NOT EXISTS platform_type TEXT;
