# Annales+ — Feuille de route

Annales+ est une grande plateforme (comptes, paiements, plusieurs IA, console admin). Elle est livrée par jalons
autonomes : d'abord la surface produit visible et cliquable, puis les fondations serveur, puis chaque module.
Le cahier des charges v15 fait foi pour tous les chiffres (prix, durées, quotas).

Correspondance des briques demandées : « Lovable Cloud » → **Netlify Database** (Postgres, RLS), **Netlify Identity**
(e-mail + Google), **Netlify Blobs** (reçus privés, photos de copie), **Netlify Functions / Scheduled Functions**
(quotas, Grande Actualisation) ; « Lovable AI Gateway » → **Netlify AI Gateway**.

## ✅ Jalon 1 — Surface produit (livré)

- Page d'accueil publique, design « cahier d'écolier ivoirien », mode Encre de Nuit.
- Espace élève avec barre d'onglets (Accueil, Explorer, Leçons, IA, Profil) et lien Premium.
- Accueil personnalisé, explorateur de sujets (matière × 4 niveaux, badge EXEMPLE), fiche sujet.
- Leçon en 4 temps + vérification vocale + test de rappel (parcours d'aperçu).
- Tuteur : 7 modes, interface de chat (réponses d'aperçu scriptées).
- Examen : chronomètre, copie lignée, autosauvegarde 10 s, blocage de sortie, sas 10 min (état navigateur pour l'instant).
- Préparation de l'oral (langue, thème obligatoire, niveau, durée).
- Bannière Premium avec liens Orange Money exacts (1 500 / 2 500), Wave `0712600858`, WhatsApp ; reçu transmis par WhatsApp.
- Pages Espace Professeurs (annonce) et Confidentialité.
- Données d'aperçu isolées dans `src/lib/fixtures.ts`.

## Jalon 2 — Comptes et onboarding (en cours)

Livré dans le code : connexion Google conditionnée aux réglages Identity, connexion/inscription par e-mail,
confirmation et récupération de mot de passe, retour vers la page demandée, déconnexion, profil obligatoire
et modifiable en quatre écrans, stockage Postgres avec migration et RLS, contrôles d’accès serveur.
L’accueil et le profil utilisent les informations du compte connecté au lieu d’Awa.
Correctif majeur : le serveur refusait toute session car l’utilisateur reconstruit depuis le jeton n’a pas
de date de confirmation, d’où une boucle `/connexion` ↔ `/accueil` après connexion. La session serveur est désormais
reconnue (`src/lib/session.server.ts`), avec un garde-fou anti-boucle côté page de connexion. L’inscription crée
le compte déjà confirmé côté serveur (`createAccount`, API admin Identity) : adresse + mot de passe suffisent ;
un ancien compte jamais confirmé est activé à la connexion. Repli sur l’inscription classique si l’API admin manque.
Le parcours de connexion a été clarifié : adresse Gmail et mot de passe Annales+ en premier, bouton Google
masqué lorsque le fournisseur est désactivé, explications pour la première inscription et erreurs ciblées
pour les identifiants refusés ou l’adresse non confirmée. Le contrôle du service publié a confirmé
les inscriptions ouvertes par e-mail, la confirmation obligatoire et Google désactivé.
À valider après déploiement : activation Identity et configuration du fournisseur Google, parcours OAuth réel,
confirmation e-mail et persistance sur la base provisionnée. Les droits administrateur ont été ajoutés pour
`tablechaisse926@gmail.com` uniquement, avec rôle Identity `admin` attribué par le propriétaire du projet,
table `user_roles` et contrôle serveur `hasRole()`. Connexion admin sans tableau de bord Netlify (5 nov. 2026) : bouton « Renvoyer le lien de confirmation »
et aide dédiée sur `/connexion` quand l’adresse admin n’est pas confirmée ou que le mot de passe est refusé.
La suppression automatique du compte reste à livrer
(une demande WhatsApp est disponible). Le jalon n’est donc pas déclaré livré.

- Netlify Identity : e-mail + mot de passe (confirmation obligatoire), « Continuer avec Google », mot de passe oublié / réinitialisation, retour vers la page demandée.
- Onboarding obligatoire en 4 écrans (prénom + tranche d'âge, pays, classe + série, langues + niveau préféré) ; redirection tant qu'il n'est pas fini.
- Rôle admin : uniquement `tablechaisse926@gmail.com`, table `user_roles` + `has_role()` côté serveur.
- Suppression de compte, déconnexion.

## Jalon 3 — Modèle de données et contenu

- Schéma Drizzle (Netlify Database) : profils, sujets, leçons, progression, séances, examens/copies, abonnements, paiements, alertes, audit, idées, signalements, coûts IA. RLS sur toutes les tables.
- Remplacement de `fixtures.ts` par des loaders / server functions.
- Corrigés stockés à part, jamais renvoyés pendant un examen ou le sas.

## Jalon 4 — Temps d'utilisation et paiements (serveur)

**Mise à jour (4 nov. 2026, décision de l'utilisateur)** : essai ramené à **3 jours** (`VIP_WELCOME_DAYS`). Après les 3 jours d'essai, forfait gratuit limité de
**30 min/jour** (battement serveur `daily_usage`, pause après 2 min d'inactivité, avertissements à 10 et 3 min,
remise à zéro à minuit) ; **40 min/jour uniquement si l'admin l'active** pour un élève (`free_plan_grants`,
module « Forfait gratuit 40 min »). Limites du gratuit (`LIMITES` dans `src/lib/access.ts`) : 15 messages IA/jour,
1 nouvelle leçon/jour, sujets niveaux 1–2 seulement, pas d'oral, explication « Essentiel » seulement.
Reçu envoyé dans l'app (Blobs privé `recus-paiement`) : l'IA lit la capture, refus immédiat si le bénéficiaire
n'est pas ADOU MELCHI / ADOU MELECKH (`src/lib/recu.ts`), sinon attente de validation admin avec alertes.
« Explique-moi cette leçon » (`lesson_explanations`) : Essentiel (gratuit), Détaillé (Mensuel), Approfondi
(Trimestriel et essai), rédigé une fois par leçon et par niveau en arrière-plan.

Ancienne décision (remplacée) : **7 jours d'essai à l'inscription, puis blocage total** jusqu'au paiement
(pas de 40 min/jour). `src/lib/access.ts` + `access.server.ts` (horloge Postgres, date du profil) ; `requireStudent`
renvoie vers `/premium?raison=essai`, et chaque fonction serveur élève (sujets, quiz, leçons, IA, idées) refuse.
La page Premium se revérifie toutes les 30 s après une déclaration et se débloque dès la validation.
Rappels J-2/J-1 (essai) et J-3/J-1 (Premium) dans l'espace élève.
Matières : programme ivoirien complet dans `matieresPour` (dont TICE, arts plastiques, éducation musicale, EPS,
EDHC au lycée, SVT en série A, sciences et techniques industrielles en E).
Date exacte de fin d'essai (heure d'Abidjan, `formatFinAcces`) affichée dans le rappel d'ouverture, le bandeau d'essai et
les rappels J-2/J-1, avec l'avertissement « sans paiement, seule la page de paiement reste ouverte » (`BLOCAGE_EXPLICATION`).
Sentinelle des paiements (`src/lib/sentinel.ts`) : refus immédiat d'un ID déjà déclaré (même écrit autrement)
ou inventé, validation impossible d'un ID qui a déjà débloqué un abonnement, score de risque sur chaque paiement
en attente dans /admin et dans le module Sentinelle.

Livré dans le code pour les paiements : déclaration Wave/Orange Money liée au compte, référence unique
normalisée, cinq déclarations par heure, suspension après trois refus en 24 h, suivi en attente/accepté/refusé.
Les captures restent transmises par WhatsApp, avec numéro de dossier. L’upload privé intégré reste à livrer.
L’administrateur accepte/refuse après vérification du relevé ou enregistre les espèces reçues sur place.
Abonnements persistants de 30/90 jours calculés par l’horloge Postgres, prolongation sans perte des jours
restants, transactions atomiques et protections contre les doubles validations. Migration à appliquer
par le déploiement et parcours réels à valider ensuite. Le compteur gratuit reste un aperçu.

- 7 jours VIP, puis 40 min/jour : battement toutes les 30 s, pause après 2 min d'inactivité, remise à zéro à minuit (Abidjan, UTC+0).
- Avertissements à 10 min et 3 min ; examen commencé = terminable ; puis blocage total côté serveur et redirection vers `/premium?raison=temps`.
- Envoi du reçu dans l'app (JPG/PNG/WebP ≤ 8 Mo, Blobs privé), ID de transaction unique, 5 reçus/heure, 3 rejets/24 h = quarantaine, écran « Paiement en attente ».
- Activation par l'admin, dates calculées serveur (30 / 90 jours), prolongation, rappels J-3 et J-1.

## Jalon 5 — Examens côté serveur

- Heure de début, autosauvegarde et état d'épreuve en base ; reprise à la réouverture ; verrouillage tuteur/leçons/corrigé par l'API.
- Upload des photos de copie ; auto-correction IA avec note estimée ; déblocage exceptionnel par l'admin (journalisé).

## Jalon 6 — IA pédagogique (en cours)

Livré dans le code : tuteur réel via Netlify AI Gateway (`claude-haiku-5-5`, `src/lib/ai*.ts`), 7 modes,
contexte élève (classe/série/pays/niveau) et sujet dans `<sujet_donnees>`, photo de copie (≤ 4 Mo),
garde-fous (hors-sujet, détresse sans numéro inventé, anti-manipulation), limite 20 msg/min et 300/jour
comptée en base (`ai_events`, sans contenu), signalements (`ai_reports`) visibles dans `/admin` avec l'usage du jour.
Professeur IA des leçons : « Réexplique autrement » et note du résumé /10 + oublis + 3–5 questions.
Leçons réelles (nov. 2026) : le Professeur IA rédige chaque chapitre avec `claude-opus-5-5` (fonction
d'arrière-plan `contenu-ia-background`, table `lessons`), une seule fois par classe/série/matière/chapitre puis
partagé ; chapitres suggérés à partir des sujets, saisie libre refusée si hors programme, 5 nouvelles leçons/élève/jour
et 80/jour au total. Réexplication et note du résumé avec `claude-sonnet-5-5`. Répétition espacée persistée
(`lesson_reviews`, J+1/J+3/J+7, « À réviser aujourd'hui »).
Programme officiel (nov. 2026) : table `lesson_programmes` (liste ordonnée des chapitres par classe/série/matière,
Sonnet), les 2 premiers chapitres rédigés tout de suite, puis `lecons-programme` (01h30) rédige 40 leçons/nuit
(réglage `lecons_auto_nuit`) pour les classes qui ont des élèves. Les chapitres du programme ne comptent pas
dans le quota de l'élève.
Leçons express et test final (nov. 2026) : une leçon demandée est rédigée en direct (`/api/lecon-direct`, flux NDJSON)
par `claude-haiku-5-5` en 5 parties parallèles (ouverture+temps 1 et mémo, puis exemple, pièges et test à partir du mémo) :
le 1er temps s'affiche en quelques secondes, la suite pendant la lecture ; repli sur Opus en arrière-plan en cas d'échec
ou de navigateur fermé (40 s). Méthode : objectifs, amorce, question de vérification après chaque temps, exercice
« À toi de jouer » avec indices, puis test de fin de leçon obligatoire (6 QCM retenir → analyser, corrigé serveur,
note /10 qui pilote la répétition espacée), résumé ensuite. Le chapitre suivant du programme se prépare pendant l'étude.
Reste : double moteur Alpha/Nova + arbitre, « Voir les deux approches », numéros d'aide par pays vérifiés.
Correctif session : le jeton Identity (1 h) est renouvelé côté serveur (`session.server.ts`, une fois par requête)
et côté navigateur (`SessionKeeper`), d'où la fin des renvois vers /connexion après une heure.


- Tuteur socratique 7 modes (contexte classe/série/pays/sujet, `<sujet_donnees>`), rate limit 20 msg/min.
- Garde-fou hors-sujet (classement, recadrage, détresse + numéros d'aide du pays, anti-manipulation, journalisation).
- Double moteur Alpha/Nova + arbitre (questions complexes seulement) ; « Voir les deux approches » pour les abonnés.
- Professeur IA des leçons (4 temps, reformulation, notation du résumé /10, 3–5 questions, répétition espacée J+1/J+3/J+7).

## Jalon 7 — Oral vocal (en cours)

Livré : examinateur IA (EN/ES/DE, thème/niveau/durée), synthèse vocale, dictée du navigateur si disponible
sinon mode écrit, Répéter/Traduire, chronomètre, note /20 recalculée sur 5 critères /4. Aucun audio envoyé au serveur.
Amélioré (nov. 2026) : déroulé en 3 phases selon le temps écoulé (présentation, échange, conclusion), mode mains libres
(micro rouvert après chaque question, envoi après 2,5 s de silence), voix lente/normale et « Plus lentement », coup de pouce
par question (mots utiles + début de phrase), correction en direct sous la réponse de l'élève ; bilan avec erreurs
corrigées, réponse modèle au niveau visé, expressions à réutiliser (écoutables) et « Refaire sur le même thème ».
Reste : transcription serveur pour les navigateurs sans dictée.


- Micro → transcription → examinateur → synthèse vocale EN/ES/DE, sous-titres, mode écrit de secours, Répéter/Traduire.
- Note /20 sur 5 critères ; audio supprimé après transcription.

## Jalon 8 — Générateur de sujets et Grande Actualisation (en cours)

Livré : programme par classe `src/lib/curriculum.ts` (matières CP1 → Terminale, séries A/C au lycée en Seconde,
A1/A2/C/D/E en Première/Terminale, examen CEPE/BEPC/BAC, durées). Table `subjects` (corrigé stocké, jamais renvoyé),
`refresh_runs`, `app_settings`. Générateur `src/lib/generator.server.ts` (`claude-sonnet-5-5`), fonction
d'arrière-plan `actualisation-background` (n'accepte qu'un run « queued » créé côté serveur) et planifiée
`grande-actualisation` (03h00 UTC chaque jour tant que les 520 cases ne sont pas couvertes, sinon tous les 3 jours).
Première ouverture d'une matière qui a moins de 8 sujets → génération immédiate de 16 sujets de cette matière (scope `matiere:classe|serie|matiere`, un lot par niveau ; à l'Accueil, les 3 matières les moins fournies ; anti-abus : 20 min/matière, 30/h).
Pages Explorer/Accueil/Sujet/Examen/Tuteur lisent les sujets de la classe côté serveur. Admin : lancer, pause, annuler.
Renouvellement (nov. 2026) : objectif 1 000 sujets par classe ET par série, partagés entre les matières
(matières principales ×2, 25 % par niveau, `quotasPour`). Chaque nuit, la génération complète les cases
qui ont moins de sujets de < 7 jours, par lots de 4 sujets par appel, puis archive (`archived_at`) les plus
anciens au-delà de l'objectif : chaque sujet est remplacé en 7 jours, rien n'est supprimé, Explorer
ne montre que les sujets actifs. Seules les classes qui ont des élèves sont servies (sinon CM2, 3e, Terminales).
Plafond quotidien réglable dans /admin (300 par défaut) pour maîtriser les crédits d'IA ; les exécutions
s'enchaînent tant qu'il reste du travail et du budget. Sonnet pour lycée + classes d'examen, Haiku ailleurs.
Quiz du jour livré : 10 QCM par classe/série (`daily_quizzes`, `claude-sonnet-5-5`), préparés à 00h05 pour les
classes qui ont des élèves, sinon à la première visite ; une tentative par élève (`quiz_attempts`), score
calculé côté serveur, série de jours, correction expliquée, lien vers la leçon de la matière.
Reste : atteindre 1 000 sujets dépend du plafond quotidien choisi (≈ 143 sujets/jour par classe active).


- Génération par classe/série/matière/niveau (objectif 1 000 sujets/classe, 25 % par niveau), toujours marqués EXEMPLE.
- Tâche planifiée tous les 3 jours à 03h00 (Abidjan), sans supprimer les sujets en cours ; pause/annulation admin.

## ✅ Jalon 9 — Console admin (15 fonctions) (livré)

Livré (nov. 2026) : accès admin automatique pour ADMIN_EMAIL confirmé (fonction Identity `identity.mts`
au login + `ensureAdminIdentity` côté serveur ; l'adresse admin passe toujours par la confirmation
e-mail). Module « Modules de gestion » dans /admin (`src/components/admin/admin-modules.tsx`,
`src/lib/admin.functions.ts`) : tableau de bord, abonnements, déblocages manuels, sujets, leçons,
quiz du jour, annonce globale, interrupteurs d'urgence (IA, oral, génération, inscriptions),
exports CSV, signalements, boîte à idées, Sentinelle, bilan hebdo de l'Analyste, stats par classe,
journal d'audit complet (`admin_audit`). Côté élève : bandeau d'annonce, « Signaler une erreur »
sur chaque sujet, boîte à idées dans Profil.
Reste : analyse d'image des reçus, détection des connexions simultanées et des injections.

Première partie livrée dans le code à `/admin` : accès réservé, compteurs issus de la base, paiements
paginés, contrôle des déclarations en ligne, recherche des profils par prénom/identifiant, encaissement
en espèces, activation/prolongation et journal des décisions. Un écran explique l’attribution du premier
rôle Identity `admin` si elle manque. Les autres modules ci-dessous restent à livrer.

- Toutes les données affichées proviennent de la base : aucun chiffre fictif. Tableau de bord, paiements, Sentinelle, bilan hebdo de l'Analyste, sujets/leçons, actualisation, déblocages, abonnements, annonce globale, interrupteurs d'urgence, exports CSV, signalements, boîte à idées, audit, coûts IA.
- Sentinelle : analyse des reçus (montant, destinataire `0712600858`, date, rejeu, image dupliquée), abus, rafales, injections, connexions simultanées, rapport quotidien avec gravité.

## Jalon 10 — Le reste

- Boîte à idées (votes, regroupement IA), progression (graphiques, séries, badges), PWA installable + mises à jour (livré : manifeste, `sw.js` généré à la publication, bannière de mise à jour ; reste : notifications push), classes CP1 → 1re complètes.
