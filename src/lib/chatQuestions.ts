// The questions in the hero's chat, from "control center/chat questions.md" (see the note at the top of that file):
//   > the message the questions come with
//   ## a question, as it shows on its button
//   its answer: each paragraph sent as a message of its own
import source from '../../control center/chat questions.md?raw'

export type Question = { question: string; answer: string[] }

const text = source.replace(/<!--[\s\S]*?-->/g, '')

/** The message the buttons come under. */
export const prompt = text.match(/^>\s*(.+)$/m)?.[1].trim() || 'got a question? pick one 👇'

export const questions: Question[] = text
  .split(/^##\s+/m)
  .slice(1)
  .map((part) => {
    const [first, ...rest] = part.split('\n')
    const answer = rest
      .join('\n')
      .split(/\n\s*\n/)
      .map((p) => p.replace(/\s*\n\s*/g, ' ').trim())
      .filter(Boolean)
    return { question: first.trim(), answer }
  })
  .filter((q) => q.question && q.answer.length)
