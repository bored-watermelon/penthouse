/**
 * An "[ITERATIONS]" block: two or more versions of the same screen shown next to each other, each with its
 * own picture, a note on what it tried, and whether it survived review.
 *
 *   [ITERATIONS: The Order Receipt | horizontal]
 *
 *   [ITERATION: Iteration 1 | rejected | receipt-v1.png]
 *   An animated receipt, with an illustrated map to the pickup counter.
 *
 *   [ITERATION: Iteration 2 | accepted | receipt-v2.png]
 *   An in-chat receipt, the way the real app does it.
 *
 *   [/ITERATIONS]
 */

export type Media = { src: string; kind: 'image' | 'video' } | null

// the two verdicts that get a colour of their own; anything else is written up in plain grey
const VERDICTS: Record<string, string> = {
  rejected: 'rejected',
  dropped: 'rejected',
  accepted: 'accepted',
  approved: 'accepted',
  shipped: 'accepted',
}

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const escapeAttr = (s: string) => escapeHtml(s).replace(/"/g, '&quot;')

const BLOCK_RE = /^\[ITERATIONS:?[ \t]*([^|\]]*?)[ \t]*(?:\|[ \t]*([^\]]*?))?[ \t]*\][ \t]*\r?\n([\s\S]*?)\r?\n[ \t]*\[\/ITERATIONS\][ \t]*$/gim
const ITEM_RE = /^\[ITERATION:?[ \t]*([^|\]]*?)[ \t]*(?:\|[ \t]*([^|\]]*?))?[ \t]*(?:\|[ \t]*([^\]]*?))?[ \t]*\][ \t]*$/i

/** Splits the block's body into one entry per "[ITERATION: …]" line, the lines under it being its caption. */
function readItems(body: string) {
  const items: { label: string; status: string; file: string; caption: string[] }[] = []
  for (const line of body.split(/\r?\n/)) {
    const m = line.trim().match(ITEM_RE)
    if (m) items.push({ label: m[1]?.trim() ?? '', status: m[2]?.trim() ?? '', file: m[3]?.trim() ?? '', caption: [] })
    else if (items.length && line.trim()) items[items.length - 1].caption.push(line.trim())
  }
  return items
}

function card(item: { label: string; status: string; file: string; caption: string[] }, media: (name: string) => Media) {
  const found = item.file ? media(item.file) : null
  const shot = found
    ? found.kind === 'image'
      ? `<img src="${found.src}" alt="${escapeAttr(item.label)}" loading="lazy" />`
      : `<video src="${found.src}" controls playsInline preload="metadata"></video>`
    : item.file
      ? `<div class="cs-iter__missing">missing: ${escapeHtml(item.file)}</div>`
      : ''
  const verdict = VERDICTS[item.status.toLowerCase()] ?? 'other'
  const parts = [
    item.label ? `<p class="cs-iter__label">${escapeHtml(item.label)}</p>` : '',
    item.caption.length ? `<p class="cs-iter__caption">${escapeHtml(item.caption.join(' '))}</p>` : '',
    item.status ? `<p class="cs-iter__status cs-iter__status--${verdict}">${escapeHtml(item.status)}</p>` : '',
  ].join('')
  return `<article class="cs-iter">${shot ? `<div class="cs-iter__shot">${shot}</div>` : ''}<div class="cs-iter__body">${parts}</div></article>`
}

/** Replaces every [ITERATIONS] block with its rendered HTML. Runs before Markdown parsing. */
export function renderIterations(body: string, media: (name: string) => Media) {
  return body.replace(BLOCK_RE, (_m, heading: string, opts = '', inner: string) => {
    const items = readItems(inner)
    if (!items.length) return ''
    const vertical = /vertical|stack/i.test(opts)
    const head = heading.trim() ? `<h4 class="cs-iters__head">${escapeHtml(heading.trim())}</h4>` : ''
    const grid = `<div class="cs-iters__grid" style="--cols:${vertical ? 1 : items.length}">${items.map((i) => card(i, media)).join('')}</div>`
    return `<section class="cs-iters cs-iters--${vertical ? 'vertical' : 'horizontal'}">${head}${grid}</section>`
  })
}
