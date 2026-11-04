# Annales+

Application mobile d'abord pour aider les élèves de Côte d'Ivoire et d'Afrique francophone à réussir le CEPE, le BEPC
et le BAC : sujets par niveau, leçons expliquées en 4 temps, tuteur IA socratique, simulateur d'oral et examens blancs
chronométrés. Offre gratuite (7 jours VIP puis 40 min/jour) et offres personnelles payées par Wave ou Orange Money.

## Technologies
- TanStack Start (React 19, TanStack Router), Vite, TypeScript
- Tailwind CSS 4 avec tokens de thème dans `src/styles.css`, composants shadcn/ui, icônes lucide
- Hébergement Netlify ; prévus : Netlify Database, Identity, Blobs, Functions planifiées, AI Gateway

## Lancer en local
```bash
pnpm install
netlify dev   # ou : pnpm dev
```

## État
La surface produit est en place et cliquable (accueil public, espace élève, sujets, leçon, tuteur, examen, oral,
offres). Les contenus affichés sont des données d'aperçu marquées EXEMPLE. La suite (comptes, base de données,
quotas et paiements côté serveur, IA, console admin) est décrite dans [PLAN.md](PLAN.md).
