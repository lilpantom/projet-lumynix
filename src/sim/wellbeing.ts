/**
 * Rule-based well-being check-in (transparent demo; no language model is connected).
 *
 * The "self-reported well-being index" is the mean of answered items rescaled to 0–100. It only
 * summarises what the person chose to share. It is not a diagnosis, a clinical screening tool or a
 * fitness-for-duty decision, and thresholds below only trigger optional, supportive suggestions.
 */

export const QUESTIONS = ['mood', 'stress', 'sleep', 'energy', 'connection'] as const
export type QuestionId = (typeof QUESTIONS)[number]

/** Documented, configurable thresholds for optional support suggestions. */
export const SUPPORT_THRESHOLDS = { suggestBreak: 50, suggestSupport: 30 }

/** Answer values are 0 (hardest) … 4 (best) for every question; UI labels are phrased per question. */
export type Answers = Partial<Record<QuestionId, number | null>>

export function wellbeingIndex(answers: Answers): number | null {
  const values = Object.values(answers).filter((v): v is number => typeof v === 'number')
  if (!values.length) return null
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length / 4) * 100)
}

export type Suggestion = 'breathing' | 'break' | 'relax' | 'trusted' | 'professional' | 'sleep_hygiene'

export function suggestionsFor(answers: Answers, index: number | null): Suggestion[] {
  const out: Suggestion[] = []
  if (index === null) return ['breathing']
  if (index < SUPPORT_THRESHOLDS.suggestBreak) out.push('break', 'relax', 'trusted')
  else out.push('breathing')
  if (typeof answers.sleep === 'number' && answers.sleep <= 1) out.push('sleep_hygiene')
  if (index < SUPPORT_THRESHOLDS.suggestSupport) out.push('professional')
  return out
}

/** Words that suggest an immediate safety concern, in the three supported languages. */
const SAFETY_TERMS = [
  'suicide', 'kill myself', 'end my life', 'hurt myself', 'self-harm', 'want to die', 'no reason to live',
  'suicid', 'me tuer', 'en finir', 'me faire du mal', 'envie de mourir', 'mourir',
  'انتحار', 'أقتل نفسي', 'اقتل نفسي', 'أنهي حياتي', 'أؤذي نفسي', 'اريد ان اموت', 'أريد أن أموت',
]
const DISTRESS_TERMS = [
  'hopeless', 'panic', "can't cope", 'cannot cope', 'overwhelmed', 'desperate',
  'désespéré', 'panique', 'dépassé', "je n'en peux plus", 'épuisé',
  'يائس', 'ذعر', 'لا أستطيع', 'مرهق', 'منهار',
]

export type TextSignal = 'safety' | 'distress' | 'relax' | 'none'

export function classifyText(text: string): TextSignal {
  const t = text.toLowerCase()
  if (SAFETY_TERMS.some((w) => t.includes(w))) return 'safety'
  if (DISTRESS_TERMS.some((w) => t.includes(w))) return 'distress'
  if (/(relax|break|breath|calm|pause|respir|détente|استرخ|راحة|تنفس)/.test(t)) return 'relax'
  return 'none'
}
