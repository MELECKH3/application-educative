CREATE TABLE "daily_usage" (
	"user_id" text NOT NULL,
	"day" text NOT NULL,
	"seconds" integer DEFAULT 0 NOT NULL,
	"last_beat_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "daily_usage" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "free_plan_grants" (
	"user_id" text PRIMARY KEY,
	"minutes" integer NOT NULL,
	"note" text,
	"granted_by" text NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "free_plan_grants" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "lesson_explanations" (
	"id" text PRIMARY KEY,
	"lesson_id" text NOT NULL,
	"niveau" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"content" jsonb,
	"attempts" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lesson_explanations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "receipt_key" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "receipt_check" jsonb;--> statement-breakpoint
CREATE UNIQUE INDEX "daily_usage_user_day_idx" ON "daily_usage" ("user_id","day");--> statement-breakpoint
CREATE UNIQUE INDEX "lesson_explanations_idx" ON "lesson_explanations" ("lesson_id","niveau");