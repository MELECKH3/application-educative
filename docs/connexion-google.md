# Connexion des élèves

La page `/connexion` propose Google lorsque ce fournisseur est activé, ainsi que l’inscription et la connexion par e-mail. Une adresse Gmail peut aussi servir à créer un compte par e-mail et mot de passe ; cela reste un parcours distinct du bouton Google.

## Mise en service

Après le déploiement, ouvre les [réglages du projet Netlify](https://app.netlify.com/projects/application-educative/configuration/identity).

1. Vérifie qu’Identity est actif, que les inscriptions sont ouvertes et que la confirmation des adresses e-mail est obligatoire.
2. Active Google dans les fournisseurs de connexion. Si une configuration OAuth Google est demandée, effectue-la directement dans les consoles Google et Netlify, sans partager les identifiants dans une conversation. Utilise l’URL de retour fournie par Netlify.
3. Vérifie l’URL du site et les URL de retour autorisées pour le domaine utilisé, y compris celui de la prévisualisation si elle doit servir aux essais.
4. Vérifie que les migrations de déploiement ont réussi avant de tester un compte.

Le bouton Google reste désactivé avec une explication en français tant que le fournisseur n’est pas disponible. Aucun mot de passe Google n’est demandé par Annales+.

## Vérification réelle

Dans une fenêtre privée, connecte-toi avec Google depuis une page de l’espace élève. Pour un nouveau compte, complète les quatre écrans du profil. Vérifie le prénom, l’adresse e-mail, la tranche d’âge, le pays, la classe, la série, les langues et le niveau dans Profil. Modifie-les, déconnecte-toi, puis reconnecte-toi pour vérifier leur persistance. Un autre compte doit obtenir son propre profil. Vérifie aussi l’annulation chez Google, la confirmation par e-mail et la récupération du mot de passe.

Le profil n’est pas enregistré dans le navigateur : il est stocké dans Netlify Database. Les opérations serveur utilisent exclusivement l’identité de la session pour lire ou écrire le profil. Les données pédagogiques et les compteurs d’utilisation restent des aperçus en attendant les prochains jalons.

## Vérifications du 4 novembre 2026

Les 56 tests automatisés, le contrôle TypeScript et ESLint ont réussi. Les tests couvrent notamment les formulaires de connexion et d’inscription, la confirmation requise, le retour Google simulé, la récupération du mot de passe, l’acceptation des invitations, les inscriptions fermées, les contrôles d’accès et les quatre étapes du profil, y compris une nouvelle tentative après échec de sauvegarde. Ces parcours utilisent des doublures du service Identity et ne constituent pas une connexion à un compte réel.

Un contrôle Chromium sur mobile (390 px) et ordinateur (1 440 px), en local et sur le site publié, a vérifié 14 chemins, leurs redirections et la page introuvable. Les formulaires d’inscription et de récupération ont également été ouverts sur le site publié. Un débordement du décor de l’accueil sur mobile a été corrigé. L’erreur React d’hydratation du site publié a été reproduite puis éliminée dans un essai navigateur en retirant uniquement les espaces entre les éléments de l’en-tête HTML avant le démarrage React ; cette correction a été intégrée au point d’entrée client et reste à contrôler après déploiement.

Le service Identity publié a répondu avec les inscriptions ouvertes, la confirmation obligatoire et Google désactivé. L’émulation locale a renvoyé 404 pour le service Identity : les connexions réelles ne sont donc pas validées en local. La présence des tables nécessaires aux profils et aux paiements a été contrôlée sans modifier de données ni de migrations.

La création d’un compte réel, la réception du message de confirmation, la connexion Google et la persistance d’un profil après reconnexion restent à valider avec une adresse dont le propriétaire peut ouvrir les messages et autoriser Google. Aucun compte réel n’a été créé durant cet audit. N’envoie jamais de mot de passe ni d’identifiant OAuth dans une conversation ; configure Google directement dans les consoles concernées.
