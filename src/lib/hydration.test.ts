import { expect, it } from 'vitest'
import { removeHeadWhitespace } from './hydration'

it('retire les espaces ajoutés entre les métadonnées sans modifier le contenu', () => {
  const page = document.implementation.createHTMLDocument('Annales+')
  page.head.innerHTML =
    '\n<meta charset="utf-8">\n<!-- hébergement -->\n<title>Annales+ — Révisions</title>\n<script> const label = "deux mots"; </script>\n'
  page.body.innerHTML = '<p>Révise avec Annales+.</p> <p>Ton profil</p>'
  const body = page.body.innerHTML
  removeHeadWhitespace(page)
  expect(
    [...page.head.childNodes].filter((node) => node.nodeType === 3),
  ).toHaveLength(0)
  expect(page.title).toBe('Annales+ — Révisions')
  expect(page.head.querySelector('script')?.textContent).toBe(
    ' const label = "deux mots"; ',
  )
  expect(page.head.innerHTML).toContain('<!-- hébergement -->')
  expect(page.body.innerHTML).toBe(body)
})

it('ne supprime aucun élément et peut être appelé plusieurs fois', () => {
  const page = document.implementation.createHTMLDocument('Annales+')
  removeHeadWhitespace(page)
  const head = page.head.innerHTML
  removeHeadWhitespace(page)
  expect(page.head.innerHTML).toBe(head)
})
