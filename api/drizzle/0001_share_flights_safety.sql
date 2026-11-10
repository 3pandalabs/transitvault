DO $$ BEGIN CREATE TYPE "public"."flight_status" AS ENUM('open', 'closed'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."report_reason" AS ENUM('spam', 'inappropriate', 'scam', 'other'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."report_target" AS ENUM('need', 'flight', 'user'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "flight_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"languages" text[] NOT NULL,
	"note" text,
	"legs" jsonb NOT NULL,
	"travel_date" date NOT NULL,
	"origin" char(3) NOT NULL,
	"destination" char(3) NOT NULL,
	"layovers" text[] DEFAULT '{}'::text[] NOT NULL,
	"flight_numbers" text[] NOT NULL,
	"status" "flight_status" DEFAULT 'open' NOT NULL,
	"hidden_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "flight_posts_languages_nonempty" CHECK (cardinality("flight_posts"."languages") >= 1)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "match_alerts" (
	"need_id" uuid NOT NULL,
	"flight_post_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "match_alerts_pk" PRIMARY KEY("need_id","flight_post_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporter_id" uuid NOT NULL,
	"target_type" "report_target" NOT NULL,
	"target_id" uuid NOT NULL,
	"reason" "report_reason" NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_blocks" (
	"blocker_id" uuid NOT NULL,
	"blocked_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_blocks_pk" PRIMARY KEY("blocker_id","blocked_id"),
	CONSTRAINT "user_blocks_distinct" CHECK ("user_blocks"."blocker_id" <> "user_blocks"."blocked_id")
);
--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "thanked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "thank_note" text;--> statement-breakpoint
ALTER TABLE "needs" ADD COLUMN IF NOT EXISTS "hidden_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "needs" ADD COLUMN IF NOT EXISTS "nudged_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "alerts_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "flight_posts" ADD CONSTRAINT "flight_posts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "match_alerts" ADD CONSTRAINT "match_alerts_need_id_needs_id_fk" FOREIGN KEY ("need_id") REFERENCES "public"."needs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "match_alerts" ADD CONSTRAINT "match_alerts_flight_post_id_flight_posts_id_fk" FOREIGN KEY ("flight_post_id") REFERENCES "public"."flight_posts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_blocker_id_users_id_fk" FOREIGN KEY ("blocker_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_blocked_id_users_id_fk" FOREIGN KEY ("blocked_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "flight_posts_user" ON "flight_posts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "flight_posts_status_date" ON "flight_posts" USING btree ("status","travel_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "flight_posts_route_date" ON "flight_posts" USING btree ("origin","destination","travel_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "flight_posts_flight_numbers" ON "flight_posts" USING gin ("flight_numbers");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "reports_once" ON "reports" USING btree ("reporter_id","target_type","target_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reports_target" ON "reports" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_blocks_blocked" ON "user_blocks" USING btree ("blocked_id");