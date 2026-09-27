/**
 * The annotated "problem statement": a sentence where the joining words stay grey and the parts that carry
 * the meaning are dark, ringed with a hand-drawn loop and labelled with an arrow.
 *
 *   [STATEMENT]
 *   {Banks and Visa Admins | User | left} are {responsible for handling merchants' issues. | User Role}
 *   They need {a troubleshooting and support aiding tool | User Need}
 *   [/STATEMENT]
 *
 * The loops and arrows are SVGs in /media/annotations. They are stretched to whatever width the phrase ends
 * up being, so there is one small set of them rather than one drawing per sentence.
 */

const files = import.meta.glob('../../media/annotations/*.svg', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

const stem = (path: string) => path.split('/').pop()!.replace(/\.svg$/i, '')
const assets = Object.fromEntries(Object.entries(files).map(([p, svg]) => [stem(p), svg]))

/**
 * Makes a drawing usable as an annotation whatever its size: it takes the ink colour from CSS rather than
 * the colour it was exported with, keeps its stroke weight when stretched, and fills the box it is given.
 */
function prepare(svg: string, cls: string) {
  return svg
    .replace(/\s(width|height)="[^"]*"/g, '')
    .replace(/stroke="(?!none)[^"]*"/g, 'stroke="currentColor"')
    .replace(/fill="(?!none)[^"]*"/g, 'fill="currentColor"')
    .replace(/<path /g, '<path vector-effect="non-scaling-stroke" ')
    .replace(/<svg /, `<svg class="${cls}" preserveAspectRatio="none" aria-hidden="true" focusable="false" `)
    .replace(/\s*\n\s*/g, '')
}

const circles = Object.keys(assets).filter((k) => k.startsWith('circle')).sort()
const arrows = Object.keys(assets).filter((k) => k.startsWith('arrow')).sort()

// the four pens the design uses, in the order they appear down the sentence
const COLOURS = ['purple', 'blue', 'orange', 'green'] as const
const KNOWN = new Set([...COLOURS, 'red', 'pink', 'cyan'])

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const BLOCK_RE = /^\[STATEMENT\][ \t]*\r?\n([\s\S]*?)\r?\n[ \t]*\[\/STATEMENT\][ \t]*$/gim
const PART_RE = /\{([^|{}]+?)(?:\s*\|\s*([^|{}]*?))?(?:\s*\|\s*([^|{}]*?))?\s*\}/g

/** One ringed phrase: the words, the loop stretched over them, and the arrow pointing off to its label. */
function annotate(phrase: string, label: string, mods: string, index: number) {
  const tokens = mods.toLowerCase().split(/\s+/).filter(Boolean)
  const colour = tokens.find((t) => KNOWN.has(t as never)) ?? COLOURS[index % COLOURS.length]
  const side = tokens.includes('left') ? 'left' : 'right'
  // a different loop for each phrase, so a sentence doesn't look rubber-stamped
  const circle = circles.length ? prepare(assets[circles[index % circles.length]], 'cs-annot__circle') : ''
  const arrow = arrows.length ? prepare(assets[arrows[index % arrows.length]], 'cs-annot__arrow') : ''
  const tag = label.trim()
    ? `<span class="cs-annot__tag cs-annot__tag--${side}">${arrow}<span class="cs-annot__label">${escapeHtml(label.trim())}</span></span>`
    : ''
  return `<span class="cs-annot cs-annot--${colour}"><span class="cs-annot__text">${escapeHtml(phrase.trim())}</span>${circle}${tag}</span>`
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
          out += escapeHtml(line.slice(last, m.index)) // the grey joining words between the ringed phrases
          out += annotate(m[1], m[2] ?? '', m[3] ?? '', n++)
          last = m.index + m[0].length
        }
        return `<span class="cs-statement__line">${out}${escapeHtml(line.slice(last))}</span>`
      })
    return `<div class="cs-statement">${lines.join('')}</div>`
  })
}
