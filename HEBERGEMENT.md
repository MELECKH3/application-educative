# Annales+ — Plan B d'hébergement

Ce guide sert si les crédits Netlify viennent à manquer, ou si tu veux publier Annales+ ailleurs ou sous ton propre nom de domaine.

## 1. Avant tout : sauvegarder régulièrement

Dans `/admin` → **Modules de gestion** → **Exports CSV** → **Tout sauvegarder**.
Le fichier JSON téléchargé contient :

- toutes les tables de la base : élèves, profils, paiements, abonnements, sujets, leçons, quiz, signalements, journal… ;
- la liste des comptes de connexion (identifiant, adresse e-mail, rôles), **sans mot de passe**.

Les captures de reçus (stockage privé) ne sont pas incluses.
Fais une sauvegarde au moins une fois par semaine et garde-la hors du téléphone (Google Drive, clé USB).

## 2. Économiser les crédits sans rien déménager

Les appels à l'IA consomment le plus de crédits. Depuis `/admin` :

- **Interrupteurs d'urgence** : couper le tuteur et le Professeur IA, l'oral vocal ou la génération de sujets.
- **Sujets** : baisser le plafond quotidien de génération (300 par défaut).
- Les leçons, quiz et sujets déjà rédigés restent disponibles : ils sont stockés et partagés, pas régénérés.

## 3. Utiliser ton propre nom de domaine (en restant sur Netlify)

1. Achète un domaine (par exemple `annalesplus.ci` ou `annalesplus.com`) chez un registraire.
2. Dans Netlify : **Domain management** → **Add a domain**, puis suis les instructions DNS.
3. Le certificat HTTPS est fourni automatiquement.

L'adresse `etudemodern.netlify.app` continue de fonctionner en parallèle.

## 4. Déménager chez un autre hébergeur

Annales+ utilise des briques Netlify. Chacune a un équivalent ailleurs :

| Brique utilisée | Où dans le code | Remplacement possible |
|---|---|---|
| Hébergement + rendu serveur (TanStack Start) | `vite.config.ts` (plugin `@netlify/vite-plugin-tanstack-start`) | Vercel, Cloudflare, Render ou Railway (serveur Node) : changer le plugin pour la cible choisie |
| Base de données (Postgres) | `db/`, `netlify/database/migrations/`, `@netlify/database` | Neon ou Supabase (Postgres standard) : rejouer les migrations SQL, puis importer la sauvegarde JSON |
| Comptes (Netlify Identity) | `src/routes/connexion.tsx`, `src/lib/session.server.ts`, `netlify/functions/identity.mts` | Supabase Auth, Clerk ou Better Auth. Les élèves choisissent un nouveau mot de passe (« Mot de passe oublié ») ; la sauvegarde relie chaque identifiant à son adresse e-mail |
| Stockage des reçus (Netlify Blobs) | `src/lib/recu.server.ts` (`recus-paiement`) | Cloudflare R2, Supabase Storage ou S3 |
| IA (AI Gateway) | `new Anthropic()` dans `src/lib/*.server.ts` | Une clé API Anthropic personnelle : variable `ANTHROPIC_API_KEY`, aucun autre changement |
| Tâches planifiées | `netlify/functions/quiz-du-jour.mts`, `lecons-programme.mts`, `grande-actualisation.mts` | Cron de l'hébergeur (Vercel Cron, Cloudflare Cron Triggers) ou GitHub Actions qui appelle une route protégée |
| Tâches longues en arrière-plan | `*-background.mts` | File de tâches de l'hébergeur ou petit serveur Node |

Ordre conseillé :

1. Faire une sauvegarde complète (§ 1).
2. Créer la base Postgres, rejouer les migrations, importer les tables.
3. Remplacer la connexion, puis le stockage des reçus.
4. Brancher la clé IA et les tâches planifiées.
5. Publier, tester avec le compte admin, puis faire pointer le domaine vers le nouvel hébergeur.

Le code source est déjà sur GitHub (`MELECKH3/application-educative`) : il n'est jamais perdu, même si le site Netlify est en pause.
