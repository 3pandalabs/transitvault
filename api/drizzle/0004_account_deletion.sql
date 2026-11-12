DO $$ BEGIN ALTER TYPE "public"."credit_reason" ADD VALUE IF NOT EXISTS 'account_deleted'; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;
