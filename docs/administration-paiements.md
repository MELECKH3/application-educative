# Administration et paiements

L’espace `/admin` est réservé au compte confirmé `tablechaisse926@gmail.com` possédant le rôle d’application Identity `admin`. L’adresse seule, un rôle dans le profil utilisateur ou le rôle admin d’un autre compte ne donnent aucun droit. Chaque lecture et chaque écriture administrative vérifient la session côté serveur. La table `user_roles` reflète le rôle Identity contrôlé par le serveur ; elle ne permet pas à un élève de se promouvoir.

## Première connexion administrateur

Après le déploiement et l’application automatique de la nouvelle migration, le propriétaire du projet ouvre [Netlify Identity](https://app.netlify.com/projects/application-educative/configuration/identity). Il invite `tablechaisse926@gmail.com` si le compte n’existe pas, attend l’acceptation, puis ouvre sa fiche et lui attribue le rôle `admin` dans les rôles d’application. Pour un compte déjà créé et confirmé, il suffit de lui attribuer le rôle. L’administrateur se déconnecte et se reconnecte ensuite pour renouveler sa session. Le guide de connexion Google reste applicable pour activer ce fournisseur.

Une connexion avec cette adresse renvoie par défaut vers `/admin`. L’écran explique la configuration manquante tant que le rôle n’a pas été attribué. Aucun profil scolaire n’est imposé pour accéder à la console. Un bouton Admin apparaît dans l’espace élève lorsque les droits sont actifs.

## Paiement Wave ou Orange Money

L’élève connecté, avec un profil complet, effectue le paiement avec les coordonnées existantes de Premium, puis clique sur « J’ai payé, déclarer mon paiement ». Le serveur détermine le prix et la durée à partir de l’offre officielle. L’identifiant de transaction est normalisé et unique ; cinq déclarations au maximum sont autorisées par heure et trois refus récents suspendent les déclarations pendant la fenêtre de 24 heures.

La déclaration est enregistrée avant la transmission de la capture sur WhatsApp. Le message contient le dossier et la référence permettant de rapprocher la conversation de la demande. Le lien reste accessible dans le suivi sur Premium et Profil même si l’élève ferme la fenêtre. L’envoi de fichiers dans l’application n’est pas encore implémenté.

Dans `/admin`, l’administrateur consulte la transaction sur le relevé du compte destinataire, contrôle montant, destinataire, date et référence et rapproche le reçu. Il confirme cette vérification avant d’accepter. Un refus exige un motif visible par l’élève. Les transferts bancaires ne sont pas exécutés par l’application et aucune vérification automatique par API de paiement n’est annoncée.

## Espèces reçues sur place

L’élève crée et complète son compte avant l’encaissement. Son identifiant est affiché sur Profil et Premium. L’administrateur recherche le prénom ou l’identifiant exact, sélectionne le bon compte en présence de l’élève, choisit l’offre et saisit le montant reçu : 1 500 FCFA pour 30 jours ou 2 500 FCFA pour 90 jours. Il confirme la réception effective et l’identifiant du bénéficiaire avant de cliquer sur « Encaisser et activer ». L’application crée une référence de reçu et affiche la confirmation. Les élèves ne peuvent pas déclarer eux-mêmes un paiement en espèces.

## Abonnements et traçabilité

Le paiement accepté et l’abonnement sont enregistrés dans la même transaction que le journal d’audit. L’échéance est calculée avec l’horloge de la base, à partir de la plus tardive des deux dates : maintenant ou la fin de l’abonnement existant. Les validations d’un même élève sont sérialisées, une déclaration déjà traitée ne peut pas être traitée une seconde fois, et le renvoi du même encaissement en espèces conserve la même activation. Le journal conserve l’acteur et la date de chaque opération.

L’état et l’échéance réels sont affichés dans Premium et Profil, ainsi que dans l’en-tête pour un abonné actif. Les compteurs gratuits, les contenus pédagogiques et les modules IA restent au stade prévu par la feuille de route ; ce changement ne livre pas l’ensemble du contrôle de temps serveur ni les autres fonctions de la console.

## Vérification après déploiement

Vérifier avec deux comptes distincts qu’un élève ne peut ni consulter ni appeler les actions administratives, que le compte autorisé sans rôle voit l’aide de configuration et qu’un autre compte ayant le rôle admin est refusé. Vérifier une déclaration en ligne réelle, la transmission WhatsApp, son refus avec motif et une acceptation après rapprochement. Vérifier les espèces avec le bon identifiant, la conservation des jours restants, la persistance après reconnexion et le journal. Vérifier qu’une référence en double, un double clic et une nouvelle tentative sur un paiement déjà traité n’ajoutent aucun jour supplémentaire. Ces essais financiers réels restent à effectuer après application de la migration ; les tests automatisés emploient des dépendances simulées.
