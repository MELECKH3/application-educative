CREATE TABLE "ai_events" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"mode" text,
	"status" text NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ai_reports" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"question" text,
	"answer" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_reports" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "app_settings" (
	"key" text PRIMARY KEY,
	"value" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "refresh_runs" (
	"id" text PRIMARY KEY,
	"trigger" text NOT NULL,
	"scope" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"created" integer DEFAULT 0 NOT NULL,
	"failed" integer DEFAULT 0 NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "refresh_runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "subjects" (
	"id" text PRIMARY KEY,
	"classe" text NOT NULL,
	"serie" text DEFAULT '' NOT NULL,
	"matiere" text NOT NULL,
	"niveau" integer NOT NULL,
	"titre" text NOT NULL,
	"chapitre" text NOT NULL,
	"enonce" text NOT NULL,
	"bareme" text NOT NULL,
	"duree_min" integer NOT NULL,
	"corrige" text,
	"run_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "subjects" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "ai_events_user_created_idx" ON "ai_events" ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "subjects_class_idx" ON "subjects" ("classe","serie","matiere","niveau");