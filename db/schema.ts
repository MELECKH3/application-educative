import {
  pgTable,
  text,
  integer,
  timestamp,
  index,
  jsonb,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

// No public database access: all reads/writes pass through authenticated server functions.
export const profiles = pgTable('profiles', {
  userId: text('user_id').primaryKey(),
  firstName: text('first_name').notNull(),
  ageRange: text('age_range').notNull(),
  pays: text('pays').notNull(),
  classe: text('classe').notNull(),
  serie: text('serie').notNull().default(''),
  langues: text('langues').array().notNull(),
  niveauPrefere: integer('niveau_prefere').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
}).enableRLS()

// Server-only administration and billing. No public RLS policies.
export const userRoles = pgTable('user_roles', {
  userId: text('user_id').primaryKey(),
  role: text('role').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
}).enableRLS()

export const payments = pgTable('payments', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => profiles.userId),
  email: text('email'),
  offerId: text('offer_id').notNull(),
  amount: integer('amount').notNull(),
  days: integer('days').notNull(),
  method: text('method').notNull(),
  reference: text('reference').notNull().unique(),
  status: text('status').notNull().default('pending'),
  reason: text('reason'),
  reviewedBy: text('reviewed_by'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  // Reçu envoyé dans l'application (Netlify Blobs privé) et analyse automatique du reçu.
  receiptKey: text('receipt_key'),
  receiptCheck: jsonb('receipt_check'),
}).enableRLS()

export const subscriptions = pgTable('subscriptions', {
  userId: text('user_id')
    .primaryKey()
    .references(() => profiles.userId),
  offerId: text('offer_id').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
}).enableRLS()

export const paymentAudit = pgTable('payment_audit', {
  id: text('id').primaryKey(),
  paymentId: text('payment_id')
    .notNull()
    .references(() => payments.id),
  actorId: text('actor_id').notNull(),
  action: text('action').notNull(),
  reason: text('reason'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
}).enableRLS()

// Journal d'usage de l'IA (limite de 20 messages/min, coûts, garde-fou). Aucun contenu stocké.
export const aiEvents = pgTable(
  'ai_events',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    kind: text('kind').notNull(),
    mode: text('mode'),
    status: text('status').notNull(),
    inputTokens: integer('input_tokens').notNull().default(0),
    outputTokens: integer('output_tokens').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('ai_events_user_created_idx').on(t.userId, t.createdAt)],
).enableRLS()

// Réponses de l'IA signalées par les élèves, pour la console admin.
export const aiReports = pgTable('ai_reports', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  kind: text('kind').notNull(),
  question: text('question'),
  answer: text('answer').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
}).enableRLS()

// Sujets d'entraînement générés par classe (toujours marqués EXEMPLE). Le corrigé reste côté serveur.
export const subjects = pgTable(
  'subjects',
  {
    id: text('id').primaryKey(),
    classe: text('classe').notNull(),
    serie: text('serie').notNull().default(''),
    matiere: text('matiere').notNull(),
    niveau: integer('niveau').notNull(),
    titre: text('titre').notNull(),
    chapitre: text('chapitre').notNull(),
    enonce: text('enonce').notNull(),
    bareme: text('bareme').notNull(),
    dureeMin: integer('duree_min').notNull(),
    corrige: text('corrige'),
    runId: text('run_id'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    // Sujet remplacé par le renouvellement hebdomadaire : caché d'Explorer, mais toujours
    // accessible par son identifiant (examen en cours, copie déjà rendue).
    archivedAt: timestamp('archived_at', { withTimezone: true }),
  },
  (t) => [
    index('subjects_class_idx').on(t.classe, t.serie, t.matiere, t.niveau),
    index('subjects_active_idx').on(
      t.classe,
      t.serie,
      t.archivedAt,
      t.createdAt,
    ),
  ],
).enableRLS()

// Exécutions de la Grande Actualisation (planifiée, admin ou première visite d'une classe).
export const refreshRuns = pgTable('refresh_runs', {
  id: text('id').primaryKey(),
  trigger: text('trigger').notNull(),
  scope: text('scope').notNull(),
  status: text('status').notNull().default('queued'),
  created: integer('created').notNull().default(0),
  failed: integer('failed').notNull().default(0),
  error: text('error'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  startedAt: timestamp('started_at', { withTimezone: true }),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
}).enableRLS()

// Réglages simples modifiables par l'admin (ex. pause de l'actualisation).
export const appSettings = pgTable('app_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
}).enableRLS()

// Quiz du jour : 10 QCM par classe et série, créés une fois par jour (minuit Abidjan = UTC).
// Les bonnes réponses restent côté serveur jusqu'à ce que l'élève ait rendu sa tentative.
export const dailyQuizzes = pgTable(
  'daily_quizzes',
  {
    id: text('id').primaryKey(),
    day: text('day').notNull(),
    classe: text('classe').notNull(),
    serie: text('serie').notNull().default(''),
    status: text('status').notNull().default('pending'),
    questions: jsonb('questions'),
    attempts: integer('attempts').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex('daily_quizzes_day_class_idx').on(t.day, t.classe, t.serie),
  ],
).enableRLS()

// Une seule tentative par élève et par quiz ; le score est calculé par le serveur.
export const quizAttempts = pgTable(
  'quiz_attempts',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    quizId: text('quiz_id').notNull(),
    day: text('day').notNull(),
    answers: jsonb('answers'),
    score: integer('score'),
    total: integer('total').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('quiz_attempts_user_quiz_idx').on(t.userId, t.quizId),
    index('quiz_attempts_user_day_idx').on(t.userId, t.day),
  ],
).enableRLS()

// Leçons rédigées par le Professeur IA, une seule fois par chapitre, puis partagées par la classe.
export const lessons = pgTable(
  'lessons',
  {
    id: text('id').primaryKey(),
    classe: text('classe').notNull(),
    serie: text('serie').notNull().default(''),
    matiere: text('matiere').notNull(),
    chapitre: text('chapitre').notNull(),
    chapitreKey: text('chapitre_key').notNull(),
    status: text('status').notNull().default('pending'),
    titre: text('titre'),
    content: jsonb('content'),
    error: text('error'),
    requestedBy: text('requested_by'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex('lessons_chapter_idx').on(
      t.classe,
      t.serie,
      t.matiere,
      t.chapitreKey,
    ),
    index('lessons_requested_idx').on(t.requestedBy, t.createdAt),
  ],
).enableRLS()

// Répétition espacée : rappel à J+1, J+3 puis J+7 après chaque résumé noté.
export const lessonReviews = pgTable(
  'lesson_reviews',
  {
    userId: text('user_id').notNull(),
    lessonId: text('lesson_id').notNull(),
    step: integer('step').notNull().default(0),
    lastNote: integer('last_note'),
    lastAt: timestamp('last_at', { withTimezone: true }).notNull().defaultNow(),
    nextAt: timestamp('next_at', { withTimezone: true }).notNull(),
  },
  (t) => [
    uniqueIndex('lesson_reviews_user_lesson_idx').on(t.userId, t.lessonId),
    index('lesson_reviews_due_idx').on(t.userId, t.nextAt),
  ],
).enableRLS()

// Journal d'audit de toutes les actions de la console admin (hors paiements, déjà dans payment_audit).
export const adminAudit = pgTable(
  'admin_audit',
  {
    id: text('id').primaryKey(),
    actorId: text('actor_id').notNull(),
    action: text('action').notNull(),
    target: text('target'),
    details: text('details'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('admin_audit_created_idx').on(t.createdAt)],
).enableRLS()

// Erreurs de sujets signalées par les élèves.
export const subjectReports = pgTable(
  'subject_reports',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    subjectId: text('subject_id').notNull(),
    reason: text('reason').notNull(),
    status: text('status').notNull().default('open'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('subject_reports_user_subject_idx').on(t.userId, t.subjectId),
    index('subject_reports_status_idx').on(t.status, t.createdAt),
  ],
).enableRLS()

// Boîte à idées des élèves, avec un vote par élève et par idée.
export const ideas = pgTable(
  'ideas',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    texte: text('texte').notNull(),
    status: text('status').notNull().default('nouvelle'),
    votes: integer('votes').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('ideas_created_idx').on(t.createdAt)],
).enableRLS()

export const ideaVotes = pgTable(
  'idea_votes',
  {
    ideaId: text('idea_id').notNull(),
    userId: text('user_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex('idea_votes_idea_user_idx').on(t.ideaId, t.userId)],
).enableRLS()

// Bilans hebdomadaires de l'Analyste (IA), rédigés à partir des chiffres réels de la base.
export const weeklyReports = pgTable('weekly_reports', {
  id: text('id').primaryKey(),
  week: text('week').notNull().unique(),
  stats: jsonb('stats').notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
}).enableRLS()

// Programme officiel d'une matière pour une classe/série : liste ordonnée des chapitres,
// établie une fois par le Professeur IA puis partagée. Les leçons sont rédigées chapitre par chapitre.
export const lessonProgrammes = pgTable(
  'lesson_programmes',
  {
    id: text('id').primaryKey(),
    classe: text('classe').notNull(),
    serie: text('serie').notNull().default(''),
    matiere: text('matiere').notNull(),
    status: text('status').notNull().default('pending'),
    chapitres: jsonb('chapitres'),
    attempts: integer('attempts').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex('lesson_programmes_idx').on(t.classe, t.serie, t.matiere),
  ],
).enableRLS()

// Forfait gratuit élargi (40 min/jour) : activé uniquement par l'administrateur pour un élève.
export const freePlanGrants = pgTable('free_plan_grants', {
  userId: text('user_id').primaryKey(),
  minutes: integer('minutes').notNull(),
  note: text('note'),
  grantedBy: text('granted_by').notNull(),
  // null = sans date de fin (jusqu'à révocation).
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
}).enableRLS()

// Temps d'utilisation du forfait gratuit, compté par le serveur (battement toutes les 30 s).
export const dailyUsage = pgTable(
  'daily_usage',
  {
    userId: text('user_id').notNull(),
    day: text('day').notNull(),
    seconds: integer('seconds').notNull().default(0),
    lastBeatAt: timestamp('last_beat_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex('daily_usage_user_day_idx').on(t.userId, t.day)],
).enableRLS()

// « Explique-moi cette leçon » : une explication par leçon et par niveau (selon la formule),
// rédigée une fois par le Professeur IA puis partagée par la classe.
export const lessonExplanations = pgTable(
  'lesson_explanations',
  {
    id: text('id').primaryKey(),
    lessonId: text('lesson_id').notNull(),
    niveau: text('niveau').notNull(),
    status: text('status').notNull().default('pending'),
    content: jsonb('content'),
    attempts: integer('attempts').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex('lesson_explanations_idx').on(t.lessonId, t.niveau),
  ],
).enableRLS()
