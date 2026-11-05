import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { VIP_WELCOME_DAYS } from './config'

// Modules de la console admin (jalon 9). Chaque fonction vérifie l'accès admin côté serveur
// et ne renvoie que des chiffres issus de la base : aucun chiffre fictif.

async function ctx() {
  const { requireAdmin } = await import('./billing.server')
  const admin = await requireAdmin()
  const { getDatabase } = await import('@netlify/database')
  const { logAdmin } = await import('./admin.server')
  return {
    admin,
    db: getDatabase(),
    log: (action: string, target?: string | null, details?: string | null) =>
      logAdmin(admin.id, action, target, details),
  }
}

const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null)
const num = (v: unknown) => Number(v ?? 0)

/* 1. Tableau de bord */
export const getAdminStats = createServerFn({ method: 'GET' }).handler(
  async () => {
    const { db } = await ctx()
    const [r] = await db.sql`SELECT
      (SELECT count(*)::int FROM profiles) AS inscrits,
      (SELECT count(*)::int FROM profiles WHERE created_at > now() - interval '7 days') AS nouveaux7,
      (SELECT count(DISTINCT user_id)::int FROM (
        SELECT user_id FROM ai_events WHERE created_at >= current_date AND user_id <> 'systeme'
        UNION SELECT user_id FROM quiz_attempts WHERE started_at >= current_date) a) AS actifs_jour,
      (SELECT count(DISTINCT user_id)::int FROM (
        SELECT user_id FROM ai_events WHERE created_at > now() - interval '7 days' AND user_id <> 'systeme'
        UNION SELECT user_id FROM quiz_attempts WHERE started_at > now() - interval '7 days') a) AS actifs_semaine,
      (SELECT count(*)::int FROM subscriptions WHERE expires_at > now()) AS abonnes,
      (SELECT count(*)::int FROM subscriptions WHERE expires_at > now() AND expires_at < now() + interval '7 days') AS expirent7,
      (SELECT count(*)::int FROM profiles f WHERE f.created_at > now() - make_interval(days => ${VIP_WELCOME_DAYS}::int)
        AND NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s.user_id = f.user_id AND s.expires_at > now())) AS en_essai,
      (SELECT count(*)::int FROM profiles f WHERE f.created_at <= now() - make_interval(days => ${VIP_WELCOME_DAYS}::int)
        AND NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s.user_id = f.user_id AND s.expires_at > now())) AS bloques,
      (SELECT count(*)::int FROM free_plan_grants WHERE expires_at IS NULL OR expires_at > now()) AS forfaits40,
      (SELECT COALESCE(sum(amount), 0)::bigint FROM payments WHERE status = 'accepted') AS revenus_total,
      (SELECT COALESCE(sum(amount), 0)::bigint FROM payments WHERE status = 'accepted'
        AND created_at >= date_trunc('month', now())) AS revenus_mois,
      (SELECT count(*)::int FROM payments WHERE status = 'pending') AS paiements_attente,
      (SELECT count(*)::int FROM subjects WHERE archived_at IS NULL) AS sujets_actifs,
      (SELECT count(*)::int FROM lessons WHERE status = 'ready') AS lecons,
      (SELECT count(*)::int FROM subject_reports WHERE status = 'open') AS signalements,
      (SELECT count(*)::int FROM ideas WHERE status = 'nouvelle') AS idees`
    return {
      inscrits: num(r.inscrits),
      nouveaux7: num(r.nouveaux7),
      actifsJour: num(r.actifs_jour),
      actifsSemaine: num(r.actifs_semaine),
      abonnes: num(r.abonnes),
      expirent7: num(r.expirent7),
      enEssai: num(r.en_essai),
      bloques: num(r.bloques),
      forfaits40: num(r.forfaits40),
      revenusTotal: num(r.revenus_total),
      revenusMois: num(r.revenus_mois),
      paiementsAttente: num(r.paiements_attente),
      sujetsActifs: num(r.sujets_actifs),
      lecons: num(r.lecons),
      signalements: num(r.signalements),
      idees: num(r.idees),
    }
  },
)

/* 2. Abonnements */
export const listSubscriptions = createServerFn({ method: 'GET' })
  .validator(
    z.object({
      filtre: z.enum(['actifs', 'expirent', 'expires']).default('actifs'),
    }),
  )
  .handler(async ({ data }) => {
    const { db } = await ctx()
    const rows =
      await db.sql`SELECT s.user_id, s.offer_id, s.expires_at::text, f.first_name, f.classe, f.serie
      FROM subscriptions s JOIN profiles f ON f.user_id = s.user_id
      WHERE (${data.filtre} = 'actifs' AND s.expires_at > now())
         OR (${data.filtre} = 'expirent' AND s.expires_at > now() AND s.expires_at < now() + interval '7 days')
         OR (${data.filtre} = 'expires' AND s.expires_at <= now())
      ORDER BY s.expires_at LIMIT 100`
    return rows.map((r) => ({
      userId: String(r.user_id),
      offerId: String(r.offer_id),
      expiresAt: iso(r.expires_at)!,
      firstName: String(r.first_name),
      classe: `${r.classe} ${r.serie ?? ''}`.trim(),
    }))
  })

/** 2 et 3. Prolonger, révoquer ou offrir un accès Premium (déblocage manuel). */
export const changeAccess = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      userId: z.string().min(1).max(100),
      action: z.enum(['offrir', 'revoquer']),
      days: z.number().int().min(1).max(366).default(7),
      reason: z.string().trim().min(3).max(300),
    }),
  )
  .handler(async ({ data }) => {
    const { log } = await ctx()
    const { billingTransaction, activateSubscription } =
      await import('./billing.server')
    await billingTransaction(async (client) => {
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        data.userId,
      ])
      const student = await client.query(
        'SELECT user_id FROM profiles WHERE user_id = $1',
        [data.userId],
      )
      if (!student.rows.length) throw new Error('Élève introuvable.')
      if (data.action === 'offrir') {
        await activateSubscription(client, data.userId, 'deblocage', data.days)
      } else {
        await client.query(
          'UPDATE subscriptions SET expires_at = now(), updated_at = now() WHERE user_id = $1',
          [data.userId],
        )
      }
    })
    await log(
      data.action === 'offrir' ? 'acces_offert' : 'acces_revoque',
      data.userId,
      data.action === 'offrir'
        ? `${data.days} jour(s) · ${data.reason}`
        : data.reason,
    )
    return { saved: true }
  })

/** Forfait gratuit 40 min/jour : réservé aux élèves choisis par l'administrateur. */
export const listFreeGrants = createServerFn({ method: 'GET' }).handler(
  async () => {
    const { db } = await ctx()
    const rows =
      await db.sql`SELECT g.user_id, g.minutes, g.note, g.expires_at::text, g.created_at::text,
        f.first_name, f.classe, f.serie,
        COALESCE((SELECT u.seconds FROM daily_usage u WHERE u.user_id = g.user_id
          AND u.day = to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD')), 0)::int AS today
      FROM free_plan_grants g JOIN profiles f ON f.user_id = g.user_id
      WHERE g.expires_at IS NULL OR g.expires_at > now()
      ORDER BY g.created_at DESC LIMIT 200`
    return rows.map((r) => ({
      userId: String(r.user_id),
      minutes: num(r.minutes),
      note: r.note ? String(r.note) : null,
      expiresAt: iso(r.expires_at),
      createdAt: iso(r.created_at)!,
      firstName: String(r.first_name),
      classe: `${r.classe} ${r.serie ?? ''}`.trim(),
      minutesAujourdhui: Math.round(num(r.today) / 60),
    }))
  },
)

export const setFreeGrant = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      userId: z.string().min(1).max(100),
      action: z.enum(['activer', 'retirer']),
      // 0 = sans date de fin (jusqu'à ce que l'admin le retire).
      days: z.number().int().min(0).max(366).default(0),
      note: z.string().trim().min(3).max(300),
    }),
  )
  .handler(async ({ data }) => {
    const { db, admin, log } = await ctx()
    const { ADMIN_FREE_MINUTES_PER_DAY } = await import('./config')
    const [student] =
      await db.sql`SELECT user_id FROM profiles WHERE user_id = ${data.userId}`
    if (!student) throw new Error('Élève introuvable.')
    if (data.action === 'activer') {
      const days = data.days || null
      await db.sql`INSERT INTO free_plan_grants (user_id, minutes, note, granted_by, expires_at)
        VALUES (${data.userId}, ${ADMIN_FREE_MINUTES_PER_DAY}, ${data.note}, ${admin.id},
          CASE WHEN ${days}::int IS NULL THEN NULL ELSE now() + make_interval(days => ${days}::int) END)
        ON CONFLICT (user_id) DO UPDATE SET minutes = EXCLUDED.minutes, note = EXCLUDED.note,
          granted_by = EXCLUDED.granted_by, expires_at = EXCLUDED.expires_at, created_at = now()`
    } else {
      await db.sql`DELETE FROM free_plan_grants WHERE user_id = ${data.userId}`
    }
    await log(
      data.action === 'activer' ? 'forfait_40_active' : 'forfait_40_retire',
      data.userId,
      data.action === 'activer'
        ? `${data.days ? `${data.days} jour(s)` : 'sans date de fin'} · ${data.note}`
        : data.note,
    )
    return { saved: true }
  })

/* 4. Sujets */
export const searchSubjects = createServerFn({ method: 'GET' })
  .validator(
    z.object({
      q: z.string().trim().max(100).default(''),
      classe: z.string().max(20).default(''),
      archives: z.boolean().default(false),
    }),
  )
  .handler(async ({ data }) => {
    const { db } = await ctx()
    const q = data.q || null
    const classe = data.classe || null
    const rows =
      await db.sql`SELECT id, classe, serie, matiere, niveau, titre, chapitre, created_at::text, archived_at::text,
        (SELECT count(*)::int FROM subject_reports r WHERE r.subject_id = subjects.id AND r.status = 'open') AS signalements
      FROM subjects
      WHERE (${data.archives} OR archived_at IS NULL)
        AND (${classe}::text IS NULL OR classe = ${classe})
        AND (${q}::text IS NULL OR strpos(lower(titre || ' ' || chapitre || ' ' || matiere), lower(${q})) > 0 OR id = ${q})
      ORDER BY created_at DESC LIMIT 40`
    return rows.map((r) => ({
      id: String(r.id),
      classe: `${r.classe} ${r.serie ?? ''}`.trim(),
      matiere: String(r.matiere),
      niveau: num(r.niveau),
      titre: String(r.titre),
      chapitre: String(r.chapitre),
      createdAt: iso(r.created_at)!,
      archivedAt: iso(r.archived_at),
      signalements: num(r.signalements),
    }))
  })

export const getSubjectAdmin = createServerFn({ method: 'GET' })
  .validator(z.object({ id: z.string().min(1).max(100) }))
  .handler(async ({ data }) => {
    const { db } = await ctx()
    const [r] =
      await db.sql`SELECT id, titre, enonce, bareme, corrige FROM subjects WHERE id = ${data.id}`
    if (!r) throw new Error('Sujet introuvable.')
    const reports =
      await db.sql`SELECT reason, created_at::text FROM subject_reports
      WHERE subject_id = ${data.id} ORDER BY created_at DESC LIMIT 10`
    return {
      id: String(r.id),
      titre: String(r.titre),
      enonce: String(r.enonce),
      bareme: String(r.bareme),
      corrige: r.corrige ? String(r.corrige) : null,
      reports: reports.map((x) => ({
        reason: String(x.reason),
        createdAt: iso(x.created_at)!,
      })),
    }
  })

export const setSubjectArchived = createServerFn({ method: 'POST' })
  .validator(
    z.object({ id: z.string().min(1).max(100), archived: z.boolean() }),
  )
  .handler(async ({ data }) => {
    const { db, log } = await ctx()
    // Archiver n'efface rien : un examen en cours garde son sujet.
    await db.sql`UPDATE subjects SET archived_at = CASE WHEN ${data.archived} THEN now() ELSE NULL END WHERE id = ${data.id}`
    if (data.archived)
      await db.sql`UPDATE subject_reports SET status = 'resolved', resolved_at = now()
        WHERE subject_id = ${data.id} AND status = 'open'`
    await log(data.archived ? 'sujet_archive' : 'sujet_reactive', data.id)
    return { saved: true }
  })

/* 5. Leçons */
export const listLessonsAdmin = createServerFn({ method: 'GET' })
  .validator(z.object({ q: z.string().trim().max(100).default('') }))
  .handler(async ({ data }) => {
    const { db } = await ctx()
    const q = data.q || null
    const rows =
      await db.sql`SELECT l.id, l.classe, l.serie, l.matiere, l.chapitre, l.status, l.titre, l.error, l.created_at::text,
        (SELECT count(*)::int FROM lesson_reviews r WHERE r.lesson_id = l.id) AS eleves
      FROM lessons l
      WHERE ${q}::text IS NULL OR strpos(lower(l.chapitre || ' ' || COALESCE(l.titre, '') || ' ' || l.matiere), lower(${q})) > 0
      ORDER BY l.created_at DESC LIMIT 40`
    return rows.map((r) => ({
      id: String(r.id),
      classe: `${r.classe} ${r.serie ?? ''}`.trim(),
      matiere: String(r.matiere),
      chapitre: String(r.chapitre),
      titre: r.titre ? String(r.titre) : null,
      status: String(r.status),
      error: r.error ? String(r.error) : null,
      createdAt: iso(r.created_at)!,
      eleves: num(r.eleves),
    }))
  })

export const getLessonAdmin = createServerFn({ method: 'GET' })
  .validator(z.object({ id: z.string().min(1).max(100) }))
  .handler(async ({ data }) => {
    const { db } = await ctx()
    const [r] =
      await db.sql`SELECT titre, chapitre, content FROM lessons WHERE id = ${data.id}`
    if (!r) throw new Error('Leçon introuvable.')
    const content = r.content as {
      etapes?: { titre?: string; contenu?: string[] }[]
    } | null
    const steps = Array.isArray(content?.etapes)
      ? content.etapes
      : Array.isArray(content)
        ? (content as { titre?: string; contenu?: string[] }[])
        : []
    return {
      titre: String(r.titre ?? r.chapitre),
      texte:
        steps.length > 0
          ? steps
              .map((s) => `${s.titre ?? ''}\n${(s.contenu ?? []).join('\n')}`)
              .join('\n\n')
          : JSON.stringify(r.content ?? {}, null, 2).slice(0, 8000),
    }
  })

/** Supprimer une leçon : elle sera rédigée à nouveau à la prochaine demande d'un élève. */
export const deleteLesson = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.string().min(1).max(100) }))
  .handler(async ({ data }) => {
    const { db, log } = await ctx()
    await db.sql`DELETE FROM lesson_reviews WHERE lesson_id = ${data.id}`
    await db.sql`DELETE FROM lessons WHERE id = ${data.id}`
    await log('lecon_supprimee', data.id)
    return { saved: true }
  })

/* 6. Quiz du jour */
export const listQuizzesAdmin = createServerFn({ method: 'GET' }).handler(
  async () => {
    const { db } = await ctx()
    const { quizDay } = await import('./quiz')
    const day = quizDay()
    const rows =
      await db.sql`SELECT q.id, q.classe, q.serie, q.status, q.attempts AS essais,
      count(a.id)::int AS tentatives, count(a.finished_at)::int AS rendus,
      COALESCE(avg(a.score) FILTER (WHERE a.finished_at IS NOT NULL), 0)::float AS moyenne,
      max(a.total) AS total
    FROM daily_quizzes q LEFT JOIN quiz_attempts a ON a.quiz_id = q.id
    WHERE q.day = ${day}
    GROUP BY q.id ORDER BY q.classe, q.serie`
    return {
      day,
      quizzes: rows.map((r) => ({
        id: String(r.id),
        classe: `${r.classe} ${r.serie ?? ''}`.trim(),
        status: String(r.status),
        tentatives: num(r.tentatives),
        rendus: num(r.rendus),
        moyenne: Math.round(num(r.moyenne) * 10) / 10,
        total: num(r.total) || 10,
      })),
    }
  },
)

/** Régénérer un quiz : possible seulement si aucun élève ne l'a commencé (sinon la note changerait). */
export const resetQuiz = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.string().min(1).max(100) }))
  .handler(async ({ data }) => {
    const { db, log } = await ctx()
    const [a] =
      await db.sql`SELECT count(*)::int AS n FROM quiz_attempts WHERE quiz_id = ${data.id}`
    if (num(a?.n) > 0)
      throw new Error(
        'Des élèves ont déjà commencé ce quiz : il ne peut plus être remplacé.',
      )
    await db.sql`DELETE FROM daily_quizzes WHERE id = ${data.id}`
    await log('quiz_regenere', data.id)
    return { saved: true }
  })

/* 7. Annonce globale */
export const getAnnouncementAdmin = createServerFn({ method: 'GET' }).handler(
  async () => {
    await ctx()
    const { currentAnnouncement } = await import('./admin.server')
    return currentAnnouncement()
  },
)

export const setAnnouncement = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      message: z.string().trim().max(280),
      niveau: z.enum(['info', 'alerte']).default('info'),
      jours: z.number().int().min(0).max(60).default(3),
    }),
  )
  .handler(async ({ data }) => {
    const { log } = await ctx()
    const { setSetting } = await import('./sujets.server')
    const fin =
      data.jours > 0
        ? new Date(Date.now() + data.jours * 86_400_000).toISOString()
        : null
    await setSetting(
      'annonce',
      data.message
        ? JSON.stringify({ message: data.message, niveau: data.niveau, fin })
        : '',
    )
    await log(
      data.message ? 'annonce_publiee' : 'annonce_retiree',
      null,
      data.message || null,
    )
    return { saved: true }
  })

/** Annonce affichée aux élèves (lecture publique pour l'espace élève). */
export const getAnnouncement = createServerFn({ method: 'GET' }).handler(
  async () => {
    const { currentAnnouncement } = await import('./admin.server')
    return currentAnnouncement()
  },
)

/* 8. Interrupteurs d'urgence */
export const getSwitches = createServerFn({ method: 'GET' }).handler(
  async () => {
    const { db } = await ctx()
    const { SWITCHES } = await import('./admin.server')
    const rows =
      await db.sql`SELECT key, value FROM app_settings WHERE key = ANY(${Object.keys(SWITCHES)})`
    const on = new Set(
      rows.filter((r) => r.value === 'oui').map((r) => String(r.key)),
    )
    return Object.entries(SWITCHES).map(([key, label]) => ({
      key,
      label,
      on: on.has(key),
    }))
  },
)

export const setSwitch = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      key: z.enum([
        'coupure_ia',
        'coupure_oral',
        'coupure_generation',
        'coupure_inscriptions',
      ]),
      on: z.boolean(),
    }),
  )
  .handler(async ({ data }) => {
    const { log } = await ctx()
    const { setSetting } = await import('./sujets.server')
    await setSetting(data.key, data.on ? 'oui' : 'non')
    await log(data.on ? 'interrupteur_coupe' : 'interrupteur_retabli', data.key)
    return { saved: true }
  })

/* 9. Exports CSV */
export const exportCsv = createServerFn({ method: 'POST' })
  .validator(z.object({ type: z.enum(['eleves', 'paiements', 'abonnements']) }))
  .handler(async ({ data }) => {
    const { db, log } = await ctx()
    const { toCsv } = await import('./admin.server')
    let csv: string
    if (data.type === 'eleves') {
      const rows =
        await db.sql`SELECT user_id, first_name, classe, serie, pays, age_range, created_at::text FROM profiles ORDER BY created_at LIMIT 50000`
      csv = toCsv(
        [
          'identifiant',
          'prenom',
          'classe',
          'serie',
          'pays',
          'age',
          'inscription',
        ],
        rows.map((r) => [
          r.user_id,
          r.first_name,
          r.classe,
          r.serie,
          r.pays,
          r.age_range,
          r.created_at,
        ]),
      )
    } else if (data.type === 'paiements') {
      const rows =
        await db.sql`SELECT id, user_id, offer_id, amount, method, reference, status, reason, created_at::text FROM payments ORDER BY created_at LIMIT 50000`
      csv = toCsv(
        [
          'id',
          'eleve',
          'offre',
          'montant_fcfa',
          'moyen',
          'reference',
          'statut',
          'motif',
          'date',
        ],
        rows.map((r) => [
          r.id,
          r.user_id,
          r.offer_id,
          r.amount,
          r.method,
          r.reference,
          r.status,
          r.reason,
          r.created_at,
        ]),
      )
    } else {
      const rows =
        await db.sql`SELECT s.user_id, f.first_name, s.offer_id, s.expires_at::text, s.expires_at > now() AS actif
        FROM subscriptions s LEFT JOIN profiles f ON f.user_id = s.user_id ORDER BY s.expires_at LIMIT 50000`
      csv = toCsv(
        ['eleve', 'prenom', 'offre', 'expiration', 'actif'],
        rows.map((r) => [
          r.user_id,
          r.first_name,
          r.offer_id,
          r.expires_at,
          r.actif ? 'oui' : 'non',
        ]),
      )
    }
    await log('export_csv', data.type)
    return {
      filename: `annales-${data.type}-${new Date().toISOString().slice(0, 10)}.csv`,
      csv,
    }
  })

/* Sauvegarde complète : toutes les tables, pour pouvoir changer d'hébergeur (voir HEBERGEMENT.md). */
const BACKUP_PAGE = 2000

async function backupTables(db: Awaited<ReturnType<typeof ctx>>['db']) {
  const rows = await db.sql<{
    table_name: string
  }>`SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name`
  return rows.map((r) => String(r.table_name))
}

export const listBackupTables = createServerFn({ method: 'GET' }).handler(
  async () => {
    const { db, log } = await ctx()
    const tables = await backupTables(db)
    const counts = await Promise.all(
      tables.map(async (t) => {
        const { rows } = await db.pool.query(
          `SELECT count(*)::int AS n FROM "${t.replace(/"/g, '""')}"`,
        )
        return { table: t, rows: Number(rows[0]?.n ?? 0) }
      }),
    )
    await log('sauvegarde_complete', null, `${tables.length} tables`)
    return counts
  },
)

export const exportBackupTable = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      table: z.string().min(1).max(63),
      page: z.number().int().min(0).max(10000),
    }),
  )
  .handler(async ({ data }) => {
    const { db } = await ctx()
    // Le nom n'est accepté que s'il figure dans la liste réelle des tables (aucune injection possible).
    if (!(await backupTables(db)).includes(data.table))
      throw new Error('Table inconnue.')
    const { rows } = await db.pool.query(
      `SELECT * FROM "${data.table.replace(/"/g, '""')}" ORDER BY 1 LIMIT $1 OFFSET $2`,
      [BACKUP_PAGE, data.page * BACKUP_PAGE],
    )
    return { rows, more: rows.length === BACKUP_PAGE }
  })

/** Comptes de connexion (sans mot de passe) : relie chaque identifiant élève à son adresse e-mail. */
export const exportAccounts = createServerFn({ method: 'GET' }).handler(
  async () => {
    await ctx()
    const { admin } = await import('@netlify/identity')
    const out: {
      id: string
      email: string | null
      roles: string[]
      confirmedAt: string | null
      createdAt: string | null
    }[] = []
    for (let page = 1; page <= 200; page++) {
      const users = await admin.listUsers({ page, perPage: 100 })
      for (const u of users)
        out.push({
          id: u.id,
          email: u.email ?? null,
          roles: u.roles ?? [],
          confirmedAt: u.confirmedAt ?? null,
          createdAt: u.createdAt ?? null,
        })
      if (users.length < 100) break
    }
    return out
  },
)

/* 10. Signalements (sujets + réponses de l'IA) */
export const listReports = createServerFn({ method: 'GET' }).handler(
  async () => {
    const { db } = await ctx()
    const sujets =
      await db.sql`SELECT r.id, r.subject_id, r.reason, r.created_at::text, s.titre, s.classe, s.serie, s.matiere, p.first_name
    FROM subject_reports r LEFT JOIN subjects s ON s.id = r.subject_id LEFT JOIN profiles p ON p.user_id = r.user_id
    WHERE r.status = 'open' ORDER BY r.created_at DESC LIMIT 50`
    const ia =
      await db.sql`SELECT r.id, r.kind, r.question, r.answer, r.created_at::text, p.first_name
    FROM ai_reports r LEFT JOIN profiles p ON p.user_id = r.user_id ORDER BY r.created_at DESC LIMIT 20`
    return {
      sujets: sujets.map((r) => ({
        id: String(r.id),
        subjectId: String(r.subject_id),
        reason: String(r.reason),
        titre: r.titre ? String(r.titre) : 'Sujet d’aperçu',
        classe:
          `${r.classe ?? ''} ${r.serie ?? ''} · ${r.matiere ?? ''}`.trim(),
        firstName: r.first_name ? String(r.first_name) : '—',
        createdAt: iso(r.created_at)!,
      })),
      ia: ia.map((r) => ({
        id: String(r.id),
        kind: String(r.kind),
        question: r.question ? String(r.question).slice(0, 300) : null,
        answer: String(r.answer).slice(0, 500),
        firstName: r.first_name ? String(r.first_name) : '—',
        createdAt: iso(r.created_at)!,
      })),
    }
  },
)

export const resolveReport = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.string().min(1).max(100) }))
  .handler(async ({ data }) => {
    const { db, log } = await ctx()
    await db.sql`UPDATE subject_reports SET status = 'resolved', resolved_at = now() WHERE id = ${data.id}`
    await log('signalement_traite', data.id)
    return { saved: true }
  })

/* 11. Boîte à idées */
export const listIdeasAdmin = createServerFn({ method: 'GET' }).handler(
  async () => {
    const { db } = await ctx()
    const rows =
      await db.sql`SELECT i.id, i.texte, i.status, i.votes, i.created_at::text, p.first_name, p.classe
    FROM ideas i LEFT JOIN profiles p ON p.user_id = i.user_id
    ORDER BY (i.status = 'nouvelle') DESC, i.votes DESC, i.created_at DESC LIMIT 60`
    return rows.map((r) => ({
      id: String(r.id),
      texte: String(r.texte),
      status: String(r.status),
      votes: num(r.votes),
      auteur: r.first_name ? `${r.first_name} (${r.classe})` : '—',
      createdAt: iso(r.created_at)!,
    }))
  },
)

export const setIdeaStatus = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      id: z.string().min(1).max(100),
      status: z.enum(['nouvelle', 'retenue', 'realisee', 'refusee']),
    }),
  )
  .handler(async ({ data }) => {
    const { db, log } = await ctx()
    await db.sql`UPDATE ideas SET status = ${data.status} WHERE id = ${data.id}`
    await log('idee_statut', data.id, data.status)
    return { saved: true }
  })

/* 12. Sentinelle : signaux réels calculés à partir de la base, avec gravité. */
export const getSentinel = createServerFn({ method: 'GET' }).handler(
  async () => {
    const { db } = await ctx()
    type Alerte = {
      gravite: 'haute' | 'moyenne' | 'basse'
      titre: string
      detail: string
    }
    const alertes: Alerte[] = []
    const rafalesPaiements =
      await db.sql`SELECT p.user_id, f.first_name, count(*)::int AS n
    FROM payments p LEFT JOIN profiles f ON f.user_id = p.user_id
    WHERE p.created_at > now() - interval '24 hours' GROUP BY 1, 2 HAVING count(*) >= 3 ORDER BY n DESC LIMIT 10`
    for (const r of rafalesPaiements)
      alertes.push({
        gravite: num(r.n) >= 5 ? 'haute' : 'moyenne',
        titre: 'Rafale de déclarations de paiement',
        detail: `${r.first_name ?? r.user_id} : ${r.n} déclarations en 24 h.`,
      })
    const refus =
      await db.sql`SELECT p.user_id, f.first_name, count(*)::int AS n
    FROM payments p LEFT JOIN profiles f ON f.user_id = p.user_id
    WHERE p.status = 'rejected' AND p.created_at > now() - interval '30 days' GROUP BY 1, 2 HAVING count(*) >= 2 ORDER BY n DESC LIMIT 10`
    for (const r of refus)
      alertes.push({
        gravite: num(r.n) >= 3 ? 'haute' : 'moyenne',
        titre: 'Reçus refusés à répétition',
        detail: `${r.first_name ?? r.user_id} : ${r.n} paiements refusés en 30 jours.`,
      })
    // Chaque paiement en attente passe par les règles de la Sentinelle (rejeu, ID inventé, montant…).
    const enAttente =
      await db.sql`SELECT p.id, p.reference, f.first_name FROM payments p
      LEFT JOIN profiles f ON f.user_id = p.user_id
      WHERE p.status = 'pending' ORDER BY p.created_at DESC LIMIT 100`
    const { sentinelVerdicts } = await import('./sentinel.server')
    const verdicts = await sentinelVerdicts(enAttente.map((p) => String(p.id)))
    for (const p of enAttente) {
      const v = verdicts[String(p.id)]
      if (!v?.gravite || v.gravite === 'basse') continue
      alertes.push({
        gravite: v.gravite,
        titre: `Paiement suspect (${v.score}/100)`,
        detail: `${p.first_name ?? 'Élève'} · transaction ${p.reference} : ${v.motifs.map((m) => m.texte).join(' ')}`,
      })
    }
    const rafalesIa =
      await db.sql`SELECT e.user_id, f.first_name, count(*)::int AS n
    FROM ai_events e LEFT JOIN profiles f ON f.user_id = e.user_id
    WHERE e.created_at > now() - interval '1 hour' AND e.user_id <> 'systeme' GROUP BY 1, 2 HAVING count(*) >= 40 ORDER BY n DESC LIMIT 10`
    for (const r of rafalesIa)
      alertes.push({
        gravite: num(r.n) >= 80 ? 'haute' : 'moyenne',
        titre: 'Usage intensif de l’IA',
        detail: `${r.first_name ?? r.user_id} : ${r.n} requêtes en 1 heure.`,
      })
    const [erreurs] =
      await db.sql`SELECT count(*) FILTER (WHERE status = 'error')::int AS err, count(*)::int AS total
    FROM ai_events WHERE created_at > now() - interval '24 hours'`
    if (
      num(erreurs?.total) >= 20 &&
      num(erreurs?.err) / num(erreurs?.total) > 0.2
    )
      alertes.push({
        gravite: 'moyenne',
        titre: 'Taux d’erreur de l’IA élevé',
        detail: `${erreurs.err} erreurs sur ${erreurs.total} requêtes en 24 h.`,
      })
    const echecs =
      await db.sql`SELECT count(*)::int AS n FROM refresh_runs WHERE status = 'failed' AND created_at > now() - interval '24 hours'`
    if (num(echecs[0]?.n) >= 3)
      alertes.push({
        gravite: 'basse',
        titre: 'Générations de sujets en échec',
        detail: `${echecs[0].n} exécutions ont échoué en 24 h.`,
      })
    const ordre = { haute: 0, moyenne: 1, basse: 2 }
    return {
      alertes: alertes.sort((a, b) => ordre[a.gravite] - ordre[b.gravite]),
      verifieLe: new Date().toISOString(),
    }
  },
)

/* 13. Bilan hebdomadaire de l'Analyste */
async function weekStats(db: Awaited<ReturnType<typeof ctx>>['db']) {
  const [r] = await db.sql`SELECT
      (SELECT count(*)::int FROM profiles WHERE created_at > now() - interval '7 days') AS nouveaux,
      (SELECT count(*)::int FROM profiles) AS inscrits,
      (SELECT count(DISTINCT user_id)::int FROM ai_events WHERE created_at > now() - interval '7 days' AND user_id <> 'systeme') AS actifs_ia,
      (SELECT count(*)::int FROM ai_events WHERE created_at > now() - interval '7 days' AND user_id <> 'systeme') AS requetes_ia,
      (SELECT count(*)::int FROM quiz_attempts WHERE finished_at > now() - interval '7 days') AS quiz_rendus,
      (SELECT COALESCE(round(avg(score)::numeric, 1), 0)::float FROM quiz_attempts WHERE finished_at > now() - interval '7 days') AS quiz_moyenne,
      (SELECT count(*)::int FROM payments WHERE status = 'accepted' AND created_at > now() - interval '7 days') AS paiements,
      (SELECT COALESCE(sum(amount), 0)::bigint FROM payments WHERE status = 'accepted' AND created_at > now() - interval '7 days') AS revenus,
      (SELECT count(*)::int FROM subjects WHERE created_at > now() - interval '7 days') AS sujets_crees,
      (SELECT count(*)::int FROM lessons WHERE created_at > now() - interval '7 days' AND status = 'ready') AS lecons,
      (SELECT count(*)::int FROM subject_reports WHERE created_at > now() - interval '7 days') AS signalements,
      (SELECT count(*)::int FROM ideas WHERE created_at > now() - interval '7 days') AS idees`
  const classes =
    await db.sql`SELECT classe, serie, count(*)::int AS n FROM profiles GROUP BY 1, 2 ORDER BY n DESC LIMIT 8`
  return {
    nouveauxInscrits: num(r.nouveaux),
    inscritsTotal: num(r.inscrits),
    elevesActifsIa: num(r.actifs_ia),
    requetesIa: num(r.requetes_ia),
    quizRendus: num(r.quiz_rendus),
    moyenneQuizSur10: num(r.quiz_moyenne),
    paiementsAcceptes: num(r.paiements),
    revenusFcfa: num(r.revenus),
    sujetsCrees: num(r.sujets_crees),
    leconsRedigees: num(r.lecons),
    signalements: num(r.signalements),
    idees: num(r.idees),
    principalesClasses: classes.map(
      (c) => `${c.classe} ${c.serie ?? ''}`.trim() + ` : ${c.n}`,
    ),
  }
}

const weekKey = () => {
  const d = new Date()
  const day = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - day)
  return d.toISOString().slice(0, 10)
}

export const listWeeklyReports = createServerFn({ method: 'GET' }).handler(
  async () => {
    const { db } = await ctx()
    const rows =
      await db.sql`SELECT week, content, created_at::text FROM weekly_reports ORDER BY week DESC LIMIT 8`
    return {
      semaine: weekKey(),
      bilans: rows.map((r) => ({
        week: String(r.week),
        content: String(r.content),
        createdAt: iso(r.created_at)!,
      })),
    }
  },
)

export const generateWeeklyReport = createServerFn({ method: 'POST' }).handler(
  async () => {
    const { db, admin, log } = await ctx()
    const week = weekKey()
    const [recent] =
      await db.sql`SELECT created_at > now() - interval '6 hours' AS recent FROM weekly_reports WHERE week = ${week}`
    if (recent?.recent)
      throw new Error(
        'Le bilan de cette semaine a été rédigé il y a moins de 6 heures.',
      )
    const stats = await weekStats(db)
    const { default: Anthropic } = await import('@anthropic-ai/sdk')
    const { LESSON_MODEL, generationParams } = await import('./models')
    const message = await new Anthropic().messages.create({
      model: LESSON_MODEL,
      ...generationParams(LESSON_MODEL, 1200),
      system:
        'Tu es l’Analyste d’Annales+, plateforme ivoirienne de révision des examens. Rédige en français un bilan hebdomadaire court (6 à 10 lignes, puces simples, sans Markdown gras) pour l’administrateur : tendances, points d’attention, 3 actions concrètes. Utilise UNIQUEMENT les chiffres fournis, n’invente aucun chiffre ni comparaison absente. Si une valeur vaut 0, dis-le simplement.',
      messages: [
        {
          role: 'user',
          content: `Chiffres des 7 derniers jours (JSON) :\n${JSON.stringify(stats)}`,
        },
      ],
    })
    const content = message.content
      .map((b) => (b.type === 'text' ? b.text : ''))
      .join('')
      .trim()
    try {
      await db.sql`INSERT INTO ai_events (id, user_id, kind, mode, status, input_tokens, output_tokens)
      VALUES (${crypto.randomUUID()}, ${admin.id}, 'analyste', ${LESSON_MODEL}, ${content ? 'ok' : 'error'},
        ${message.usage?.input_tokens ?? 0}, ${message.usage?.output_tokens ?? 0})`
    } catch {
      // Le journal des coûts ne bloque pas le bilan.
    }
    if (!content)
      throw new Error('L’Analyste n’a pas pu rédiger le bilan. Réessaie.')
    await db.sql`INSERT INTO weekly_reports (id, week, stats, content) VALUES (${crypto.randomUUID()}, ${week}, ${JSON.stringify(stats)}::jsonb, ${content})
    ON CONFLICT (week) DO UPDATE SET stats = EXCLUDED.stats, content = EXCLUDED.content, created_at = now()`
    await log('bilan_hebdo', week)
    return { saved: true }
  },
)

/* 14. Statistiques par classe et par matière */
export const getClassStats = createServerFn({ method: 'GET' }).handler(
  async () => {
    const { db } = await ctx()
    const classes =
      await db.sql`SELECT p.classe, p.serie, count(*)::int AS eleves,
      count(s.user_id) FILTER (WHERE s.expires_at > now())::int AS abonnes
    FROM profiles p LEFT JOIN subscriptions s ON s.user_id = p.user_id
    GROUP BY 1, 2 ORDER BY eleves DESC`
    const quiz =
      await db.sql`SELECT p.classe, p.serie, count(a.id)::int AS rendus, COALESCE(avg(a.score), 0)::float AS moyenne
    FROM quiz_attempts a JOIN profiles p ON p.user_id = a.user_id
    WHERE a.finished_at > now() - interval '30 days' GROUP BY 1, 2`
    const matieres =
      await db.sql`SELECT classe, serie, matiere, count(*)::int AS sujets FROM subjects
    WHERE archived_at IS NULL GROUP BY 1, 2, 3`
    const lecons =
      await db.sql`SELECT classe, serie, matiere, count(*)::int AS lecons FROM lessons
    WHERE status = 'ready' GROUP BY 1, 2, 3`
    const key = (r: Record<string, unknown>) => `${r.classe}|${r.serie ?? ''}`
    const quizMap = new Map(quiz.map((q) => [key(q), q]))
    return classes.map((c) => {
      const k = key(c)
      const q = quizMap.get(k)
      const parMatiere = matieres
        .filter((m) => key(m) === k)
        .map((m) => ({
          matiere: String(m.matiere),
          sujets: num(m.sujets),
          lecons: num(
            lecons.find((l) => key(l) === k && l.matiere === m.matiere)?.lecons,
          ),
        }))
        .sort((a, b) => a.sujets - b.sujets)
      return {
        classe: `${c.classe} ${c.serie ?? ''}`.trim(),
        eleves: num(c.eleves),
        abonnes: num(c.abonnes),
        quizRendus: num(q?.rendus),
        moyenneQuiz: Math.round(num(q?.moyenne) * 10) / 10,
        parMatiere,
      }
    })
  },
)

/* 15. Journal d'audit complet */
export const getFullAudit = createServerFn({ method: 'GET' })
  .validator(
    z.object({
      q: z.string().trim().max(100).default(''),
      page: z.number().int().min(0).max(1000).default(0),
    }),
  )
  .handler(async ({ data }) => {
    const { db } = await ctx()
    const q = data.q || null
    const rows = await db.sql`SELECT * FROM (
        SELECT 'paiement' AS source, action, payment_id AS target, reason AS details, created_at FROM payment_audit
        UNION ALL
        SELECT 'console' AS source, action, target, details, created_at FROM admin_audit
      ) a
      WHERE ${q}::text IS NULL OR strpos(lower(action || ' ' || COALESCE(target, '') || ' ' || COALESCE(details, '')), lower(${q})) > 0
      ORDER BY created_at DESC LIMIT 51 OFFSET ${data.page * 50}`
    return {
      hasNext: rows.length > 50,
      entries: rows.slice(0, 50).map((r) => ({
        source: String(r.source),
        action: String(r.action),
        target: r.target ? String(r.target) : null,
        details: r.details ? String(r.details) : null,
        createdAt: iso(r.created_at)!,
      })),
    }
  })

/* Côté élève : signaler un sujet, proposer et voter pour des idées. */
async function student() {
  const { sessionUser } = await import('./session.server')
  const user = await sessionUser()
  if (!user) throw new Error('Connecte-toi pour continuer.')
  const { getDatabase } = await import('@netlify/database')
  const db = getDatabase()
  const [p] =
    await db.sql`SELECT user_id FROM profiles WHERE user_id = ${user.id}`
  if (!p) throw new Error('Termine ton profil élève pour continuer.')
  const { assertStudentAccess } = await import('./access.server')
  await assertStudentAccess(user.id)
  return { user, db }
}

export const reportSubject = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      subjectId: z.string().min(1).max(100),
      reason: z.string().trim().min(5).max(500),
    }),
  )
  .handler(async ({ data }) => {
    const { user, db } = await student()
    const [n] =
      await db.sql`SELECT count(*)::int AS n FROM subject_reports WHERE user_id = ${user.id} AND created_at > now() - interval '1 day'`
    if (num(n?.n) >= 10)
      throw new Error(
        'Tu as déjà envoyé beaucoup de signalements aujourd’hui. Merci !',
      )
    await db.sql`INSERT INTO subject_reports (id, user_id, subject_id, reason) VALUES (${crypto.randomUUID()}, ${user.id}, ${data.subjectId}, ${data.reason})
      ON CONFLICT (user_id, subject_id) DO UPDATE SET reason = EXCLUDED.reason, status = 'open', created_at = now()`
    return { saved: true }
  })

export const listIdeas = createServerFn({ method: 'GET' }).handler(async () => {
  const { user, db } = await student()
  const rows =
    await db.sql`SELECT i.id, i.texte, i.status, i.votes, i.user_id = ${user.id} AS mine,
      EXISTS (SELECT 1 FROM idea_votes v WHERE v.idea_id = i.id AND v.user_id = ${user.id}) AS voted
    FROM ideas i WHERE i.status <> 'refusee' ORDER BY i.votes DESC, i.created_at DESC LIMIT 30`
  return rows.map((r) => ({
    id: String(r.id),
    texte: String(r.texte),
    status: String(r.status),
    votes: num(r.votes),
    mine: !!r.mine,
    voted: !!r.voted,
  }))
})

export const submitIdea = createServerFn({ method: 'POST' })
  .validator(z.object({ texte: z.string().trim().min(10).max(400) }))
  .handler(async ({ data }) => {
    const { user, db } = await student()
    const [n] =
      await db.sql`SELECT count(*)::int AS n FROM ideas WHERE user_id = ${user.id} AND created_at > now() - interval '1 day'`
    if (num(n?.n) >= 3)
      throw new Error('Tu peux proposer 3 idées par jour. Reviens demain !')
    await db.sql`INSERT INTO ideas (id, user_id, texte) VALUES (${crypto.randomUUID()}, ${user.id}, ${data.texte})`
    return { saved: true }
  })

export const voteIdea = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { user, db } = await student()
    const inserted = await db.sql`INSERT INTO idea_votes (idea_id, user_id)
      SELECT ${data.id}, ${user.id} WHERE EXISTS (SELECT 1 FROM ideas WHERE id = ${data.id})
      ON CONFLICT DO NOTHING RETURNING idea_id`
    if (inserted.length)
      await db.sql`UPDATE ideas SET votes = votes + 1 WHERE id = ${data.id}`
    return { saved: true }
  })
