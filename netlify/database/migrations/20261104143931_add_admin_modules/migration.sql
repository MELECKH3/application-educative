CREATE TABLE "admin_audit" (
	"id" text PRIMARY KEY,
	"actor_id" text NOT NULL,
	"action" text NOT NULL,
	"target" text,
	"details" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admin_audit" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "idea_votes" (
	"idea_id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "idea_votes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ideas" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"texte" text NOT NULL,
	"status" text DEFAULT 'nouvelle' NOT NULL,
	"votes" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ideas" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "subject_reports" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"subject_id" text NOT NULL,
	"reason" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "subject_reports" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "weekly_reports" (
	"id" text PRIMARY KEY,
	"week" text NOT NULL UNIQUE,
	"stats" jsonb NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "weekly_reports" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "admin_audit_created_idx" ON "admin_audit" ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idea_votes_idea_user_idx" ON "idea_votes" ("idea_id","user_id");--> statement-breakpoint
CREATE INDEX "ideas_created_idx" ON "ideas" ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "subject_reports_user_subject_idx" ON "subject_reports" ("user_id","subject_id");--> statement-breakpoint
CREATE INDEX "subject_reports_status_idx" ON "subject_reports" ("status","created_at");