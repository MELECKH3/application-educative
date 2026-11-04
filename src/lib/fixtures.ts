// DONNÉES D'APERÇU — module unique à remplacer par la base de données (voir PLAN.md, jalon 2+).
// Tous les sujets et leçons ci-dessous sont des contenus d'entraînement rédigés pour l'aperçu :
// ils portent le badge EXEMPLE et ne prétendent à aucune source ni année officielle.

export type Student = {
  firstName: string
  classe: string
  serie?: string
  pays: string
  langues: string[]
  niveauPrefere: 1 | 2 | 3 | 4
  /** Jour courant de la période Bienvenue VIP (1 à 7), ou null si terminée. */
  vipDay: number | null
  freeMinutesUsedToday: number
  plan: 'vip' | 'gratuit' | 'mensuel' | 'trimestriel'
  lastLesson?: { title: string; matiere: string }
}

export const demoStudent: Student = {
  firstName: 'Awa',
  classe: 'Terminale',
  serie: 'D',
  pays: "Côte d'Ivoire",
  langues: ['Anglais', 'Espagnol'],
  niveauPrefere: 2,
  vipDay: 3,
  freeMinutesUsedToday: 0,
  plan: 'vip',
  lastLesson: { title: 'Dérivée d’une fonction', matiere: 'Mathématiques' },
}

export type Matiere = { id: string; nom: string; emoji: string }

export const matieresTermD: Matiere[] = [
  { id: 'maths', nom: 'Mathématiques', emoji: '📐' },
  { id: 'pc', nom: 'Physique-Chimie', emoji: '⚗️' },
  { id: 'svt', nom: 'SVT', emoji: '🌿' },
  { id: 'francais', nom: 'Français', emoji: '📖' },
  { id: 'philo', nom: 'Philosophie', emoji: '💭' },
  { id: 'anglais', nom: 'Anglais', emoji: '🇬🇧' },
  { id: 'hg', nom: 'Histoire-Géo', emoji: '🗺️' },
  { id: 'espagnol', nom: 'Espagnol', emoji: '🇪🇸' },
]

export type Sujet = {
  id: string
  titre: string
  classe: string
  serie?: string
  matiere: string
  chapitre: string
  niveau: 1 | 2 | 3 | 4
  dureeMin: number
  enonce: string
  bareme: string
  exemple: true
}

export const sujets: Sujet[] = [
  {
    id: 'maths-derivee-cacao',
    titre: 'Étude d’une fonction de production de cacao',
    classe: 'Terminale',
    serie: 'D',
    matiere: 'maths',
    chapitre: 'Dérivation et variations',
    niveau: 2,
    dureeMin: 60,
    enonce:
      'Une coopérative de Soubré modélise sa production (en tonnes) par f(x) = −x² + 8x + 5, où x est le nombre de mois depuis le début de la campagne (0 ≤ x ≤ 8).\n\n1. Calcule f′(x).\n2. Étudie le signe de f′(x) et dresse le tableau de variations de f.\n3. En quel mois la production est-elle maximale ? Quelle est cette production ?\n4. Détermine l’équation de la tangente à la courbe de f au point d’abscisse 2.',
    bareme: '1) 3 pts · 2) 6 pts · 3) 5 pts · 4) 6 pts',
    exemple: true,
  },
  {
    id: 'maths-suites-epargne',
    titre: 'Suites géométriques et tontine',
    classe: 'Terminale',
    serie: 'D',
    matiere: 'maths',
    chapitre: 'Suites numériques',
    niveau: 1,
    dureeMin: 45,
    enonce:
      'Koffi dépose 10 000 FCFA dans une tontine. Chaque mois, le montant déposé augmente de 5 %.\n\n1. Note u₀ = 10 000. Exprime u₁ et u₂.\n2. Montre que (uₙ) est géométrique et précise sa raison.\n3. Exprime uₙ en fonction de n.\n4. Calcule la somme totale versée après 12 mois.',
    bareme: '1) 4 pts · 2) 5 pts · 3) 5 pts · 4) 6 pts',
    exemple: true,
  },
  {
    id: 'maths-complexes-olympiade',
    titre: 'Nombres complexes et rotations',
    classe: 'Terminale',
    serie: 'D',
    matiere: 'maths',
    chapitre: 'Nombres complexes',
    niveau: 4,
    dureeMin: 120,
    enonce:
      'Soit ω = e^{2iπ/7}. On pose S = ω + ω² + ω⁴ et T = ω³ + ω⁵ + ω⁶.\n\n1. Montre que S + T = −1.\n2. Calcule S·T.\n3. En déduire S et T, puis la valeur exacte de cos(2π/7) + cos(4π/7) + cos(8π/7).',
    bareme: '1) 5 pts · 2) 8 pts · 3) 7 pts',
    exemple: true,
  },
  {
    id: 'pc-circuit-rc',
    titre: 'Charge d’un condensateur dans un circuit RC',
    classe: 'Terminale',
    serie: 'D',
    matiere: 'pc',
    chapitre: 'Dipôle RC',
    niveau: 2,
    dureeMin: 60,
    enonce:
      'On charge un condensateur de capacité C = 100 µF à travers une résistance R = 1 kΩ sous une tension E = 12 V.\n\n1. Établis l’équation différentielle vérifiée par u_C(t).\n2. Vérifie que u_C(t) = E(1 − e^{−t/τ}) est solution et exprime τ.\n3. Calcule τ et la tension à t = τ.',
    bareme: '1) 6 pts · 2) 8 pts · 3) 6 pts',
    exemple: true,
  },
  {
    id: 'pc-acide-base',
    titre: 'Dosage acido-basique du vinaigre',
    classe: 'Terminale',
    serie: 'D',
    matiere: 'pc',
    chapitre: 'Réactions acide-base',
    niveau: 3,
    dureeMin: 90,
    enonce:
      'On dose 10 mL de vinaigre dilué dix fois par une solution de soude à 0,1 mol/L. L’équivalence est obtenue pour 12 mL.\n\n1. Écris l’équation de la réaction de dosage.\n2. Calcule la concentration de l’acide dans la solution diluée puis dans le vinaigre.\n3. Discute du choix de l’indicateur coloré.',
    bareme: '1) 4 pts · 2) 10 pts · 3) 6 pts',
    exemple: true,
  },
  {
    id: 'svt-genetique',
    titre: 'Transmission d’un caractère chez le maïs',
    classe: 'Terminale',
    serie: 'D',
    matiere: 'svt',
    chapitre: 'Génétique',
    niveau: 2,
    dureeMin: 60,
    enonce:
      'On croise deux lignées pures de maïs : grains jaunes lisses × grains blancs ridés. La F1 est homogène : grains jaunes lisses.\n\n1. Que peux-tu conclure sur la dominance ?\n2. Écris les génotypes des parents et de la F1.\n3. Prévois les résultats d’un test-cross si les gènes sont indépendants.',
    bareme: '1) 4 pts · 2) 6 pts · 3) 10 pts',
    exemple: true,
  },
  {
    id: 'francais-dissertation',
    titre: 'Dissertation : la littérature et l’engagement',
    classe: 'Terminale',
    serie: 'D',
    matiere: 'francais',
    chapitre: 'Dissertation littéraire',
    niveau: 2,
    dureeMin: 180,
    enonce:
      '« L’écrivain doit-il prendre parti ? » Tu répondras à cette question dans un développement argumenté, en t’appuyant sur les œuvres africaines et françaises étudiées en classe.',
    bareme: 'Introduction 4 pts · Développement 12 pts · Conclusion 2 pts · Langue 2 pts',
    exemple: true,
  },
  {
    id: 'philo-bonheur',
    titre: 'Le bonheur dépend-il de nous ?',
    classe: 'Terminale',
    serie: 'D',
    matiere: 'philo',
    chapitre: 'Le bonheur',
    niveau: 2,
    dureeMin: 240,
    enonce: 'Sujet de dissertation : « Le bonheur dépend-il de nous ? »',
    bareme: 'Problématique 5 pts · Argumentation 10 pts · Culture 3 pts · Expression 2 pts',
    exemple: true,
  },
  {
    id: 'anglais-tech',
    titre: 'Reading comprehension: Mobile money in Africa',
    classe: 'Terminale',
    serie: 'D',
    matiere: 'anglais',
    chapitre: 'Science and technology',
    niveau: 1,
    dureeMin: 60,
    enonce:
      'Read the text about mobile money in West Africa and answer the questions.\n\n1. True or false? Justify with a sentence from the text.\n2. Find synonyms in the text.\n3. Essay (120 words): How has mobile money changed life in your town?',
    bareme: '1) 6 pts · 2) 4 pts · 3) 10 pts',
    exemple: true,
  },
  {
    id: 'hg-independances',
    titre: 'Les indépendances africaines',
    classe: 'Terminale',
    serie: 'D',
    matiere: 'hg',
    chapitre: 'La décolonisation',
    niveau: 3,
    dureeMin: 120,
    enonce:
      'Commentaire de document : à partir d’un extrait de discours fictif d’un dirigeant africain en 1960 (fourni en classe), présente le contexte, analyse les idées principales et dégage la portée du document.',
    bareme: 'Présentation 4 pts · Analyse 10 pts · Portée 6 pts',
    exemple: true,
  },
  {
    id: 'espagnol-medios',
    titre: 'Comprensión: Las redes sociales y los jóvenes',
    classe: 'Terminale',
    serie: 'D',
    matiere: 'espagnol',
    chapitre: 'Medios de comunicación',
    niveau: 2,
    dureeMin: 60,
    enonce:
      'Lee el texto y contesta.\n\n1. ¿Cuál es la idea principal?\n2. Explica la frase subrayada.\n3. Expresión personal (100 palabras): ¿Qué lugar ocupan las redes sociales en tu vida?',
    bareme: '1) 5 pts · 2) 5 pts · 3) 10 pts',
    exemple: true,
  },
]

export type LessonStep = {
  key: 'intuition' | 'memo' | 'exemple' | 'pieges'
  titre: string
  contenu: string[]
}

export type Lecon = {
  id: string
  matiere: string
  chapitre: string
  titre: string
  etapes: LessonStep[]
  reformulations: Record<LessonStep['key'], string>
  sujetIds: string[]
}

export const lecons: Lecon[] = [
  {
    id: 'derivee',
    matiere: 'maths',
    chapitre: 'Dérivation et variations',
    titre: 'Dérivée d’une fonction',
    sujetIds: ['maths-derivee-cacao'],
    etapes: [
      {
        key: 'intuition',
        titre: 'Intuition',
        contenu: [
          'Imagine un gbaka qui roule d’Adjamé à Yopougon. Son compteur indique sa vitesse à chaque instant : c’est exactement ce que mesure une dérivée.',
          'La distance parcourue est une fonction du temps. La dérivée te dit à quelle vitesse cette distance change, à un instant précis.',
          'Si la dérivée est positive, la fonction monte ; négative, elle descend ; nulle, elle est à un sommet ou au fond d’un creux.',
        ],
      },
      {
        key: 'memo',
        titre: 'Mémo / formules',
        contenu: [
          '(xⁿ)′ = n·xⁿ⁻¹',
          '(u + v)′ = u′ + v′   ·   (k·u)′ = k·u′',
          '(u·v)′ = u′v + uv′   ·   (u/v)′ = (u′v − uv′)/v²',
          'Tangente en a : y = f′(a)(x − a) + f(a)',
          'f′ > 0 ⇒ f croissante · f′ < 0 ⇒ f décroissante',
        ],
      },
      {
        key: 'exemple',
        titre: 'Exemple résolu',
        contenu: [
          'Énoncé : f(x) = x² − 4x + 1. Étudie les variations de f.',
          'Étape 1 — Dérivée : f′(x) = 2x − 4.',
          'Étape 2 — Signe : 2x − 4 > 0 ⇔ x > 2.',
          'Étape 3 — Conclusion : f est décroissante sur ]−∞ ; 2] et croissante sur [2 ; +∞[.',
          'Étape 4 — Minimum : f(2) = 4 − 8 + 1 = −3.',
        ],
      },
      {
        key: 'pieges',
        titre: 'Pièges fréquents',
        contenu: [
          '1. Oublier de dériver la constante : (x² + 5)′ = 2x, pas 2x + 5.',
          '2. Confondre f(a) et f′(a) dans l’équation de la tangente.',
          '3. Conclure sur les variations sans avoir étudié le signe de f′ sur tout l’intervalle.',
        ],
      },
    ],
    reformulations: {
      intuition:
        'Plus simple : la dérivée, c’est « à quelle vitesse ça change ». Comme le prix du cacao qui monte vite ou lentement.',
      memo: 'Retiens surtout : on descend la puissance devant, et on enlève 1 à la puissance. x³ devient 3x².',
      exemple:
        'On dérive, on regarde quand la dérivée est positive, et on en déduit si la courbe monte ou descend.',
      pieges:
        'Vérifie toujours : as-tu dérivé chaque morceau ? As-tu utilisé f(a) ET f′(a) ? As-tu fait le tableau de signes ?',
    },
  },
]

export const leconsParMatiere: Record<string, { chapitre: string; lecons: string[] }[]> = {
  maths: [
    { chapitre: 'Dérivation et variations', lecons: ['Dérivée d’une fonction'] },
    { chapitre: 'Suites numériques', lecons: ['Suites arithmétiques et géométriques'] },
    { chapitre: 'Nombres complexes', lecons: ['Forme algébrique et trigonométrique'] },
  ],
  pc: [
    { chapitre: 'Dipôle RC', lecons: ['Charge et décharge d’un condensateur'] },
    { chapitre: 'Réactions acide-base', lecons: ['pH et dosages'] },
  ],
  svt: [{ chapitre: 'Génétique', lecons: ['Brassage des allèles'] }],
  francais: [{ chapitre: 'Dissertation littéraire', lecons: ['Construire un plan dialectique'] }],
}

export type ChatMessage = { role: 'eleve' | 'tuteur'; text: string }

export const tutorWelcome: ChatMessage[] = [
  {
    role: 'tuteur',
    text: 'Bonjour ! Je suis ton tuteur Annales+. Sur quoi veux-tu travailler aujourd’hui ? Choisis un mode ci-dessus ou pose-moi ta question.',
  },
]

/** Réponse type du tuteur pour l'aperçu (remplacée par l'IA réelle au jalon 6). */
export function previewTutorReply(mode: string, question: string): string {
  const q = question.trim()
  switch (mode) {
    case 'Quiz':
      return 'On fait un quiz ! Question 1 : quelle est la dérivée de x³ ? Prends ton temps, puis écris ta réponse.'
    case 'Pas à pas':
      return `D’accord, on avance étape par étape sur « ${q} ». Première étape : qu’est-ce que l’énoncé te demande exactement ? Reformule-le avec tes mots.`
    case 'Corriger ma réponse':
      return 'Envoie-moi ta réponse (texte ou photo de ta copie). Je te dirai ce qui est juste, puis je te donnerai un indice pour corriger le reste.'
    case 'Exercice similaire':
      return 'Voici un exercice du même type : étudie les variations de g(x) = −2x² + 6x − 1. Commence par calculer g′(x). Qu’obtiens-tu ?'
    case 'Résumé de cours':
      return 'Avant que je te fasse le résumé, essaie : quelles sont, selon toi, les deux idées les plus importantes de ce chapitre ?'
    case 'Discussion libre':
      return 'Je t’écoute ! Dis-moi ce qui te pose problème en ce moment dans tes cours.'
    default:
      return `Bonne question ! Avant de t’expliquer « ${q} », dis-moi : qu’est-ce que tu sais déjà sur ce sujet ? Je vais te guider avec un premier indice ensuite.`
  }
}
