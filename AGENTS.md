# AGENTS.md — Annales+

**Avant toute chose, lis `PLAN.md`** : il contient la feuille de route par jalons. Reprends au premier jalon non livré.
Le cahier des charges v15 de l'utilisateur fait foi pour tous les chiffres (prix, durées, quotas, numéros, liens).

## Architecture
- TanStack Start (SSR) sur Netlify. Routes fichiers dans `src/routes/`.
- `src/routes/index.tsx` : page d'accueil publique.
- `src/routes/_app.tsx` : mise en page pathless de l'espace élève (en-tête + barre d'onglets, `src/components/app/app-shell.tsx`).
  Enfants : `accueil`, `explorer`, `sujets.$sujetId`, `lecons`, `quiz`, `ia`, `oral`, `profil`.
- Hors de la mise en page (pas d'onglets) : `examen.$sujetId` (épreuve verrouillée), `premium` (bannière de paiement,
  `?raison=temps` = variante « temps gratuit terminé »), `professeurs` (annonce), `confidentialite`.
- `src/lib/config.ts` : valeurs **réelles** (prix, durées, liens Orange Money, numéro Wave/WhatsApp, e-mail admin, thèmes, niveaux, modes). À réutiliser côté serveur.
- `src/lib/curriculum.ts` : matières/séries par classe. Sujets : `sujets.server.ts` (base + aperçu), générés par `generator.server.ts` (Netlify Functions dans `netlify/functions/`, imports relatifs seulement).
- `src/lib/models.ts` : choix des modèles IA (tuteur Haiku, Professeur IA Sonnet, rédaction des leçons Opus, quiz Sonnet).
- Quiz du jour : `src/lib/quiz.ts` (pur), `quiz.functions.ts` ; leçons : `lecons.ts`, `lecons.functions.ts` ;
  rédaction en arrière-plan : `contenu.server.ts` + `netlify/functions/contenu-ia-background.mts`, `quiz-du-jour.mts`.
- `src/lib/fixtures.ts` : **seul** module de données d'aperçu (élève « Awa », sujets, leçon). À remplacer par la base au jalon 3.
- `src/hooks/use-now.ts` : horloge côté client (null au SSR) pour les comptes à rebours.

## Conventions
- Interface 100 % en français. Tutoiement de l'élève.
- Couleurs uniquement via tokens (`bg-primary`, `bg-ink`, `bg-exemple`, `text-secondary`…) définis dans `src/styles.css` ; `.dark` = « Encre de Nuit » (classe sur `<html>`, préférence `annales-theme` en localStorage).
- Titres : `font-display` (Bricolage Grotesque) ; texte : Figtree. Cartes `rounded-2xl`, cibles tactiles ≥ 44 px (`min-h-11`).
- Copie d'examen : classe utilitaire `.paper-lined`.
- Tout contenu généré/démo porte `<ExempleBadge />`. Jamais de fausse année, fausse source, ni de faux chiffres (surtout dans la console admin).
- Chaque route définit `head()` avec titre, description et OpenGraph.

## Décisions non évidentes
- Accès admin : ADMIN_EMAIL reçoit le rôle `admin` automatiquement à la connexion une fois l'adresse confirmée.
  `createAccount` refuse de créer ce compte déjà confirmé (inscription classique obligatoire) pour empêcher l'usurpation.
- Interrupteurs d'urgence = `app_settings` (`coupure_*` = « oui »), lus par `switchOn` (`src/lib/admin.server.ts`).
- Accès élève = 3 jours d'essai (date du profil), puis forfait gratuit 30 min/jour limité (40 min seulement si l'admin l'active), bloqué quand le temps du jour est épuisé (`src/lib/access*.ts`). Toute nouvelle fonction serveur élève doit appeler `assertStudentAccess` (ou `assertPremium`) ; les limites par formule sont dans `LIMITES`.
- Reçus : capture obligatoire à la déclaration, lue par l'IA ; le bénéficiaire doit être ADOU MELCHI ou ADOU MELECKH (`RECEIPT_NAMES`), décision en code testé (`src/lib/recu.ts`). Le compte ADMIN_EMAIL n'est jamais élève : toujours renvoyé vers `/admin`.
- L'état d'examen est encore simulé côté navigateur (jalon 5).
- Sujets : 1 000 par classe/série, renouvelés en 7 jours par archivage (`archived_at`), jamais supprimés
  (un examen en cours garde son sujet). Le volume est borné par le plafond quotidien admin (`actualisation_quota_jour`).
- Le contenu IA lourd (quiz, leçons, sujets) est généré une fois en arrière-plan puis partagé, jamais par élève.
- Abidjan = UTC+0 sans heure d'été : minuit/03h00 Abidjan = minuit/03h00 UTC.
- Les messages d'erreur (404/erreur de route) sont traduits ; les tests associés vérifient les textes français.
- Application installable (PWA) : `public/manifest.webmanifest`, icônes `public/icons/`, service worker généré à chaque publication depuis
  `src/pwa/sw.template.js` (plugin dans `vite.config.ts`, avec `version.json`). Pages toujours chargées en ligne ; jamais de cache pour
  `/_serverFn`, `/api/`, `/.netlify/`. La bannière « Nouvelle version » (`src/components/app/pwa.tsx`) ne s'affiche jamais sur `/examen`.
- Leçons express : `api.lecon-direct.ts` (route serveur en flux) → `writeLessonLive` ; une leçon n'est rédigée en direct
  que si elle est réservée (`pending`) par `requestLesson`. Champs pédagogiques optionnels (`objectifs`, `verifications`,
  `pratique`, `test`) : les anciennes leçons reçoivent leur test à la demande (`getLessonTest`).
- Rappel « offre gratuite / Premium meilleur » : `free-offer-notice.tsx`, une fois par session (sessionStorage) pour essai et gratuit.
- Appels IA : toujours étaler `generationParams(model, maxTokens)` (`src/lib/models.ts`) au lieu de `max_tokens`. Sinon le modèle
  « réfléchit » jusqu'à épuiser la limite et ne renvoie aucun texte (panne des leçons du 04/11/2026). Haiku : réflexion coupée ;
  Sonnet/Opus : `disabled` refusé par l'API, donc effort « low » + `THINKING_MARGIN`.
- Plan B d'hébergement : `HEBERGEMENT.md`. Sauvegarde complète JSON (toutes les tables + comptes sans mot de passe) dans /admin → Exports
  (`listBackupTables`, `exportBackupTable`, `exportAccounts`). Toute nouvelle brique Netlify doit y être listée avec son équivalent.
- Leçons : mots difficiles (`motsCles`) soulignés et cliquables dans le texte, « Écouter ce temps », « Lecture facile »
  (localStorage `annales-lecture-facile`), « Demander au tuteur » → `/ia?mode=Expliquer&question=…`.
- Partage : `SITE_URL` / `SHARE_MESSAGE` (`src/lib/config.ts`) et `<ShareSite />` (`src/components/app/share-site.tsx`) sur l'accueil public,
  l'accueil élève et le profil. Si le domaine change, ne modifier que `SITE_URL` (aperçu `og:image` absolu inclus).
