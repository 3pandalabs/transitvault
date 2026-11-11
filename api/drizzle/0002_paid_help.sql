DO $$ BEGIN CREATE TYPE "public"."acceptance_outcome" AS ENUM('helped', 'no_show'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."acceptance_status" AS ENUM('pending_payment', 'confirmed', 'cancelled'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."credit_reason" AS ENUM('helper_reward', 'fee_applied', 'fee_restored', 'no_show_refund', 'card_refund'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "credit_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"amount_cents" integer NOT NULL,
	"reason" "credit_reason" NOT NULL,
	"need_id" uuid,
	"acceptance_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_entries_nonzero" CHECK ("credit_entries"."amount_cents" <> 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "helper_acceptances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"need_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"poster_id" uuid NOT NULL,
	"helper_id" uuid NOT NULL,
	"status" "acceptance_status" DEFAULT 'pending_payment' NOT NULL,
	"fee_cents" integer NOT NULL,
	"credit_applied_cents" integer DEFAULT 0 NOT NULL,
	"cash_cents" integer NOT NULL,
	"stripe_session_id" text,
	"checkout_url" text,
	"stripe_payment_intent_id" text,
	"paid_at" timestamp with time zone,
	"confirmed_at" timestamp with time zone,
	"lands_at" timestamp with time zone,
	"feedback_due_at" timestamp with time zone,
	"feedback_sent_at" timestamp with time zone,
	"feedback_token_hash" text,
	"outcome" "acceptance_outcome",
	"outcome_source" text,
	"outcome_at" timestamp with time zone,
	"reward_released_at" timestamp with time zone,
	"refunded_at" timestamp with time zone,
	"stripe_refund_id" text,
	"refund_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "helper_acceptances_fee_split" CHECK ("helper_acceptances"."credit_applied_cents" >= 0 AND "helper_acceptances"."cash_cents" >= 0 AND "helper_acceptances"."credit_applied_cents" + "helper_acceptances"."cash_cents" = "helper_acceptances"."fee_cents")
);
--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "reward_declined" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "strike_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "credit_entries" ADD CONSTRAINT "credit_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "credit_entries" ADD CONSTRAINT "credit_entries_need_id_needs_id_fk" FOREIGN KEY ("need_id") REFERENCES "public"."needs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "credit_entries" ADD CONSTRAINT "credit_entries_acceptance_id_helper_acceptances_id_fk" FOREIGN KEY ("acceptance_id") REFERENCES "public"."helper_acceptances"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "helper_acceptances" ADD CONSTRAINT "helper_acceptances_need_id_needs_id_fk" FOREIGN KEY ("need_id") REFERENCES "public"."needs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "helper_acceptances" ADD CONSTRAINT "helper_acceptances_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "helper_acceptances" ADD CONSTRAINT "helper_acceptances_poster_id_users_id_fk" FOREIGN KEY ("poster_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "helper_acceptances" ADD CONSTRAINT "helper_acceptances_helper_id_users_id_fk" FOREIGN KEY ("helper_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "credit_entries_user" ON "credit_entries" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "credit_entries_once" ON "credit_entries" USING btree ("acceptance_id","reason");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "helper_acceptances_one_per_need" ON "helper_acceptances" USING btree ("need_id") WHERE status <> 'cancelled';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "helper_acceptances_conversation" ON "helper_acceptances" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "helper_acceptances_status" ON "helper_acceptances" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "helper_acceptances_session" ON "helper_acceptances" USING btree ("stripe_session_id");