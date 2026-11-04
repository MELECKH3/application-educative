// Nettoyage de la dictée vocale (oral) : supprime les répétitions produites par la reconnaissance
// vocale du navigateur avant d'afficher et d'envoyer la réponse de l'élève.

/** Forme de comparaison : minuscules, sans ponctuation ni espaces multiples. */
const key = (s: string) =>
  s
    .toLowerCase()
    .replace(/[\p{P}\p{S}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()

/**
 * Fusionne les résultats de la reconnaissance vocale.
 * Sur Android, chaque résultat reprend souvent tout le début de la phrase (« je », « je suis », « je suis Awa ») :
 * on garde alors la version la plus complète au lieu de tout coller bout à bout.
 */
export function mergeResults(transcripts: readonly string[]): string {
  let acc = ''
  for (const raw of transcripts) {
    const t = raw.trim()
    if (!t) continue
    const ka = key(acc)
    const kt = key(t)
    if (!ka || kt.startsWith(ka)) acc = t
    else if (ka.endsWith(kt) || ka.startsWith(kt)) continue
    else acc = `${acc} ${t}`
  }
  return cleanTranscript(acc)
}

/** Écritures sans espaces entre les mots (chinois, japonais). */
const CJK_REPEAT = /([぀-ヿ㐀-鿿]{2,}?)\1+/gu

/**
 * Supprime les répétitions consécutives d'un mot ou d'un groupe de mots
 * (« I I like like football » → « I like football », « my name is my name is Awa » → « my name is Awa »).
 */
export function cleanTranscript(text: string): string {
  const words = text.replace(/\s+/g, ' ').trim().replace(CJK_REPEAT, '$1').split(' ').filter(Boolean)
  const keys = words.map(key)
  let changed = true
  while (changed) {
    changed = false
    for (let n = Math.min(8, Math.floor(words.length / 2)); n >= 1 && !changed; n--) {
      for (let i = 0; i + 2 * n <= words.length; i++) {
        let same = true
        for (let j = 0; j < n && same; j++) same = !!keys[i + j] && keys[i + j] === keys[i + n + j]
        if (same) {
          // On garde la seconde copie si elle porte la ponctuation de fin.
          words.splice(i, n)
          keys.splice(i, n)
          changed = true
          break
        }
      }
    }
  }
  return words.join(' ')
}
