CREATE TABLE "daily_quizzes" (
	"id" text PRIMARY KEY,
	"day" text NOT NULL,
	"classe" text NOT NULL,
	"serie" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"questions" jsonb,
	"attempts" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "daily_quizzes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "lesson_reviews" (
	"user_id" text NOT NULL,
	"lesson_id" text NOT NULL,
	"step" integer DEFAULT 0 NOT NULL,
	"last_note" integer,
	"last_at" timestamp with time zone DEFAULT now() NOT NULL,
	"next_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lesson_reviews" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "lessons" (
	"id" text PRIMARY KEY,
	"classe" text NOT NULL,
	"serie" text DEFAULT '' NOT NULL,
	"matiere" text NOT NULL,
	"chapitre" text NOT NULL,
	"chapitre_key" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"titre" text,
	"content" jsonb,
	"error" text,
	"requested_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lessons" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quiz_attempts" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"quiz_id" text NOT NULL,
	"day" text NOT NULL,
	"answers" jsonb,
	"score" integer,
	"total" integer NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "quiz_attempts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "subjects" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "daily_quizzes_day_class_idx" ON "daily_quizzes" ("day","classe","serie");--> statement-breakpoint
CREATE UNIQUE INDEX "lesson_reviews_user_lesson_idx" ON "lesson_reviews" ("user_id","lesson_id");--> statement-breakpoint
CREATE INDEX "lesson_reviews_due_idx" ON "lesson_reviews" ("user_id","next_at");--> statement-breakpoint
CREATE UNIQUE INDEX "lessons_chapter_idx" ON "lessons" ("classe","serie","matiere","chapitre_key");--> statement-breakpoint
CREATE INDEX "lessons_requested_idx" ON "lessons" ("requested_by","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "quiz_attempts_user_quiz_idx" ON "quiz_attempts" ("user_id","quiz_id");--> statement-breakpoint
CREATE INDEX "quiz_attempts_user_day_idx" ON "quiz_attempts" ("user_id","day");--> statement-breakpoint
CREATE INDEX "subjects_active_idx" ON "subjects" ("classe","serie","archived_at","created_at");