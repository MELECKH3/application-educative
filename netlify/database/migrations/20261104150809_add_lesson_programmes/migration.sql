CREATE TABLE "lesson_programmes" (
	"id" text PRIMARY KEY,
	"classe" text NOT NULL,
	"serie" text DEFAULT '' NOT NULL,
	"matiere" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"chapitres" jsonb,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lesson_programmes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE UNIQUE INDEX "lesson_programmes_idx" ON "lesson_programmes" ("classe","serie","matiere");