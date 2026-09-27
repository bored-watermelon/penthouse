/**
 * The annotated "problem statement": a sentence where the joining words stay grey and the parts that carry
 * the meaning are dark, underlined with a hand-drawn bracket and named underneath it.
 *
 *   [STATEMENT]
 *   {Banks and Visa Admins | User} are {responsible for handling merchants' issues. | User Role}
 *   They need {a troubleshooting and support aiding tool | User Need}
 *   [/STATEMENT]
 *
 * The bracket is a drawing in /media/annotations. It is stretched to whatever width the phrase ends up being
 * and painted through a CSS mask rather than drawn as an image, so one drawing serves every phrase and every
 * colour — including a flat PNG, which could not otherwise be recoloured.
 */

const files = import.meta.glob('../../media/annotations/*.{png,PNG,svg,webp}', { query: '?url', import: 'default', eager: true }) as Record<string, string>

const stem = (path: string) => path.split('/').pop()!.replace(/\.[^.]+$/, '')
const entries = Object.entries(files).map(([p, url]) => [stem(p), url] as const)
const pointer = (entries.find(([name]) => /pointer|brace|underline/i.test(name)) ?? entries[0])?.[1] ?? ''

// the four pens the design uses, in the order they appear down the sentence
const COLOURS = ['purple', 'blue', 'orange', 'green'] as const
const KNOWN = new Set<string>([...COLOURS, 'red', 'pink', 'cyan'])

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const BLOCK_RE = /^\[STATEMENT\][ \t]*\r?\n([\s\S]*?)\r?\n[ \t]*\[\/STATEMENT\][ \t]*$/gim
const PART_RE = /\{([^|{}]+?)(?:\s*\|\s*([^|{}]*?))?(?:\s*\|\s*([^|{}]*?))?\s*\}/g

/** One marked phrase: the words, the bracket stretched under them, and its name under that. */
function annotate(phrase: string, label: string, mods: string, index: number) {
  const wanted = mods.trim().toLowerCase()
  const colour = KNOWN.has(wanted) ? wanted : COLOURS[index % COLOURS.length]
  const name = label.trim()
  const tag = name ? `<span class="cs-annot__label">${escapeHtml(name)}</span>` : ''
  return `<span class="cs-annot cs-annot--${colour}"><span class="cs-annot__text">${escapeHtml(phrase.trim())}</span><span class="cs-annot__brace" aria-hidden="true"></span>${tag}</span>`
}

/** Replaces every [STATEMENT] block in the Markdown with its rendered HTML. Runs before Markdown parsing. */
export function renderStatements(body: string) {
  return body.replace(BLOCK_RE, (_m, inner: string) => {
    let n = 0
    const lines = inner
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((line) => {
        let out = ''
        let last = 0
        PART_RE.lastIndex = 0
        for (let m = PART_RE.exec(line); m; m = PART_RE.exec(line)) {
          out += escapeHtml(line.slice(last, m.index)) // the grey joining words between the marked phrases
          out += annotate(m[1], m[2] ?? '', m[3] ?? '', n++)
          last = m.index + m[0].length
        }
        return `<span class="cs-statement__line">${out}${escapeHtml(line.slice(last))}</span>`
      })
    const style = pointer ? ` style="--pointer:url('${pointer}')"` : ''
    return `<div class="cs-statement"${style}>${lines.join('')}</div>`
  })
}
