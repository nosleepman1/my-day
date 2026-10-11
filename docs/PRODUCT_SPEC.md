# CAHIER DES CHARGES FONCTIONNEL ET TECHNIQUE
## Personal OS — plateforme personnelle de pilotage, de gestion et d’automatisation

- **Version :** 1.0
- **Date :** 11 octobre 2026
- **Statut :** document de référence pour la conception et le développement
- **Public cible :** équipe de développement humain et équipe d’agents IA
- **Langue de travail :** français
- **Nom du produit :** provisoire — « Personal OS »
- **Périmètre initial :** usage personnel, avec fondations compatibles multi-tenant

---

# 0. Instructions d’utilisation pour l’équipe et les agents IA

Ce document est la source de vérité fonctionnelle et technique du projet. Toute implémentation doit s’y conformer ou faire l’objet d’une décision d’architecture explicitement documentée.

## 0.1 Principes de travail

1. Lire le présent cahier des charges avant de modifier le code.
2. Ne pas inventer de règles métier lorsqu’une règle est spécifiée ici.
3. Si un point est ambigu, proposer une décision documentée et demander validation lorsqu’il affecte la sécurité, les finances, la structure des données ou une intégration externe.
4. Ne jamais implémenter une fonctionnalité financière ou de coffre-fort en contournant les règles de sécurité décrites dans ce document.
5. Ne pas introduire de microservices, de Kubernetes ou d’autres couches d’infrastructure sans besoin démontré et décision explicite.
6. Préférer une implémentation simple, testable, modulaire et documentée.
7. Ne pas déclarer une fonctionnalité terminée sans tests pertinents, validation des permissions, gestion des erreurs et documentation.
8. Ne pas introduire de dépendance supplémentaire sans expliquer son utilité et son coût de maintenance.
9. Respecter les migrations existantes. Ne jamais modifier une migration déjà appliquée en environnement partagé ou de production ; créer une nouvelle migration.
10. Toute donnée sensible, tout secret et toute donnée financière doivent être traités conformément aux exigences de sécurité et d’audit.

## 0.2 Documents de travail recommandés

L’équipe peut maintenir les fichiers suivants dans le dépôt :

- `README.md` : présentation, démarrage et commandes.
- `AGENTS.md` : règles impératives destinées aux agents de code.
- `docs/PRODUCT_SPEC.md` : copie ou référence à ce cahier des charges.
- `docs/ARCHITECTURE.md` : décisions d’architecture et diagrammes.
- `docs/DATA_MODEL.md` : entités, relations, contraintes et règles de suppression.
- `docs/API.md` : conventions et endpoints.
- `docs/SECURITY.md` : modèle de menace et contrôles.
- `docs/FINANCE_RULES.md` : règles de calcul et cas de test financiers.
- `docs/INTEGRATIONS.md` : OAuth, synchronisations, webhooks et reprises.
- `docs/ADR/` : Architecture Decision Records.
- `docs/agent-plans/` : plans de travail et résultats des agents.
- `docs/runbooks/` : déploiement, sauvegarde, restauration et incidents.

## 0.3 Contrat de sortie d’un agent IA

Pour toute tâche non triviale, l’agent doit fournir :
1. Le périmètre traité.
2. Les fichiers créés ou modifiés.
3. Les décisions techniques prises et leurs raisons.
4. Les migrations éventuelles.
5. Les tests exécutés et leurs résultats.
6. Les risques ou limitations connus.
7. Les tâches restantes.
8. La confirmation qu’aucun secret réel n’a été ajouté au dépôt.

L’agent ne doit pas écraser des changements de travail non liés ni lancer une migration destructive sans autorisation.

---

# 1. Vision et objectifs du produit

## 1.1 Vision

Personal OS est une application centralisée permettant à une personne de gérer sa vie professionnelle, ses projets, ses idées, ses finances, ses ressources techniques, ses documents et ses engagements depuis un même espace.

Le produit doit être personnel dans son expérience initiale, tout en reposant dès le départ sur une architecture compatible avec plusieurs espaces de travail, plusieurs utilisateurs et un modèle SaaS multi-tenant.

Il ne s’agit pas d’un simple gestionnaire de tâches ou d’une application de comptabilité. Le produit doit relier les données afin qu’une information saisie une seule fois puisse être exploitée dans plusieurs contextes.

## 1.2 Objectifs métier

- Centraliser les informations professionnelles et personnelles pertinentes.
- Gérer les clients, contacts, contrats, projets et applications.
- Inventorier les domaines, serveurs, fournisseurs et services techniques.
- Conserver les références et secrets techniques de façon sécurisée.
- Suivre les entrées, sorties, transferts, dettes, créances et engagements financiers.
- Connaître les soldes des comptes et distinguer trésorerie, revenus, dépenses et dettes.
- Capturer les idées et les transformer en projets, objectifs et tâches.
- Organiser notes, documents, réunions et historique.
- Visualiser les échéances et réduire les oublis.
- Automatiser progressivement les opérations répétitives.
- Préparer une évolution future vers un SaaS multi-tenant commercialisable.

## 1.3 Principes structurants

1. **Une source de vérité :** une donnée métier est créée une seule fois et référencée ailleurs.
2. **Relations explicites :** clients, projets, applications, domaines, serveurs, factures et transactions doivent pouvoir être reliés.
3. **Traçabilité :** les actions importantes doivent être historisées.
4. **Sécurité par défaut :** les permissions sont vérifiées côté serveur.
5. **Précision financière :** pas de calcul monétaire avec des nombres flottants.
6. **Automatisation contrôlée :** l’IA propose ou extrait ; le backend valide.
7. **Architecture évolutive sans sur-ingénierie :** monolithe modulaire au départ.
8. **Réversibilité :** exports, sauvegardes, migrations et suppression contrôlée.
9. **Expérience de capture rapide :** enregistrer une idée ou une dépense doit être simple.
10. **Contexte partout :** une tâche, une note ou une transaction peut être reliée à la bonne entité.

## 1.4 Non-objectifs initiaux

La V1 n’est pas :
- un logiciel bancaire connecté automatiquement à tous les comptes ;
- un système comptable réglementaire complet ;
- un gestionnaire de mots de passe certifié ;
- une plateforme de paiement ;
- un ERP complet ;
- un outil de gestion des ressources humaines ;
- une application mobile native obligatoire ;
- une architecture distribuée en microservices ;
- un agent IA autonome disposant d’un accès illimité aux données.

---

# 2. Utilisateurs, espaces et rôles

## 2.1 Types d’utilisateurs

- **Propriétaire personnel :** utilisateur initial, administrateur de son espace.
- **Propriétaire d’organisation :** rôle futur pour une organisation ou un workspace partagé.
- **Administrateur :** gère les membres et les paramètres autorisés.
- **Membre :** travaille sur les données accessibles de l’espace.
- **Lecteur :** consulte sans modifier.
- **Agent d’automatisation :** identité technique à permissions limitées, sans accès implicite à toutes les données.

## 2.2 Workspace

Toute donnée métier appartient à un workspace. La première installation crée un workspace personnel pour l’utilisateur.

Un workspace possède :
- un identifiant UUID ;
- un nom ;
- un slug ;
- un type (`PERSONAL`, `TEAM`) ;
- un propriétaire ;
- des paramètres régionaux ;
- une devise par défaut ;
- un fuseau horaire ;
- des dates de création et de modification.

Chaque membre est associé au workspace via une table de liaison. Une contrainte unique doit empêcher d’ajouter deux fois le même utilisateur au même espace.

## 2.3 Règles multi-tenant

- Toute requête métier est exécutée dans le contexte d’un workspace autorisé.
- Le client ne peut pas imposer librement le `workspace_id` sans contrôle d’appartenance.
- Les relations entre entités doivent être vérifiées dans le même workspace.
- Les jobs asynchrones, exports, webhooks et tâches planifiées doivent transporter un contexte de workspace explicite.
- Les identifiants UUID ne remplacent jamais le contrôle d’autorisation.
- Les tests doivent tenter d’accéder aux données d’un autre workspace.
- PostgreSQL RLS peut être ajouté comme défense en profondeur, après définition et tests de son contexte de session.
- Aucun membre ne reçoit automatiquement accès au coffre-fort parce qu’il appartient au workspace.

---

# 3. Périmètre fonctionnel global

## 3.1 Modules

1. Authentification et gestion des utilisateurs.
2. Workspaces et permissions.
3. Dashboard et centre d’attention.
4. Clients, contacts et relations professionnelles.
5. Contrats, devis, factures et paiements.
6. Projets, applications et environnements.
7. Domaines, serveurs, services et infrastructures.
8. Coffre-fort de secrets.
9. Finances personnelles et professionnelles.
10. Dettes, créances et remboursements.
11. Idées et capture rapide.
12. Tâches et sous-tâches.
13. Objectifs, habitudes et apprentissage.
14. Notes, journal et documents.
15. Calendrier et rappels.
16. Notifications.
17. Intégrations externes.
18. Automatisations et traitements asynchrones.
19. Assistant IA.
20. Recherche globale.
21. Historique, audit et administration.
22. Exports, imports, sauvegardes et restauration.
23. Paramètres et préférences.

## 3.2 Priorités

- **P0 — indispensable V1 :** sécurité, workspace, clients, projets, idées, tâches, notes, finances essentielles, dettes/créances, inventaire technique, dashboard, audit et sauvegardes.
- **P1 — après V1 :** contrats et factures avancés, documents avancés, rappels, coûts récurrents, calendrier en lecture/écriture limitée, objectifs.
- **P2 — intégrations :** Google Calendar, Gmail, notifications externes, automatisations n8n, imports de données.
- **P3 — intelligence :** capture WhatsApp, transcription vocale, assistant IA, extraction de factures, recommandations.
- **P4 — SaaS :** onboarding multi-organisation, abonnements, quotas, facturation SaaS, invitations et fonctionnalités d’équipe avancées.

Les niveaux indiquent l’ordre de livraison recommandé, non une obligation de tout inclure dans la première version.

---

# 4. Exigences fonctionnelles détaillées

## 4.1 Authentification et profil

### Fonctionnalités
- Inscription ou création initiale contrôlée.
- Connexion et déconnexion.
- Hachage robuste des mots de passe.
- Réinitialisation par jeton à durée limitée.
- Vérification de l’adresse e-mail si le produit expose l’inscription.
- Gestion des sessions et révocation.
- MFA/TOTP avant exposition de secrets sensibles.
- Préférences de langue, fuseau horaire, devise et format de date.
- Historique des connexions et alertes de sécurité pertinentes.
- Révocation de toutes les sessions.
- Procédure de suppression et d’export du compte.

### Critères d’acceptation
- Un utilisateur non authentifié ne peut pas accéder aux endpoints privés.
- Les jetons de réinitialisation sont à usage unique et expirent.
- La déconnexion invalide ou révoque la session concernée.
- Les erreurs d’authentification ne révèlent pas inutilement si un compte existe.
- Les secrets d’authentification ne sont jamais écrits dans les logs.

## 4.2 Dashboard

Le dashboard est personnalisable à terme et affiche les éléments utiles à l’action.

### Widgets
- Trésorerie par compte et solde total.
- Revenus et dépenses sur période.
- Dettes à payer et créances à recevoir.
- Factures émises, impayées et en retard.
- Tâches du jour, tâches en retard et priorités.
- Projets actifs et progression.
- Dernières idées capturées.
- Prochains rendez-vous.
- Domaines à renouveler.
- Services et abonnements à échéance.
- Serveurs et applications nécessitant une intervention.
- Activité récente.
- Alertes de synchronisation ou d’automatisation en échec.

### Exigences
- Les périodes doivent être explicites.
- Les widgets financiers doivent utiliser les mêmes services de calcul que les pages de finance.
- Les widgets respectent le workspace actif et les permissions.
- Les valeurs nulles et l’absence de données sont présentées clairement.
- Chaque widget propose un lien vers le détail correspondant.
- Les données du dashboard ne doivent pas exposer le contenu des secrets.

## 4.3 Clients et contacts

### Client
Un client peut être une personne ou une entreprise.

Données principales :
- type ;
- nom ou raison sociale ;
- e-mail, téléphone ;
- adresse, ville, pays ;
- statut ;
- notes ;
- date de création ;
- archivage et suppression logique éventuelle.

### Contacts
Une entreprise peut avoir plusieurs contacts. Les contacts peuvent être associés à plusieurs organisations si le modèle métier le permet, via une table de liaison.

### Fonctionnalités
- CRUD complet avec validation.
- Recherche, tri et filtres.
- Historique des projets, contrats, factures, transactions et notes.
- Rappels de relance.
- Notes d’échange et comptes rendus.
- Archivage sans perte d’historique financier.
- Export contrôlé.

### Critères d’acceptation
- Un client archivé reste consultable dans l’historique.
- La suppression ne supprime pas en cascade les factures ou transactions validées.
- Les contacts et leurs rôles sont affichés dans la fiche client.
- Les informations sensibles ou non nécessaires ne sont pas retournées par défaut.

## 4.4 Contrats, devis et factures

### Contrats
- Référence unique par workspace.
- Client associé.
- Projet associé facultatif.
- Montant, devise, période, statut.
- Document associé.
- Jalons ou échéances facultatifs.
- Historique de statut.

### Factures
- Numéro unique par workspace selon une stratégie définie.
- Client, projet et contrat facultatifs selon les règles.
- Date d’émission et date d’échéance.
- Lignes de facture, quantités, prix unitaires et taxes.
- Sous-total, taxes et total calculés côté serveur.
- Paiements partiels.
- Solde restant calculé.
- Statuts : brouillon, émise, partiellement payée, payée, en retard, annulée.
- Export PDF à prévoir.
- Aucune facture émise ne doit être modifiée sans politique d’édition et audit.
- Les factures annulées restent traçables.

### Règles
- Les montants de ligne et totaux sont recalculés côté serveur.
- Le frontend ne fait pas autorité sur les totaux.
- Les paiements doivent référencer les transactions financières correspondantes.
- Une facture ne peut être marquée payée si son solde reste positif, sauf mécanisme explicite d’avoir, remise ou radiation.
- Le système doit traiter les paiements reçus en plusieurs versements.
- Le système ne prétend pas assurer la conformité fiscale locale sans validation métier et juridique spécifique.

## 4.5 Projets

### Champs
- nom, slug, description ;
- type : freelance, produit personnel, apprentissage, interne ;
- client facultatif ;
- statut : planifié, actif, en pause, terminé, abandonné ;
- priorité ;
- dates de début et cible ;
- budget prévu ;
- devise ;
- date de fin réelle ;
- liens et documents ;
- timestamps et archivage.

### Fonctionnalités
- Liste, recherche, filtres et vue Kanban.
- Tâches et jalons.
- Relations aux idées, applications, dépenses, revenus et documents.
- Vue de progression.
- Historique des décisions.
- Calcul de rentabilité indicatif lorsque les données le permettent.

### Règles
- Un projet terminé n’est pas automatiquement supprimé.
- La progression doit être calculée selon une règle documentée.
- Le budget prévu n’est pas une dépense réalisée.
- Les données financières d’un projet sont issues du registre de transactions, pas de valeurs saisies indépendamment dans le projet.

## 4.6 Applications et environnements

### Application
- nom, description ;
- projet associé ;
- dépôt Git ;
- documentation ;
- statut ;
- technologie et tags ;
- date de mise en production ;
- notes de déploiement.

### Environnements
- développement, staging, production ou environnement personnalisé ;
- URL de base ;
- statut ;
- date du dernier déploiement ;
- notes ;
- ressources liées.

### Exigences
- Une application peut posséder plusieurs environnements.
- Un environnement peut dépendre de plusieurs ressources.
- Les URLs ne doivent pas être exécutées comme du contenu non fiable.
- Les identifiants et secrets ne sont pas stockés dans les notes en clair.
- Une application peut être associée à un client ou à un projet personnel.
- Les environnements arrêtés restent visibles dans l’historique.

## 4.7 Inventaire d’infrastructure

### Domaines
- nom de domaine ;
- registrar ;
- date d’enregistrement ;
- expiration ;
- renouvellement automatique déclaré ;
- coût et devise ;
- DNS et notes ;
- statut ;
- application liée facultative ;
- rappels de renouvellement.

### Serveurs
- fournisseur ;
- identifiant fournisseur ;
- nom ;
- hostname et adresse IP ;
- région ;
- OS ;
- CPU, RAM, stockage ;
- coût, devise et période de facturation ;
- prochaine échéance ;
- statut ;
- procédures de sauvegarde et restauration ;
- applications/environnements hébergés.

### Services externes et abonnements
- fournisseur ;
- service ;
- catégorie ;
- périodicité ;
- montant ;
- devise ;
- prochaine échéance ;
- statut ;
- ressources associées.

### Historique technique
- déploiement ;
- migration ;
- incident ;
- renouvellement ;
- sauvegarde vérifiée ;
- changement de configuration ;
- intervention et résultat.

### Exigences
- Rappels configurables avant échéance.
- Pas d’affirmation « renouvellement automatique actif » sans donnée ou confirmation explicite.
- Une ressource peut être liée à plusieurs applications selon le modèle.
- Les coûts sont liés au registre financier lorsqu’ils sont réellement payés ; le coût prévu est distinct.
- Les adresses IP et noms d’hôtes peuvent être considérés comme des informations sensibles selon le contexte et doivent être protégés par les permissions.

## 4.8 Coffre-fort de secrets

### Objectif
Gérer les références d’accès à des ressources techniques sans stocker de valeur secrète en clair.

### Types de secrets
- mot de passe ;
- clé SSH privée ;
- token API ;
- clé d’accès cloud ;
- certificat ;
- identifiant et secret ;
- autre secret.

### Métadonnées
- titre ;
- type ;
- identifiant/nom d’utilisateur si nécessaire ;
- valeur chiffrée ;
- paramètres cryptographiques nécessaires ;
- version de clé ;
- ressource associée ;
- expiration ;
- dates de création, modification et rotation ;
- notes non sensibles.

### Exigences de sécurité obligatoires
- Chiffrement authentifié côté serveur avec une bibliothèque éprouvée.
- Clé de chiffrement conservée séparément des données chiffrées.
- Préférence pour KMS ou gestionnaire de secrets ; sinon mécanisme documenté avec séparation, rotation et sauvegarde.
- MFA et réauthentification pour révéler un secret.
- Permissions spécifiques au coffre-fort.
- Aucun secret dans les logs, erreurs, traces, analytics, exports ordinaires ou prompts IA.
- Audit de création, modification, consultation, export et suppression.
- Rate limiting et détection des comportements anormaux.
- Prévention des fuites dans les réponses API.
- Procédure de rotation et de récupération des clés.
- Sauvegardes chiffrées et test de restauration.
- Politique de suppression des secrets et de leurs copies.
- Aucun secret réel dans Git, les tickets ou les jeux de tests.
- Les clés privées ne sont jamais affichées par défaut.
- Les tests utilisent uniquement des valeurs fictives.

### Limite
Le module ne doit pas être considéré comme un gestionnaire de mots de passe audité ou certifié sans audit indépendant. Une première version peut stocker des références vers un gestionnaire existant.

## 4.9 Comptes financiers

### Types possibles
- espèces ;
- portefeuille mobile ;
- banque ;
- compte de paiement ;
- autre compte.

### Champs
- nom ;
- type ;
- fournisseur ;
- devise ;
- solde initial ;
- date d’ouverture ;
- statut actif/inactif ;
- notes.

### Exigences
- Les comptes sont séparés par devise.
- Le solde courant est calculé à partir du solde initial et des mouvements validés.
- Les comptes archivés restent dans l’historique.
- Le solde initial ne doit pas être réécrit pour corriger une opération postérieure ; utiliser une correction auditée.
- Un transfert entre comptes produit un débit et un crédit liés, sans créer revenu ni dépense.
- Une transaction en attente n’affecte pas le solde réalisé sauf règle d’affichage explicitement séparée.

## 4.10 Transactions financières

### Types
- `INCOME` : revenu ou entrée classifiée ;
- `EXPENSE` : dépense ;
- `TRANSFER` : transfert entre comptes ;
- `BORROWING` : emprunt reçu ;
- `LOAN` : prêt accordé ;
- `REFUND` : remboursement ;
- `ADJUSTMENT` : correction contrôlée.

La classification du type ne suffit pas : chaque transaction doit avoir une catégorie économique ou un traitement défini permettant de distinguer revenu, dépense, dette, créance et mouvement interne.

### Champs
- workspace ;
- type ;
- statut ;
- description ;
- montant positif ;
- devise ;
- date de l’opération ;
- catégorie ;
- compte source ;
- compte destination ;
- client/projet/facture/dette éventuellement liés ;
- contrepartie ;
- référence externe ;
- notes ;
- créateur ;
- timestamps.

### Catégories initiales
Revenus :
- paiement client ;
- salaire ;
- freelance ;
- cadeau reçu ;
- remboursement reçu ;
- autre entrée.

Dépenses :
- alimentation ;
- transport ;
- logement ;
- abonnement ;
- hébergement ;
- matériel ;
- santé ;
- formation ;
- don ;
- remboursement de dette ;
- autre dépense.

Ces catégories sont personnalisables par workspace. Le cadeau reçu n’est pas automatiquement un revenu professionnel. Le remboursement de capital n’est pas automatiquement une charge opérationnelle.

### Règles de validation
- Montant strictement positif.
- Devise obligatoire.
- Date d’opération validée.
- Compte source obligatoire pour une dépense réglée.
- Compte destination obligatoire pour une entrée encaissée.
- Un transfert nécessite une source et une destination différentes.
- Les deux comptes d’un transfert doivent respecter la règle de devise définie ; les transferts multi-devises nécessitent une conversion explicite et un taux documenté.
- Les transactions validées ne sont pas supprimées silencieusement.
- Une annulation est auditée et ne doit pas falsifier l’historique.
- L’idempotence empêche un double enregistrement d’un même événement externe.
- Les opérations composées utilisent une transaction SQL.
- Les montants utilisent `DECIMAL/NUMERIC` ou des unités mineures entières selon une convention documentée, jamais `float/double`.
- Les dates sont stockées de manière cohérente en UTC pour les instants et les dates civiles dans leur type adapté.
- Toute conversion de devise conserve le montant d’origine, le montant converti, le taux et la date de référence.

## 4.11 Dettes et créances

### Types
- `PAYABLE` : somme que l’utilisateur doit ;
- `RECEIVABLE` : somme due à l’utilisateur.

### Champs
- contrepartie ;
- titre et motif ;
- montant initial ;
- devise ;
- date d’ouverture ;
- échéance ;
- statut ;
- notes ;
- échéancier facultatif.

### Fonctionnalités
- Création d’une dette ou créance.
- Remboursements partiels.
- Historique des versements.
- Solde restant.
- Alertes avant échéance et en retard.
- Statut : ouverte, partiellement réglée, soldée, en retard, annulée ou radiée selon les règles définies.
- Liaison aux transactions réelles.
- Vue par personne, période et statut.

### Règles
- Le solde restant est dérivé du principal et des mouvements liés.
- Un remboursement doit être relié à une transaction.
- Une transaction ne doit pas être comptée deux fois dans le solde d’un compte.
- Le système refuse par défaut un remboursement supérieur au solde, sauf opération explicitement traitée comme avance, trop-perçu ou correction.
- Intérêts, pénalités et échéanciers complexes sont hors V1 sauf décision ultérieure.

## 4.12 Factures et paiements

- Une facture peut avoir plusieurs paiements.
- Un paiement est représenté par une transaction financière validée.
- Une table de liaison permet de répartir un paiement entre plusieurs factures si nécessaire.
- Le montant payé et le solde restant sont dérivés des paiements valides.
- Une facture payée ne doit pas créer une nouvelle transaction si le paiement existe déjà.
- Les factures annulées et leurs paiements restent audités.
- Les avoirs et remboursements seront traités explicitement, sans modifier artificiellement les montants d’origine.

## 4.13 Transactions récurrentes et prévisions

- Dépenses récurrentes mensuelles/annuelles.
- Revenus attendus.
- Date de prochaine occurrence.
- Périodicité et date de fin.
- Activation/désactivation.
- Génération d’échéances prévisionnelles.
- Création de transaction réelle uniquement lorsque l’événement est confirmé ou selon une règle configurée.
- Éviter les doublons grâce à une clé d’idempotence liée à l’occurrence.
- Les prévisions sont séparées des mouvements réalisés.

## 4.14 Idées

### Champs
- titre ;
- description ;
- date de capture ;
- source ;
- statut ;
- priorité ;
- domaine ;
- tags ;
- score potentiel facultatif ;
- projet issu de l’idée facultatif ;
- timestamps et archivage.

### Statuts suggérés
- `INBOX` ;
- `TO_REVIEW` ;
- `EVALUATED` ;
- `SELECTED` ;
- `IN_PROGRESS` ;
- `REALIZED` ;
- `ABANDONED`.

### Fonctionnalités
- Capture rapide sans formulaire lourd.
- Tri chronologique par défaut, récent en premier.
- Recherche, tags et filtres.
- Évaluation et décision documentée.
- Transformation en projet sans perdre l’idée d’origine.
- Origine de l’idée : saisie, e-mail, WhatsApp, note vocale, import.
- Détection éventuelle de doublons comme suggestion, jamais suppression automatique.

## 4.15 Tâches

### Champs
- titre et description ;
- statut ;
- priorité ;
- dates de début et d’échéance ;
- date de fin ;
- durée estimée et réelle ;
- récurrence ;
- créateur et responsable éventuel ;
- projet ;
- relations métier ;
- timestamps.

### Fonctionnalités
- Liste, Kanban et calendrier.
- Sous-tâches.
- Dépendances.
- Tâches récurrentes.
- Rappels.
- Historique des changements.
- Liens vers clients, projets, domaines, factures et autres entités.
- Vue « Aujourd’hui », « En retard », « Cette semaine », « Sans échéance ».
- Capture rapide.
- Durée réelle facultative.

### Règles
- Une tâche terminée conserve son historique.
- Les tâches récurrentes génèrent des occurrences identifiables sans modifier les anciennes occurrences.
- Les dépendances circulaires sont interdites.
- Les changements d’échéance sont auditables.
- Les tâches automatiques doivent être identifiées comme telles.

## 4.16 Objectifs, habitudes et apprentissage

### Objectifs
- titre, description, période ;
- valeur cible et unité facultatives ;
- dates ;
- statut ;
- progression ;
- liens aux projets et tâches ;
- bilan.

### Habitudes
- nom ;
- fréquence ;
- date de début ;
- enregistrements journaliers ;
- notes ;
- indicateurs de régularité.

### Apprentissage
- compétence/technologie ;
- niveau initial et cible ;
- ressources ;
- sessions et durée ;
- exercices/projets ;
- prochaines étapes ;
- preuves de réalisation.

Ces fonctions sont P1/P2. Elles ne doivent pas retarder les modules fondamentaux.

## 4.17 Notes, journal et documents

### Notes
- titre ;
- contenu ;
- type ;
- source ;
- créateur ;
- dates ;
- tags ;
- relations vers des entités.

### Journal personnel
- date locale ;
- contenu ;
- humeur ou indicateurs facultatifs ;
- liens vers objectifs ou événements.

### Documents
- nom, type MIME, taille ;
- clé de stockage objet ;
- checksum ;
- créateur ;
- date ;
- relations aux entités ;
- statut de suppression.

### Exigences
- Stockage privé, accès par URL signée à durée limitée.
- Vérification du type et de la taille des fichiers.
- Noms de fichiers normalisés côté serveur.
- Contrôle contre les fichiers malveillants selon les moyens disponibles.
- Aucun fichier confidentiel servi publiquement.
- Les documents supprimés suivent une politique de rétention documentée.
- Les contenus de notes sont traités comme données non fiables, notamment s’ils sont affichés en HTML ou transmis à une IA.

## 4.18 Calendrier et rappels

### Événements
- titre, description ;
- début et fin ;
- fuseau horaire ;
- emplacement ;
- fournisseur externe ;
- identifiant externe ;
- état de synchronisation ;
- relation métier éventuelle.

### Rappels
- objet ;
- date/heure d’exécution ;
- canal ;
- statut ;
- ressource liée ;
- tentatives ;
- résultat.

### Exigences
- Respect des fuseaux horaires et changements d’heure.
- Gestion des événements annulés.
- Déduplication des événements externes.
- Retries contrôlés.
- Éviter les notifications en double.
- Gestion des rappels passés après une période d’indisponibilité.
- Préférence de l’utilisateur concernant les canaux et heures silencieuses.

## 4.19 Notifications

Canaux possibles :
- in-app ;
- e-mail ;
- push web si retenu ;
- intégrations externes autorisées.

Types :
- tâche échue ;
- renouvellement proche ;
- facture en retard ;
- dette à échéance ;
- synchronisation échouée ;
- automatisation échouée ;
- événement de sécurité.

Les notifications contiennent le minimum de données sensibles. Les secrets et contenus confidentiels ne sont pas inclus dans les notifications non sécurisées.

## 4.20 Recherche globale

La recherche doit couvrir :
- clients et contacts ;
- projets ;
- applications ;
- domaines et serveurs ;
- transactions ;
- factures ;
- idées ;
- tâches ;
- notes et documents selon permissions.

Exigences :
- respecter le workspace et les permissions ;
- pagination ;
- filtres et tri ;
- résultats limités aux champs nécessaires ;
- ne jamais indexer les valeurs secrètes déchiffrées ;
- prévoir une stratégie d’indexation évolutive.

## 4.21 Intégrations

### Architecture générale
Chaque intégration comprend :
- configuration et consentement ;
- état de connexion ;
- permissions/scopes ;
- jetons protégés ;
- identifiants externes ;
- synchronisation ;
- gestion des erreurs ;
- journal d’exécution ;
- procédure de révocation.

### Google Calendar
- OAuth avec scopes minimaux.
- Synchronisation initialement dans un sens.
- Synchronisation bidirectionnelle ultérieure après gestion des conflits.
- Identifiants externes stables.
- Webhooks/push notifications si disponibles, plus mécanisme de réconciliation périodique.
- Gestion des suppressions, modifications et fuseaux horaires.

### Gmail
- Recherche ou association d’e-mails selon scopes autorisés.
- Transformation d’un e-mail en tâche ou note.
- Brouillon de réponse facultatif.
- Aucune lecture globale sans besoin explicite.
- Les corps d’e-mails sont des données non fiables.
- Pas d’envoi automatique sans règle et autorisation explicites.

### WhatsApp
- Utiliser une API officielle ou un fournisseur compatible.
- Vérifier les conditions d’usage, fenêtres de conversation et règles de modèles applicables.
- Webhooks signés et idempotents.
- Vérifier l’origine des messages.
- Les messages entrants ne sont jamais exécutés comme des commandes arbitraires.
- La création de transactions financières requiert confirmation ou règle préalablement autorisée.
- Les notes vocales peuvent être transcrites dans une étape dédiée, avec consentement et politique de rétention.

### n8n
- Peut orchestrer des workflows externes.
- Appelle l’API métier avec une identité limitée.
- Ne contourne pas les contrôles de sécurité.
- Les secrets de connexion restent dans un stockage protégé.
- Les workflows sont versionnés/documentés.
- Les exécutions sont traçables.

## 4.22 Automatisations

### Structure d’une règle
- nom ;
- déclencheur ;
- conditions ;
- actions ;
- statut actif/inactif ;
- propriétaire ;
- version ;
- date de dernière modification.

### Déclencheurs
- date/heure ;
- échéance approchante ;
- création ou modification d’entité ;
- réception d’un webhook ;
- événement de calendrier ;
- déclenchement manuel ;
- exécution planifiée.

### Actions
- créer une tâche ;
- créer un rappel ;
- envoyer une notification ;
- préparer un brouillon d’e-mail ;
- appeler une intégration autorisée ;
- produire un résumé ;
- proposer une transaction en attente de confirmation.

### Exigences
- Chaque exécution a un identifiant et un statut.
- Idempotence par exécution et action.
- Retry avec backoff pour erreurs temporaires.
- Pas de retry automatique infini.
- Gestion de dead-letter queue si nécessaire.
- Timeout sur les appels externes.
- Validation des données.
- Les erreurs ne contiennent pas de secrets.
- Les actions destructives ou financières demandent une autorisation explicite.
- Une règle désactivée ne doit plus lancer de nouvelle exécution.
- Les exécutions en cours suivent une politique documentée lorsqu’une règle est désactivée.

## 4.23 Assistant IA

### Cas d’usage
- Interroger les données autorisées en langage naturel.
- Résumer l’activité hebdomadaire.
- Proposer une catégorie de transaction.
- Extraire une idée d’un message.
- Résumer des notes de réunion.
- Préparer un brouillon de tâche ou de réponse.
- Détecter les échéances potentielles dans un document.

### Garde-fous
- L’IA ne reçoit que le contexte nécessaire.
- Les permissions sont appliquées avant l’appel et avant toute action.
- Aucun accès SQL libre fourni au modèle.
- Les outils sont définis par schéma et validés.
- Les opérations financières sont confirmées par l’utilisateur, sauf workflow explicitement configuré et audité.
- Les secrets ne sont jamais envoyés au modèle.
- Les données récupérées sont considérées comme non fiables : protection contre prompt injection.
- Les actions et leurs résultats sont audités.
- L’utilisateur peut désactiver les fonctions IA.
- La conservation des prompts/réponses est limitée et documentée.
- Le fournisseur IA et les régions de traitement doivent être choisis selon les exigences de confidentialité.

## 4.24 Audit et historique

Tracer au minimum :
- connexions et événements de sécurité ;
- création, modification et archivage de données critiques ;
- transactions financières ;
- changements de dette/créance ;
- accès au coffre-fort ;
- exports ;
- changements de permissions ;
- connexions/déconnexions d’intégrations ;
- exécutions d’automatisations importantes.

Les logs ne doivent pas contenir :
- mots de passe ;
- tokens ;
- clés privées ;
- secrets déchiffrés ;
- corps de documents sensibles par défaut ;
- données complètes de paiement si inutiles.

## 4.25 Import, export et portabilité

- Export JSON/CSV pour les données tabulaires lorsque cela est pertinent.
- Export des documents selon permissions.
- Export financier incluant devise, dates, catégories et références.
- Exclusion des secrets par défaut.
- Confirmation supplémentaire avant export sensible.
- Import avec prévisualisation, validation et rapport d’erreurs.
- Détection de doublons.
- Pas d’import silencieux qui écrase des données.
- Limites de taille et protections contre les fichiers malveillants.
- Export complet d’un workspace à prévoir avant le lancement SaaS.

---

# 5. Modèle de données de référence

Le schéma définitif doit être maintenu dans `docs/DATA_MODEL.md` et dans Prisma. La liste ci-dessous est la base conceptuelle ; les noms peuvent être ajustés avant la première migration.

## 5.1 Identifiants et conventions

- Identifiants primaires : UUID.
- Timestamps : `created_at`, `updated_at` sur les entités modifiables.
- Suppression logique : `deleted_at` uniquement lorsque le besoin métier le justifie.
- Montants : `Decimal/NUMERIC` avec précision documentée, ou unités mineures entières selon la convention adoptée.
- Devise : code ISO 4217 lorsque applicable.
- Dates d’instant : UTC.
- Dates civiles : type `DATE`.
- Champs de statut : enums ou tables de référence selon la fréquence d’évolution.
- `workspace_id` sur toutes les entités métier appartenant à un espace.
- JSON réservé aux métadonnées réellement variables ; éviter de cacher un modèle relationnel dans des blobs JSON.

## 5.2 Identité et espaces

### `users`
- `id`
- `email` unique normalisé
- `password_hash`
- `first_name`
- `last_name`
- `timezone`
- `locale`
- `mfa_enabled`
- `email_verified_at`
- `created_at`
- `updated_at`

### `workspaces`
- `id`
- `name`
- `slug`
- `type`
- `owner_user_id`
- `default_currency`
- `timezone`
- `created_at`
- `updated_at`

### `workspace_members`
- `id`
- `workspace_id`
- `user_id`
- `role`
- `joined_at`
- unique `(workspace_id, user_id)`

### `sessions` ou `refresh_tokens`
- `id`
- `user_id`
- `token_hash`
- `expires_at`
- `revoked_at`
- `created_at`
- métadonnées d’appareil limitées et justifiées.

## 5.3 CRM

### `clients`
- `id`, `workspace_id`
- `type`
- `name`
- `email`
- `phone`
- `address`
- `city`
- `country_code`
- `status`
- `notes`
- `created_at`, `updated_at`, `deleted_at`

### `contacts`
- `id`, `workspace_id`
- `first_name`, `last_name`
- `email`, `phone`
- `job_title`
- `notes`
- timestamps.

### `client_contacts`
- `client_id`
- `contact_id`
- `relationship_role`
- `is_primary`

### `contracts`
- `id`, `workspace_id`
- `client_id`
- `project_id` nullable
- `reference`
- `title`, `description`
- `amount`, `currency`
- `start_date`, `end_date`
- `status`
- `document_id` nullable
- timestamps.

## 5.4 Projets et ressources techniques

### `projects`
- `id`, `workspace_id`
- `client_id` nullable
- `name`, `slug`, `description`
- `type`, `status`, `priority`
- `start_date`, `target_date`, `completed_at`
- `budget_amount` nullable, `currency`
- timestamps, `deleted_at`.

### `applications`
- `id`, `workspace_id`
- `project_id` nullable
- `name`, `description`
- `repository_url`, `documentation_url`
- `status`
- timestamps.

### `application_environments`
- `id`, `workspace_id`
- `application_id`
- `name`
- `base_url`
- `status`
- `deployed_at`
- `deployment_notes`.

### `domains`
- `id`, `workspace_id`
- `application_id` nullable
- `name`
- `registrar`
- `registered_at`, `expires_at`
- `auto_renew`
- `annual_cost`, `currency`
- `status`, `notes`
- timestamps.

### `servers`
- `id`, `workspace_id`
- `provider`, `provider_resource_id`
- `name`, `hostname`, `ip_address`
- `operating_system`
- `cpu_cores`, `ram_mb`, `storage_gb`
- `region`
- `monthly_cost`, `currency`
- `renewal_at`
- `status`
- timestamps.

### `environment_resources`
- `id`, `workspace_id`
- `environment_id`
- référence vers la ressource selon stratégie de relation retenue
- `role`
- `created_at`.

La décision entre relation polymorphe et tables de liaison explicites doit être documentée avant migration. Favoriser l’intégrité référentielle lorsqu’elle est possible.

### `service_subscriptions`
- `id`, `workspace_id`
- `provider`, `service_name`, `category`
- `billing_period`
- `amount`, `currency`
- `next_billing_at`
- `status`
- liens optionnels vers application ou serveur
- `notes`.

## 5.5 Coffre-fort

### `vault_items`
- `id`, `workspace_id`
- `title`
- `secret_type`
- `username` nullable
- `ciphertext`
- paramètres cryptographiques (`nonce`, tag ou format de paquet selon la bibliothèque)
- `key_version`
- référence de ressource associée
- `expires_at`
- timestamps.

### `vault_access_logs`
- `id`, `workspace_id`
- `user_id`
- `vault_item_id`
- `action`
- `occurred_at`
- `success`
- métadonnées non sensibles.

Le design cryptographique final est une décision de sécurité distincte. Ne pas traiter ce modèle conceptuel comme une implémentation complète du chiffrement.

## 5.6 Finance

### `financial_accounts`
- `id`, `workspace_id`
- `name`, `provider`, `account_type`
- `currency`
- `opening_balance`
- `opened_at`
- `is_active`
- `notes`
- timestamps.

### `transaction_categories`
- `id`, `workspace_id`
- `name`
- `type`
- `parent_id` nullable
- `is_system`
- `created_at`.

### `counterparties`
- `id`, `workspace_id`
- `name`, `type`
- `phone`, `email`
- `notes`
- timestamps.

### `transactions`
- `id`, `workspace_id`
- `type`, `status`
- `description`
- `amount`, `currency`
- `occurred_at`
- `category_id` nullable
- `source_account_id` nullable
- `destination_account_id` nullable
- `client_id`, `project_id`, `invoice_id`, `debt_id`, `counterparty_id` facultatifs
- `external_reference` nullable
- `idempotency_key` selon besoin
- `notes`
- `created_by`
- timestamps.

### `debts`
- `id`, `workspace_id`
- `type` (`PAYABLE`, `RECEIVABLE`)
- `counterparty_id`
- `title`, `description`
- `principal_amount`, `currency`
- `opened_at`, `due_at`
- `status`
- `notes`
- timestamps.

### `debt_repayments`
- `id`, `workspace_id`
- `debt_id`
- `transaction_id`
- `amount`
- `occurred_at`
- `notes`.

### `invoices`
- `id`, `workspace_id`
- `client_id`
- `project_id` nullable
- `contract_id` nullable
- `invoice_number`
- `issue_date`, `due_date`
- `subtotal`, `tax_amount`, `total_amount`
- `currency`, `status`
- `notes`
- timestamps.

### `invoice_items`
- `id`, `workspace_id`
- `invoice_id`
- `description`
- `quantity`
- `unit_price`
- `tax_rate`
- `line_total`.

### `invoice_payments`
- `id`, `workspace_id`
- `invoice_id`
- `transaction_id`
- `amount`
- `paid_at`.

### `recurring_transactions`
- `id`, `workspace_id`
- `name`, `type`
- `amount`, `currency`
- `account_id`
- `category_id`
- `frequency`
- `next_occurrence_at`, `end_at`
- `is_active`.

### Décision financière obligatoire
Avant l’implémentation, produire `docs/FINANCE_RULES.md` qui définit :
- catégories considérées comme revenu ou dépense ;
- effet de chaque type sur le solde ;
- traitement des emprunts et prêts ;
- transferts entre comptes ;
- remboursements ;
- paiements partiels ;
- corrections et annulations ;
- multi-devises ;
- solde initial ;
- périodes de reporting ;
- calcul de la position nette ;
- cas limites et exemples chiffrés.

## 5.7 Idées, tâches, objectifs

### `ideas`
- `id`, `workspace_id`
- `title`, `description`
- `status`, `priority`, `domain`
- `potential_score` nullable
- `captured_at`, `source`
- `converted_project_id` nullable
- timestamps, `deleted_at`.

### `tasks`
- `id`, `workspace_id`
- `title`, `description`
- `status`, `priority`
- `due_at`, `start_at`, `completed_at`
- `estimated_minutes`, `actual_minutes`
- `recurrence_rule` nullable
- timestamps.

### `task_links`
- `id`, `workspace_id`
- `task_id`
- `entity_type`, `entity_id`.

Documenter les limites d’intégrité référentielle des liens polymorphes.

### `task_dependencies`
- `task_id`
- `depends_on_task_id`
- contrainte interdisant une dépendance sur soi-même ;
- détection de cycles au niveau applicatif.

### `tags`
- `id`, `workspace_id`
- `name`, `color`.

### `idea_tags`, `task_tags`
- identifiants des deux entités ;
- contraintes uniques sur les paires.

### `goals`
- `id`, `workspace_id`
- `title`, `description`
- `period_type`
- `start_date`, `target_date`
- `target_value`, `current_value`, `unit`
- `status`
- timestamps.

### `goal_links`
- liens vers projets et tâches, avec règle de relation documentée.

## 5.8 Notes et documents

### `notes`
- `id`, `workspace_id`
- `title`, `content`, `content_type`
- `source`, `created_by`
- timestamps, `deleted_at`.

### `note_links`
- `id`, `workspace_id`
- `note_id`
- `entity_type`, `entity_id`.

### `documents`
- `id`, `workspace_id`
- `name`, `mime_type`, `size_bytes`
- `storage_key`
- `checksum`
- `uploaded_by`
- `created_at`, `deleted_at`.

## 5.9 Calendrier et automatisation

### `calendar_events`
- `id`, `workspace_id`
- `title`, `description`
- `start_at`, `end_at`, `timezone`
- `location`
- `provider`, `external_event_id`
- `sync_status`
- timestamps.

### `reminders`
- `id`, `workspace_id`
- `title`, `scheduled_at`
- `status`, `channel`
- référence vers entité associée
- timestamps.

### `notifications`
- `id`, `workspace_id`
- `user_id`
- `type`, `title`, `body`
- `read_at`, `created_at`.

### `integrations`
- `id`, `workspace_id`
- `provider`, `status`
- `external_account_id`
- `scopes`
- `last_sync_at`
- timestamps.
- Référence vers le stockage chiffré des jetons, jamais jetons en clair.

### `automation_rules`
- `id`, `workspace_id`
- `name`, `description`
- `trigger_type`
- `trigger_config`
- `conditions`, `actions`
- `is_enabled`
- timestamps.

### `automation_runs`
- `id`, `workspace_id`
- `automation_rule_id`
- `status`
- `started_at`, `finished_at`
- `result_summary`
- `error_code`
- `retry_count`.

### `audit_logs`
- `id`, `workspace_id`
- `actor_user_id`
- `action`
- `entity_type`, `entity_id`
- `occurred_at`
- `request_id`
- métadonnées filtrées et non sensibles.

### Tables futures
- `habits`, `habit_logs`
- `learning_resources`, `learning_sessions`
- `daily_journals`
- `time_entries`
- `entity_attachments`
- `webhook_endpoints`, `webhook_deliveries`
- `api_keys`
- `saved_views`
- `user_preferences`
- `billing_accounts`, `subscriptions`, `usage_records` pour la phase SaaS.

## 5.10 Index et contraintes

Prévoir au minimum :
- index sur `workspace_id` pour les tables métier ;
- index composites `(workspace_id, status)` sur les listes filtrées ;
- index sur les dates d’échéance et de renouvellement ;
- index sur les relations étrangères ;
- unicité des slugs par workspace ;
- unicité des références de facture par workspace ;
- unicité des événements externes par intégration et identifiant externe ;
- contraintes de montants positifs ;
- contraintes de dates cohérentes lorsque possible ;
- clés étrangères avec stratégie de suppression explicitement choisie ;
- index adaptés à la recherche ;
- clés d’idempotence uniques dans leur périmètre.

Les index doivent être validés avec les requêtes réelles et les plans d’exécution, pas ajoutés sans mesure.

---

# 6. Règles de calcul financier

Cette section est une spécification fonctionnelle obligatoire.

## 6.1 Solde d’un compte

Solde réalisé =
solde initial
+ somme des crédits validés
− somme des débits validés.

Un transfert interne débite un compte et crédite un autre compte. La somme globale des soldes ne change pas, hors conversion de devise ou frais explicitement enregistrés.

## 6.2 Revenus et dépenses

Les rapports de revenus et dépenses sont déterminés par la classification économique validée de chaque mouvement. Le type technique de transaction ne suffit pas à lui seul.

- Un cadeau reçu augmente la trésorerie mais n’est pas nécessairement un revenu professionnel.
- Un emprunt augmente la trésorerie et la dette.
- Un remboursement de prêt accordé réduit une créance ; il n’est pas entièrement un revenu.
- Un remboursement de dette réduit la trésorerie et le passif ; le principal n’est pas automatiquement une charge opérationnelle.
- Un transfert interne n’est ni revenu ni dépense.
- Une transaction annulée ne compte pas dans les soldes réalisés.
- Une transaction en attente est affichée séparément.

## 6.3 Dettes et créances

Solde restant = principal + ajustements autorisés − remboursements imputés.

Si intérêts, frais ou pénalités sont ajoutés dans une version future, ils doivent être modélisés distinctement.

## 6.4 Factures

Solde à recevoir = total de facture − paiements valides imputés − crédits/avoirs applicables.

Une facture est :
- `DRAFT` si non émise ;
- `ISSUED` si émise et non payée ;
- `PARTIALLY_PAID` si une partie est réglée ;
- `PAID` si le solde est nul selon la précision monétaire retenue ;
- `OVERDUE` si elle est échue et reste due ;
- `CANCELLED` si annulée selon le processus audité.

La règle de priorité entre retard et paiement partiel doit être définie clairement dans l’implémentation.

## 6.5 Multi-devises

- Chaque compte a une devise.
- Chaque transaction a une devise.
- Aucun total global ne mélange les devises sans conversion explicite.
- Une conversion conserve montant d’origine, devise d’origine, taux, date du taux, montant cible et frais éventuels.
- La devise de reporting est affichée avec les résultats convertis.
- Le taux utilisé ne doit jamais être inventé par le système.

## 6.6 Tests financiers minimums

Écrire des tests couvrant :
1. entrée simple ;
2. dépense simple ;
3. transfert interne ;
4. emprunt reçu ;
5. prêt accordé ;
6. remboursement partiel d’une dette ;
7. remboursement partiel d’une créance ;
8. facture payée en plusieurs fois ;
9. transaction annulée ;
10. double requête idempotente ;
11. transfert multi-devises ;
12. correction de solde ;
13. montant nul ou négatif refusé ;
14. devise manquante refusée ;
15. accès à une transaction d’un autre workspace refusé.

---

# 7. Architecture technique

## 7.1 Stack retenu

### Frontend
- React ;
- TypeScript ;
- Vite ;
- Tailwind CSS ;
- shadcn/ui ou composants équivalents accessibles ;
- TanStack Query ou solution équivalente pour les données serveur ;
- React Hook Form et Zod, ou équivalent, pour les formulaires ;
- PWA si le mode hors ligne est retenu.

### Backend
- NestJS ;
- Fastify comme adaptateur HTTP si compatible avec les dépendances retenues ;
- API REST versionnée ;
- DTO et validation ;
- Prisma ;
- PostgreSQL ;
- Redis ;
- BullMQ ;
- stockage objet privé pour les fichiers.

### Exploitation
- Docker Compose ;
- reverse proxy HTTPS ;
- environnement staging ;
- sauvegardes ;
- supervision et logs ;
- CI/CD ;
- gestionnaire de secrets ou KMS lorsque disponible.

Les versions exactes des packages doivent être vérifiées au moment de l’initialisation, puis verrouillées dans le lockfile. Ne pas choisir des versions sur la base de ce document seul.

## 7.2 Architecture backend suggérée

```text
src/
├── app.module.ts
├── main.ts
├── common/
│   ├── decorators/
│   ├── guards/
│   ├── filters/
│   ├── interceptors/
│   ├── pipes/
│   └── policies/
├── infrastructure/
│   ├── database/
│   ├── queue/
│   ├── storage/
│   ├── mail/
│   ├── security/
│   └── observability/
└── modules/
    ├── auth/
    ├── users/
    ├── workspaces/
    ├── dashboard/
    ├── clients/
    ├── contracts/
    ├── invoices/
    ├── projects/
    ├── applications/
    ├── infrastructure-assets/
    ├── vault/
    ├── finance/
    ├── ideas/
    ├── tasks/
    ├── goals/
    ├── notes/
    ├── documents/
    ├── calendar/
    ├── notifications/
    ├── integrations/
    ├── automations/
    ├── search/
    └── audit/
```

Chaque module comprend selon son besoin :
- contrôleurs ;
- services ;
- DTO ;
- entités/types ;
- accès Prisma ;
- tests unitaires et d’intégration ;
- politiques d’autorisation.

Les services métier ne doivent pas être placés dans les contrôleurs. Les contrôleurs orchestrent HTTP, validation et appel des services.

## 7.3 Architecture frontend suggérée

```text
src/
├── app/
├── components/
│   ├── ui/
│   ├── layout/
│   ├── data-display/
│   └── forms/
├── features/
│   ├── auth/
│   ├── dashboard/
│   ├── clients/
│   ├── projects/
│   ├── infrastructure/
│   ├── vault/
│   ├── finance/
│   ├── ideas/
│   ├── tasks/
│   ├── notes/
│   ├── calendar/
│   ├── integrations/
│   └── settings/
├── lib/
├── hooks/
├── routes/
└── types/
```

## 7.4 API

- Préfixe `/api/v1`.
- Réponses et erreurs cohérentes.
- Pagination documentée.
- Validation stricte des paramètres et corps.
- Filtrage et tri par liste blanche.
- OpenAPI/Swagger généré et contrôlé.
- Limites de taille des requêtes et uploads.
- Idempotence pour les opérations sensibles ou les webhooks.
- Rate limiting pour auth, coffre-fort et endpoints exposés.
- Aucun endpoint générique permettant une lecture arbitraire de tables.
- Contrôle workspace et permissions dans les services/policies.
- Ne pas exposer les champs internes par sérialisation accidentelle de modèles Prisma.

## 7.5 Traitements asynchrones

BullMQ sert notamment à :
- envoyer les e-mails ;
- exécuter les rappels ;
- synchroniser les intégrations ;
- traiter les webhooks ;
- produire les exports ;
- exécuter les automatisations ;
- générer les résumés IA.

Chaque job doit contenir :
- identifiant de corrélation ;
- workspace ;
- type/version de tâche ;
- identifiant d’entité si applicable ;
- données minimales nécessaires ;
- clé d’idempotence quand pertinent.

Les jobs ne doivent pas contenir de secret en clair. Les erreurs doivent être filtrées avant journalisation.

## 7.6 Gestion des événements

Pour les événements métier critiques, envisager une table outbox transactionnelle afin qu’une modification SQL et la publication d’un événement ne puissent pas diverger silencieusement. Ne pas introduire ce mécanisme partout sans besoin ; le prioriser pour les événements financiers et les intégrations critiques.

---

# 8. Sécurité, confidentialité et conformité

## 8.1 Modèle de menace

Menaces principales :
- accès aux données d’un autre workspace ;
- vol de session ;
- fuite de secrets ;
- injection SQL ou XSS ;
- SSRF lors d’appels vers des URLs fournies par l’utilisateur ;
- vol de jetons OAuth ;
- replay ou duplication de webhooks ;
- prompt injection dans les notes, documents et e-mails ;
- exports non autorisés ;
- erreurs d’automatisation ;
- compromission du VPS ;
- sauvegardes exposées ;
- erreurs de calcul financier ;
- perte de données.

## 8.2 Mesures minimales

- HTTPS obligatoire.
- Cookies `HttpOnly`, `Secure`, `SameSite` si auth par cookie.
- Protection CSRF lorsque pertinente.
- Politique CORS restrictive.
- CSP et protections XSS.
- Validation côté serveur.
- Requêtes paramétrées via Prisma ou mécanisme sûr.
- Rate limiting.
- MFA pour le coffre-fort.
- Gestion des sessions et révocation.
- Secrets d’environnement hors Git.
- Moindre privilège sur PostgreSQL et Redis.
- Redis non exposé publiquement.
- Chiffrement des sauvegardes.
- Mises à jour et scan des dépendances.
- Audit des accès sensibles.
- Rotation des secrets.
- Protection des endpoints webhook.
- Filtrage SSRF des URL distantes.
- Limites d’upload et analyse des fichiers selon capacité.
- Tests d’isolation multi-tenant.
- Procédure de réponse à incident.

## 8.3 Confidentialité

- Collecter uniquement les données utiles.
- Documenter les finalités des intégrations.
- Limiter les permissions OAuth.
- Prévoir export et suppression du compte.
- Définir la rétention des logs et documents.
- Ne pas utiliser les données privées pour entraîner un modèle sans base légitime et consentement explicite approprié.
- Définir le fournisseur IA et les règles de conservation avant activation.
- Pour une commercialisation au Sénégal ou ailleurs, valider les obligations applicables en matière de données personnelles, transferts et hébergement avec une personne compétente.

## 8.4 Sauvegarde et reprise

- Sauvegardes PostgreSQL planifiées.
- Sauvegardes chiffrées et isolées du serveur de production.
- Politique de rétention documentée.
- Sauvegarde des fichiers et métadonnées cohérente.
- Procédure de restauration écrite.
- Test de restauration périodique.
- Définition des objectifs RPO/RTO avant production.
- Plan de récupération des clés de chiffrement.
- Surveillance de la réussite des sauvegardes.
- Alerte si une sauvegarde attendue manque.

---

# 9. Exigences non fonctionnelles

## 9.1 Performance
- Pagination sur toutes les listes importantes.
- Éviter les requêtes N+1.
- Indexation justifiée.
- Agrégats financiers optimisés mais reconstruisibles.
- Tâches lourdes exécutées en arrière-plan.
- Limites de taille sur les payloads.
- Mesurer les temps de réponse avant optimisation prématurée.

## 9.2 Fiabilité
- Transactions SQL pour les opérations composées.
- Idempotence des opérations externes.
- Retries contrôlés.
- Timeouts.
- Gestion d’erreurs cohérente.
- Migrations versionnées.
- Health checks.
- Surveillance des jobs échoués.

## 9.3 Accessibilité et UX
- Interface responsive desktop/tablette/mobile.
- Navigation clavier.
- Labels accessibles.
- Contraste suffisant.
- États de chargement, vide, succès et erreur.
- Confirmation des actions destructives.
- Formulaires avec validation compréhensible.
- Saisie rapide pour idées et transactions.
- Filtres persistants si utile.
- Pas de dashboard surchargé.
- Devise et période visibles pour les indicateurs financiers.

## 9.4 Portabilité
- Docker Compose pour le développement et le déploiement initial.
- Variables d’environnement documentées.
- Aucun chemin local codé en dur.
- Données exportables.
- Documentation des migrations.
- Dépendances verrouillées.
- Procédures de restauration testées.

---

# 10. UX et navigation

## 10.1 Navigation principale

Proposition de menu :
1. Dashboard
2. Capture rapide
3. Clients
4. Projets
5. Tâches
6. Idées
7. Finances
8. Infrastructures
9. Coffre-fort
10. Notes et documents
11. Calendrier
12. Automatisations
13. Paramètres

Les modules secondaires peuvent être regroupés dans une navigation « Plus » sur écran étroit.

## 10.2 Capture rapide globale

Un bouton accessible partout ouvre une capture de :
- idée ;
- tâche ;
- note ;
- transaction ;
- dépense récurrente à prévoir ;
- rendez-vous ;
- client ;
- incident technique.

Le formulaire adapte ses champs au type choisi. Il doit rester possible de saisir uniquement le titre ou la description pour une idée ou une note.

Pour une transaction, les champs indispensables ne sont pas omis : montant, devise, date, type et compte selon le cas.

## 10.3 États d’interface obligatoires

Chaque page doit prévoir :
- chargement ;
- liste vide ;
- erreur réseau ;
- erreur de validation ;
- accès refusé ;
- élément archivé ;
- succès ;
- conflit de modification si pertinent ;
- données périmées ou synchronisation en cours.

## 10.4 Recherche et filtres

Les filtres sont cohérents dans les modules :
- période ;
- statut ;
- client/projet ;
- catégorie ;
- devise ;
- priorité ;
- tags.

Les filtres ne doivent jamais permettre de contourner les permissions.

---

# 11. Critères d’acceptation transversaux

Une fonctionnalité ne peut être considérée terminée que si :

1. Les champs et règles métier sont validés côté backend.
2. Les permissions workspace sont appliquées.
3. Les erreurs sont traitées sans fuite d’informations sensibles.
4. Les cas limites importants sont testés.
5. Les opérations critiques sont idempotentes ou protégées contre les doublons.
6. L’interface gère les états de chargement, vide, succès et erreur.
7. Les migrations sont ajoutées si nécessaire.
8. La documentation est mise à jour.
9. Les logs n’exposent pas de secrets.
10. Les tests passent dans un environnement reproductible.
11. Les conséquences sur les autres modules sont vérifiées.
12. Le résultat est revu par un agent ou développeur différent pour les modules sensibles.

---

# 12. Stratégie de tests

## 12.1 Tests unitaires
- règles financières ;
- transitions de statut ;
- calculs de solde ;
- calcul de dette et créance ;
- validations de DTO ;
- autorisations ;
- règles d’échéance ;
- idempotence ;
- parsing de règles d’automatisation.

## 12.2 Tests d’intégration
- transactions Prisma ;
- contraintes PostgreSQL ;
- relations et suppressions ;
- jobs BullMQ ;
- stockage de documents ;
- génération de rappels ;
- OAuth/webhooks avec mocks contrôlés.

## 12.3 Tests end-to-end
- connexion et logout ;
- création d’un client ;
- création d’un projet lié au client ;
- création d’une transaction ;
- transfert entre comptes ;
- dette et remboursement partiel ;
- facture et paiements fractionnés ;
- création d’une application et d’un domaine ;
- création d’un secret fictif, consultation autorisée et refusée ;
- workspace A ne pouvant pas accéder aux données du workspace B ;
- création d’une idée et conversion en projet ;
- rappel déclenché sans doublon ;
- export contrôlé.

## 12.4 Tests de sécurité
- contrôle d’accès horizontal ;
- session expirée ;
- jeton révoqué ;
- brute force ;
- XSS ;
- CSRF selon le mécanisme d’auth ;
- SSRF ;
- injection ;
- upload dangereux ;
- webhook forgé ou rejoué ;
- fuite de secrets dans les logs ;
- export non autorisé ;
- prompt injection dans des documents.

## 12.5 Données de test
- jeux de données synthétiques uniquement ;
- pas de véritables coordonnées client ;
- pas de secrets réels ;
- tests financiers couvrant plusieurs devises ;
- jeux de données pour workspace isolés.

---

# 13. Déploiement et exploitation

## 13.1 Environnements
- développement local ;
- tests automatisés ;
- staging ;
- production.

Chaque environnement possède ses propres bases, secrets, clés et intégrations. Aucun test ne doit écrire dans la production.

## 13.2 Services
- frontend ;
- API NestJS ;
- worker BullMQ ;
- PostgreSQL ;
- Redis ;
- stockage objet ;
- reverse proxy ;
- service de mail ;
- supervision.

API et worker peuvent partager une base de code mais doivent avoir des processus distincts en production si nécessaire.

## 13.3 Pipeline CI/CD
- installation déterministe ;
- lint ;
- format ;
- vérification TypeScript ;
- tests unitaires ;
- tests d’intégration ;
- build ;
- scan de dépendances ;
- build d’image ;
- déploiement staging ;
- validation ;
- migration contrôlée ;
- déploiement production avec procédure de retour arrière.

## 13.4 Observabilité
- logs structurés ;
- request ID ;
- métriques de latence et erreurs ;
- profondeur de queue et jobs échoués ;
- état des sauvegardes ;
- espace disque ;
- état PostgreSQL/Redis ;
- alertes sur intégrations ;
- absence de secrets dans les traces.

---

# 14. Roadmap de réalisation

## Phase 0 — Cadrage et décisions
Livrables :
- architecture approuvée ;
- diagramme de données ;
- conventions de code ;
- règles financières ;
- modèle de menace ;
- structure de dépôt ;
- backlog découpé en tickets.

Aucune implémentation financière ou de coffre-fort ne démarre avant validation de ses règles critiques.

## Phase 1 — Fondations
- dépôt et CI ;
- Docker Compose ;
- PostgreSQL/Prisma ;
- authentification ;
- users/workspaces/members ;
- permissions ;
- audit initial ;
- layout frontend ;
- gestion des erreurs ;
- documentation.

## Phase 2 — Organisation personnelle
- clients et contacts ;
- projets ;
- tâches ;
- idées ;
- tags ;
- notes ;
- recherche simple ;
- dashboard initial.

## Phase 3 — Finance fiable
- comptes ;
- catégories ;
- transactions ;
- transferts ;
- dettes/créances ;
- remboursements ;
- factures et paiements ;
- rapports et tests financiers.

## Phase 4 — Inventaire technique
- applications ;
- environnements ;
- domaines ;
- serveurs ;
- services récurrents ;
- alertes de renouvellement ;
- historique d’intervention.

## Phase 5 — Sécurité et documents
- coffre-fort ;
- MFA ;
- gestion des clés ;
- documents privés ;
- exports ;
- sauvegarde et restauration ;
- revue de sécurité.

## Phase 6 — Automatisation de base
- Redis/BullMQ ;
- rappels ;
- notifications ;
- récurrences ;
- journal d’exécution ;
- e-mails sortants.

## Phase 7 — Intégrations
- Google Calendar en synchronisation limitée ;
- Gmail selon besoin ;
- n8n ;
- webhooks ;
- stratégie de synchronisation et reprise.

## Phase 8 — IA et capture multicanale
- extraction structurée ;
- notes vocales ;
- WhatsApp Business Platform ou fournisseur compatible ;
- assistant de recherche ;
- confirmations des opérations ;
- tests de prompt injection.

## Phase 9 — SaaS
- onboarding ;
- invitations ;
- rôles avancés ;
- abonnements et quotas ;
- facturation SaaS ;
- administration multi-tenant ;
- politique de rétention et suppression ;
- audit indépendant des composants critiques.

---

# 15. Backlog initial proposé

Les tâches suivantes doivent être converties en tickets avec critères d’acceptation, dépendances et estimation.

## EPIC A — Fondations
- A01 Initialiser monorepo ou dépôts séparés selon décision.
- A02 Configurer React/Vite/TypeScript.
- A03 Configurer NestJS/Fastify.
- A04 Configurer PostgreSQL et Prisma.
- A05 Configurer Docker Compose.
- A06 Ajouter lint, format et vérification TypeScript.
- A07 Ajouter CI.
- A08 Définir conventions d’erreur et de logging.
- A09 Documenter variables d’environnement.
- A10 Créer workspace initial.

## EPIC B — Auth et permissions
- B01 Inscription/initialisation sécurisée.
- B02 Connexion et sessions.
- B03 Réinitialisation.
- B04 Profil et préférences.
- B05 Guards d’authentification.
- B06 Workspace context.
- B07 Policies d’autorisation.
- B08 Tests d’isolation inter-workspaces.
- B09 MFA pour coffre-fort.
- B10 Audit de sécurité.

## EPIC C — CRM et projets
- C01 CRUD clients.
- C02 Contacts et relations.
- C03 Recherche clients.
- C04 CRUD projets.
- C05 Liens client-projet.
- C06 Statuts et archivage.
- C07 Tâches.
- C08 Dépendances de tâches.
- C09 Idées.
- C10 Conversion idée-projet.
- C11 Notes et tags.
- C12 Recherche globale initiale.

## EPIC D — Finance
- D01 Règles financières documentées.
- D02 Comptes et soldes initiaux.
- D03 Catégories.
- D04 Transactions d’entrée et sortie.
- D05 Transferts.
- D06 Idempotence.
- D07 Dettes et créances.
- D08 Remboursements.
- D09 Factures.
- D10 Paiements fractionnés.
- D11 Récurrences.
- D12 Tableau de trésorerie.
- D13 Rapports par période et catégorie.
- D14 Tests de cas limites.
- D15 Export financier.

## EPIC E — Infrastructure
- E01 CRUD applications.
- E02 Environnements.
- E03 Domaines.
- E04 Serveurs.
- E05 Services récurrents.
- E06 Relations entre ressources.
- E07 Alertes d’échéance.
- E08 Historique technique.
- E09 Coût par application/projet.
- E10 Tests d’accès.

## EPIC F — Coffre-fort et fichiers
- F01 Choisir stratégie cryptographique.
- F02 Définir gestion et rotation des clés.
- F03 CRUD métadonnées du coffre-fort.
- F04 Chiffrement/déchiffrement.
- F05 Réauthentification et MFA.
- F06 Audit des consultations.
- F07 Stockage documentaire privé.
- F08 Téléchargement à durée limitée.
- F09 Exclusion des secrets des logs.
- F10 Tests de sécurité et récupération.

## EPIC G — Dashboard et UX
- G01 Layout responsive.
- G02 Capture rapide.
- G03 Widgets tâches/projets.
- G04 Widgets finances.
- G05 Widgets infrastructure.
- G06 Activité récente.
- G07 Recherche.
- G08 États vides et erreurs.
- G09 Préférences d’affichage.
- G10 Accessibilité.

## EPIC H — Automatisation et intégrations
- H01 Configurer Redis/BullMQ.
- H02 E-mail sortant.
- H03 Rappels.
- H04 Jobs idempotents.
- H05 Journal d’exécution.
- H06 Intégration Google Calendar.
- H07 OAuth sécurisé.
- H08 Gestion des webhooks.
- H09 Intégration n8n.
- H10 Notifications d’échec.

## EPIC I — IA et SaaS
- I01 Définir politique de données IA.
- I02 Outils IA avec schémas stricts.
- I03 Extraction d’idée.
- I04 Extraction de transaction avec confirmation.
- I05 Résumé hebdomadaire.
- I06 Intégration WhatsApp autorisée.
- I07 Transcription vocale.
- I08 Invitations workspace.
- I09 Abonnements SaaS.
- I10 Quotas et suppression/export de tenant.

---

# 16. Contrat d’API indicatif

Les routes sont des exemples de conventions, à finaliser dans OpenAPI.

## Auth
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/logout`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/forgot-password`
- `POST /api/v1/auth/reset-password`
- `GET /api/v1/users/me`

## Workspaces
- `GET /api/v1/workspaces`
- `POST /api/v1/workspaces`
- `GET /api/v1/workspaces/:workspaceId`
- `PATCH /api/v1/workspaces/:workspaceId`
- `GET /api/v1/workspaces/:workspaceId/members`

## Clients et projets
- `GET/POST /api/v1/clients`
- `GET/PATCH/DELETE /api/v1/clients/:id`
- `GET/POST /api/v1/projects`
- `GET/PATCH/DELETE /api/v1/projects/:id`

## Tâches et idées
- `GET/POST /api/v1/tasks`
- `PATCH /api/v1/tasks/:id`
- `POST /api/v1/tasks/:id/complete`
- `GET/POST /api/v1/ideas`
- `POST /api/v1/ideas/:id/convert-to-project`

## Finances
- `GET/POST /api/v1/finance/accounts`
- `GET/POST /api/v1/finance/transactions`
- `POST /api/v1/finance/transfers`
- `GET/POST /api/v1/finance/debts`
- `POST /api/v1/finance/debts/:id/repayments`
- `GET /api/v1/finance/summary`
- `GET/POST /api/v1/invoices`
- `POST /api/v1/invoices/:id/payments`

## Infrastructure
- `GET/POST /api/v1/applications`
- `GET/POST /api/v1/domains`
- `GET/POST /api/v1/servers`
- `GET/POST /api/v1/service-subscriptions`

## Coffre-fort
- `GET/POST /api/v1/vault/items`
- `POST /api/v1/vault/items/:id/reveal`
- `POST /api/v1/vault/items/:id/rotate`
- `DELETE /api/v1/vault/items/:id`

Les endpoints de révélation/export doivent appliquer une autorisation plus stricte que les endpoints de métadonnées.

## Automatisations
- `GET/POST /api/v1/automations`
- `POST /api/v1/automations/:id/run`
- `GET /api/v1/automations/:id/runs`
- `POST /api/v1/integrations/:provider/connect`
- `POST /api/v1/webhooks/:provider`

Les méthodes et routes de suppression, la pagination et les schémas d’erreur doivent être normalisés dans la spécification OpenAPI.

---

# 17. Décisions à confirmer avant le développement

Les éléments suivants doivent être décidés par le propriétaire du produit et consignés en ADR.

1. Nom final du produit.
2. Monorepo ou dépôts séparés.
3. Stratégie d’authentification : cookies de session ou access/refresh tokens.
4. Fournisseur d’e-mail.
5. Stockage objet retenu.
6. Gestionnaire de clés pour le coffre-fort.
7. Devise par défaut et règles de conversion.
8. Convention des montants : `NUMERIC` ou unités mineures entières.
9. Modèle d’audit et durée de rétention.
10. Fournisseur IA et politique de conservation.
11. Synchronisation Calendar unidirectionnelle ou bidirectionnelle.
12. Fournisseur WhatsApp autorisé.
13. Niveau de prise en charge du mode hors ligne.
14. Objectifs RPO/RTO.
15. Hébergement et localisation des données.
16. Besoins réglementaires pour une future commercialisation.
17. Stratégie de suppression et rétention des données financières.
18. Politique de facturation et fiscalité si le module de factures devient commercial.
19. Stratégie de tests de sécurité externes.
20. Conditions de passage de la V1 au SaaS.

---

# 18. Définition de « terminé » pour la V1

La V1 peut être déclarée utilisable lorsque :

- l’utilisateur peut se connecter de manière sécurisée ;
- un workspace personnel est créé et isolé ;
- les clients, projets, idées, tâches et notes peuvent être gérés ;
- les comptes et transactions financières sont cohérents ;
- les transferts ne sont pas comptés comme revenus/dépenses ;
- les dettes, créances et remboursements partiels fonctionnent ;
- les soldes sont calculés à partir des mouvements validés ;
- les applications, domaines, serveurs et services sont inventoriables ;
- les échéances importantes sont visibles ;
- le dashboard utilise les mêmes règles de calcul que les pages détaillées ;
- la recherche respecte les permissions ;
- les actions sensibles sont auditées ;
- les sauvegardes et la restauration ont été testées ;
- les tests d’isolation inter-workspaces passent ;
- les données sont exportables ;
- la documentation permet à un autre développeur de démarrer le projet ;
- aucun secret réel n’est stocké en clair ou commité ;
- les erreurs et jobs échoués sont observables ;
- la procédure de déploiement et de retour arrière est documentée.

Le coffre-fort ne doit être activé en production qu’après validation spécifique de son architecture cryptographique et de ses tests de sécurité.

---

# 19. Directives finales à l’équipe d’agents IA

1. Commencer par analyser ce cahier des charges et produire un plan d’exécution, pas par générer tout le code en une seule fois.
2. Créer les ADR nécessaires pour les décisions ouvertes.
3. Construire le schéma de données et les règles financières avant les interfaces financières.
4. Découper les tâches par module avec dépendances explicites.
5. Faire travailler les agents en parallèle uniquement sur des périmètres suffisamment indépendants.
6. Désigner un agent responsable de l’intégration, des migrations et de la cohérence inter-modules.
7. Ne pas laisser plusieurs agents modifier simultanément les mêmes fichiers Prisma, migrations ou fichiers de configuration sans coordination.
8. Tout agent doit signaler les hypothèses et les conflits avec la spécification.
9. Les modules finance, auth, multi-tenant et vault nécessitent une revue renforcée.
10. Les tests doivent être exécutés avant la fusion.
11. Les agents ne doivent jamais inventer des résultats de tests ou prétendre qu’un déploiement a réussi sans preuve.
12. Les agents ne doivent pas appeler de services payants ou externes, créer de comptes, envoyer des messages réels ou effectuer des opérations destructives sans autorisation.
13. Les intégrations externes doivent être développées avec mocks et environnements de test avant d’utiliser de vrais comptes.
14. Les changements de schéma sont coordonnés par un responsable.
15. Toute fonctionnalité non couverte par le cahier des charges doit être proposée comme décision, et non ajoutée arbitrairement.

## Première mission recommandée

Demander à l’agent coordinateur de produire, dans cet ordre :

1. `docs/PRODUCT_SPEC.md` à partir du présent cahier des charges.
2. `docs/ARCHITECTURE.md`.
3. `docs/FINANCE_RULES.md` avec exemples chiffrés et cas limites.
4. `docs/DATA_MODEL.md` et un diagramme ERD.
5. `docs/SECURITY.md` et un modèle de menace.
6. Les ADR concernant auth, montants, stockage, coffre-fort et synchronisations.
7. Un backlog de tickets ordonné par dépendances.
8. Un plan de tests.
9. Une proposition de structure du dépôt.
10. Un plan de livraison incrémental pour la V1.

**Ne pas commencer par l’implémentation complète. Valider d’abord les décisions structurantes, le modèle financier et la sécurité.**

---

# Annexe A — Exemple de scénarios métier de bout en bout

## A.1 Paiement d’un client
1. Un client et un projet existent.
2. Une facture est créée et émise.
3. Le client effectue un versement.
4. Une transaction entrante est enregistrée sur le compte approprié.
5. Le versement est lié à la facture.
6. Le solde restant de la facture est recalculé.
7. Le dashboard financier est mis à jour.
8. L’événement est audité.
9. Une éventuelle notification est envoyée de manière asynchrone.
10. Une reprise du même webhook ne crée pas un second paiement.

## A.2 Dépense d’hébergement
1. Un serveur est enregistré.
2. Une échéance de facturation est définie.
3. Le système crée une prévision avant la date de paiement.
4. Lorsque la dépense est réellement payée, une transaction sortante est enregistrée.
5. La transaction est reliée au serveur et éventuellement à une application/projet.
6. Les rapports de trésorerie et de coûts sont mis à jour.
7. La dépense prévue n’est pas comptée une seconde fois.

## A.3 Dette remboursée en plusieurs fois
1. Une dette de 100 000 FCFA est créée.
2. Un premier remboursement de 30 000 FCFA est enregistré et lié à une transaction.
3. Le solde restant est de 70 000 FCFA.
4. Un second remboursement de 70 000 FCFA solde la dette.
5. L’historique des deux opérations est conservé.
6. Les remboursements affectent le solde du compte, mais ne sont pas comptés comme deux nouvelles dépenses opérationnelles sans classification appropriée.

## A.4 Renouvellement de domaine
1. Un domaine possède une date d’expiration.
2. Une règle génère un rappel avant échéance.
3. Le rappel est envoyé une seule fois selon sa politique de déduplication.
4. Après renouvellement, la date d’expiration est mise à jour.
5. Le coût réellement payé est enregistré dans les finances.
6. L’historique du renouvellement est conservé.

## A.5 Capture d’idée par messagerie
1. Un message autorisé est reçu via une intégration.
2. Le webhook est authentifié et dédupliqué.
3. Le texte est interprété pour proposer une idée.
4. Le système présente une prévisualisation si nécessaire.
5. L’idée est créée avec sa source.
6. Le traitement est journalisé sans conserver inutilement le contenu sensible.
7. Une erreur de parsing n’entraîne aucune création partielle incohérente.

## A.6 Tentative d’accès inter-workspaces
1. Un utilisateur du workspace A demande une ressource appartenant au workspace B.
2. Le backend vérifie le contexte et l’autorisation.
3. L’accès est refusé sans divulguer les détails de la ressource.
4. L’événement est journalisé selon la politique de sécurité.
5. Un test automatisé garantit que ce comportement ne régresse pas.

---

# Annexe B — Glossaire

- **Workspace :** espace logique qui regroupe les données et membres.
- **Multi-tenant :** architecture qui héberge plusieurs clients/organisations avec isolation des données.
- **Idempotence :** propriété garantissant que la répétition d’une même opération ne produit pas d’effets supplémentaires indésirables.
- **RPO :** quantité maximale de données que l’on accepte de perdre après incident, exprimée en temps.
- **RTO :** durée cible de rétablissement après incident.
- **KMS :** service de gestion des clés cryptographiques.
- **MFA :** authentification multifacteur.
- **OAuth :** protocole d’autorisation déléguée utilisé par des intégrations.
- **Webhook :** notification HTTP envoyée par un service externe.
- **Outbox :** mécanisme de publication fiable d’événements après transaction de base de données.
- **RLS :** sécurité PostgreSQL au niveau des lignes.
- **Chiffrement authentifié :** chiffrement qui protège la confidentialité et permet de détecter une altération des données.
- **Position nette simplifiée :** trésorerie et créances moins dettes, sans nécessairement représenter le patrimoine complet.
- **Source de vérité :** emplacement de référence où une donnée est maintenue et à partir duquel les autres vues sont dérivées.

---

**Fin du cahier des charges — Version 1.0**
