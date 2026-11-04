CREATE TABLE "profiles" (
	"user_id" text PRIMARY KEY,
	"first_name" text NOT NULL,
	"age_range" text NOT NULL,
	"pays" text NOT NULL,
	"classe" text NOT NULL,
	"serie" text DEFAULT '' NOT NULL,
	"langues" text[] NOT NULL,
	"niveau_prefere" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;