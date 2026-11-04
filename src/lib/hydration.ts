/** Le post-traitement HTML peut insérer des espaces entre les métadonnées SSR. */
export function removeHeadWhitespace(document: Document) {
  for (const node of [...document.head.childNodes]) {
    if (node.nodeType === 3 && !node.textContent?.trim()) node.remove()
  }
}
