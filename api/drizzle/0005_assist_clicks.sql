CREATE TABLE IF NOT EXISTS "assist_clicks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"iata" char(3) NOT NULL,
	"provider" text NOT NULL,
	"need_id" uuid,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assist_clicks" ADD CONSTRAINT "assist_clicks_need_id_needs_id_fk" FOREIGN KEY ("need_id") REFERENCES "public"."needs"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assist_clicks" ADD CONSTRAINT "assist_clicks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assist_clicks_created" ON "assist_clicks" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assist_clicks_iata" ON "assist_clicks" USING btree ("iata");