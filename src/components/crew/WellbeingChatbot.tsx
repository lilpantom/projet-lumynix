import { Bot, HeartHandshake, Send } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { usePrefs } from '../../context/PreferencesContext'
import type { TranslationKey } from '../../i18n'
import { classifyText, QUESTIONS, suggestionsFor, SUPPORT_THRESHOLDS, wellbeingIndex, type Answers, type QuestionId, type TextSignal } from '../../sim/wellbeing'
import { useCrew } from '../../store/crewStore'

type Msg = { from: 'bot'; key: TranslationKey; params?: Record<string, string | number> } | { from: 'me'; text: string } | { from: 'me'; key: TranslationKey }
type Stage = { kind: 'intro' } | { kind: 'q'; i: number } | { kind: 'free' } | { kind: 'summary' } | { kind: 'stopped' }

/**
 * Transparent rule-based check-in. Every reply comes from a fixed script in the translation files;
 * answers stay in memory and are never sent anywhere or shown to anyone else.
 */
export function WellbeingChatbot() {
  const { t, num } = usePrefs()
  const { lastResult, saveResult, dismissResult, setRelax } = useCrew()
  const [stage, setStage] = useState<Stage>({ kind: 'intro' })
  const [answers, setAnswers] = useState<Answers>({})
  const [flag, setFlag] = useState<TextSignal | null>(null)
  const [msgs, setMsgs] = useState<Msg[]>([
    { from: 'bot', key: 'chat.intro' },
    { from: 'bot', key: 'chat.startQ' },
  ])
  const [text, setText] = useState('')
  const log = useRef<HTMLDivElement>(null)

  useEffect(() => {
    log.current?.scrollTo?.({ top: log.current.scrollHeight })
  }, [msgs, stage])

  const say = (...m: Msg[]) => setMsgs((x) => [...x, ...m])
  const ask = (i: number) => {
    setStage({ kind: 'q', i })
    say({ from: 'bot', key: `chat.q.${QUESTIONS[i]}` as TranslationKey })
  }
  const next = (i: number) => {
    if (i + 1 < QUESTIONS.length) ask(i + 1)
    else {
      setStage({ kind: 'free' })
      say({ from: 'bot', key: 'chat.free' })
    }
  }

  const finish = (a: Answers, f: TextSignal | null) => {
    const index = wellbeingIndex(a)
    setStage({ kind: 'summary' })
    saveResult({ at: Date.now(), answers: a, index, flagged: f === 'safety' || f === 'distress' ? f : null })
  }

  const answer = (q: QuestionId, i: number, value: number | null) => {
    const a = { ...answers, [q]: value }
    setAnswers(a)
    say(value === null ? { from: 'me', key: 'chat.skip' } : { from: 'me', key: `chat.a.${q}.${value}` as TranslationKey })
    next(i)
  }

  const react = (signal: TextSignal) => {
    if (signal === 'safety') say({ from: 'bot', key: 'chat.safety' })
    else if (signal === 'distress') say({ from: 'bot', key: 'chat.distress' })
    else if (signal === 'relax') say({ from: 'bot', key: 'chat.relaxOffer' })
    else say({ from: 'bot', key: 'chat.ack' })
    if (signal === 'safety' || (signal === 'distress' && flag !== 'safety')) setFlag(signal)
  }

  const submitText = (e: FormEvent) => {
    e.preventDefault()
    const value = text.trim()
    if (!value) return
    setText('')
    say({ from: 'me', text: value })
    const signal = classifyText(value)
    react(signal)
    const f = signal === 'safety' ? 'safety' : flag ?? (signal === 'distress' ? 'distress' : null)
    if (stage.kind === 'free') finish(answers, f)
  }

  const restart = () => {
    setAnswers({})
    setFlag(null)
    setMsgs([{ from: 'bot', key: 'chat.intro' }])
    ask(0)
  }

  const result = stage.kind === 'summary' ? lastResult : null
  const suggestions = result ? suggestionsFor(result.answers, result.index) : []

  return (
    <div className="chatbot">
      <header className="chat-head">
        <Bot size={18} aria-hidden />
        <div>
          <strong>{t('chat.title')}</strong>
          <small className="muted">{t('chat.rule')}</small>
        </div>
      </header>
      <div className="chat-log" ref={log} role="log" aria-live="polite">
        {msgs.map((m, i) => (
          <p key={i} className={`bubble ${m.from}`}>
            {'text' in m ? m.text : t(m.key, 'params' in m ? m.params : undefined)}
          </p>
        ))}
        {result && (
          <div className="bubble bot bubble-summary">
            <p>{t('chat.summary')}</p>
            {Object.values(result.answers).every((v) => v === null || v === undefined) ? (
              <p>{t('chat.summarySkipped')}</p>
            ) : (
              <ul className="bullets">
                {QUESTIONS.filter((q) => typeof result.answers[q] === 'number').map((q) => (
                  <li key={q}>
                    {t(`chat.q.${q}` as TranslationKey)} — <strong>{t(`chat.a.${q}.${result.answers[q]}` as TranslationKey)}</strong>
                  </li>
                ))}
              </ul>
            )}
            {result.index !== null && (
              <>
                <p>
                  <strong>{t('chat.index', { n: num(result.index) })}</strong> <span className="muted">({t('chat.notDiagnosis')})</span>
                </p>
                <p className="muted small">{t('chat.indexExplain')}</p>
              </>
            )}
            {(result.flagged === 'distress' || (result.index !== null && result.index < SUPPORT_THRESHOLDS.suggestSupport)) && result.flagged !== 'safety' && <p className="support-note">{t('chat.distress')}</p>}
            {result.flagged === 'safety' && <p className="support-note urgent">{t('chat.safety')}</p>}
            <p>{t('chat.suggestions')}</p>
            <ul className="bullets">
              {suggestions.map((s) => (
                <li key={s}>{t(`chat.s.${s}` as TranslationKey)}</li>
              ))}
            </ul>
            <p className="muted small">{t('chat.done')}</p>
          </div>
        )}
      </div>

      <div className="chat-actions">
        {stage.kind === 'intro' && (
          <>
            <button className="btn primary" onClick={() => (say({ from: 'me', key: 'chat.start' }), ask(0))}>
              {t('chat.start')}
            </button>
            <button className="btn" onClick={() => (say({ from: 'me', key: 'chat.notNow' }, { from: 'bot', key: 'chat.stopped' }), setStage({ kind: 'stopped' }))}>
              {t('chat.notNow')}
            </button>
          </>
        )}
        {stage.kind === 'q' && (
          <div className="quick-replies" role="group" aria-label={t(`chat.q.${QUESTIONS[stage.i]}` as TranslationKey)}>
            {[4, 3, 2, 1, 0].map((v) => (
              <button key={v} className="chip" onClick={() => answer(QUESTIONS[stage.i], stage.i, v)}>
                {t(`chat.a.${QUESTIONS[stage.i]}.${v}` as TranslationKey)}
              </button>
            ))}
            <button className="chip ghost" onClick={() => answer(QUESTIONS[stage.i], stage.i, null)}>
              {t('chat.skip')}
            </button>
          </div>
        )}
        {stage.kind === 'free' && (
          <button className="chip ghost" onClick={() => (say({ from: 'me', key: 'chat.skip' }), finish(answers, flag))}>
            {t('chat.skip')}
          </button>
        )}
        {(stage.kind === 'intro' || stage.kind === 'stopped') && lastResult && (
          <button className="btn" onClick={() => setStage({ kind: 'summary' })}>
            {t('chat.viewLast')}
          </button>
        )}
        {(stage.kind === 'summary' || stage.kind === 'stopped') && (
          <>
            <button className="btn" onClick={restart}>
              {t('chat.repeat')}
            </button>
            {stage.kind === 'summary' && (
              <button
                className="btn"
                onClick={() => {
                  dismissResult()
                  setStage({ kind: 'stopped' })
                }}
              >
                {t('chat.dismiss')}
              </button>
            )}
          </>
        )}
        {(msgs.some((m) => m.from === 'bot' && m.key === 'chat.relaxOffer') || suggestions.includes('relax') || suggestions.includes('breathing')) && (
          <button className="btn" onClick={() => setRelax(true)}>
            <HeartHandshake size={15} aria-hidden /> {t('chat.openRelax')}
          </button>
        )}
      </div>

      <form className="chat-input" onSubmit={submitText}>
        <label htmlFor="chat-text" className="sr-only">
          {t('chat.placeholder')}
        </label>
        <input id="chat-text" value={text} onChange={(e) => setText(e.target.value)} placeholder={t('chat.placeholder')} maxLength={500} autoComplete="off" />
        <button className="icon-btn" aria-label={t('chat.send')} disabled={!text.trim()}>
          <Send size={16} className="flip-rtl" />
        </button>
      </form>
    </div>
  )
}
