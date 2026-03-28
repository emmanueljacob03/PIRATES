'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { buildAchievementNarration, type AchievementTopic } from '@/lib/achievements-script';
// (Awards/stats block removed per latest UI request)

/** How the image is cropped in full-screen frame */
type PhotoFraming = 'human' | 'trophy' | 'scene' | 'clubHero';

type TopicImage = {
  src: string;
  alt: string;
  framing: PhotoFraming;
  /** CSS object-position, e.g. center 22% — keeps group visible above bottom gradient */
  objectPosition?: string;
  /** Animate slide-up into frame (e.g. pirates2) */
  slideUp?: boolean;
  /** Clip this % off the top of the image (0–50), e.g. 30 = hide top 30% */
  clipTopPercent?: number;
  /** After clip, stretch the visible band to full viewport height (avoids empty bottom) */
  clipStretchToFullHeight?: boolean;
};

/**
 * One image set per narration topic — no file is reused across topics.
 * Team photos pirates1/pirates2 only on intro + club (early welcome); sampreeth/anil/abhinav/outing each have their own lists (ram: no slides).
 */
const TOPIC_BACKGROUNDS: Record<AchievementTopic, TopicImage[]> = {
  intro: [
    { src: '/achievements/pirates1.png', alt: 'Pirates team', framing: 'scene', objectPosition: 'center 28%' },
  ],
  club: [
    {
      src: '/achievements/pirates2.png',
      alt: 'Pirates team',
      framing: 'clubHero',
      /** Anchor to top after top crop + shift wrapper fills screen */
      objectPosition: 'center top',
      clipTopPercent: 30,
      clipStretchToFullHeight: true,
      slideUp: true,
    },
  ],
  ram: [],
  sampreeth: [
    { src: '/achievements/sampreeth1.png', alt: 'Sampreeth', framing: 'human' },
    { src: '/achievements/sampreeth2.png', alt: 'Sampreeth', framing: 'human' },
    { src: '/achievements/sampreeth-trophy.png', alt: 'Trophy', framing: 'trophy' },
  ],
  anil: [
    { src: '/achievements/anil1.png', alt: 'Anil', framing: 'human' },
    { src: '/achievements/anil2.png', alt: 'Anil', framing: 'human' },
    { src: '/achievements/anil-trophy.png', alt: 'Trophy', framing: 'trophy' },
  ],
  abhinav: [
    { src: '/achievements/abhinav1.png', alt: 'Abhinav', framing: 'human' },
    { src: '/achievements/abhinav2.png', alt: 'Abhinav', framing: 'human' },
    { src: '/achievements/abhinav-trophy.png', alt: 'Trophy', framing: 'trophy' },
  ],
  outing: [
    { src: '/achievements/outing1.png', alt: 'Team outing', framing: 'scene', objectPosition: 'center 30%' },
    { src: '/achievements/outing2.png', alt: 'Team outing', framing: 'scene', objectPosition: 'center 30%' },
  ],
  outro: [],
};

/** Single full-screen background for the whole welcome flow (team lineup art). */
const STATIC_ACHIEVEMENTS_BG = '/achievements/pirates-team-lineup-bg.png';

const PHOTO_SECONDS = 6;
const PHOTO_MS = PHOTO_SECONDS * 1000;
// Quicker & higher pitch to sound more like a younger voice.
const SPEECH_RATE = 1.16;
const TYPING_MS_NO_SPEECH = 48;
const UTTERANCE_PITCH = 1.18;

function lineForTicker(s: string) {
  // Strip basic markdown markers so the on-screen typing doesn't show `**` / `*`.
  return s
    .replace(/\*\*/g, '')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function topicAtIndex(
  index: number,
  ranges: { topic: AchievementTopic; start: number; end: number }[],
): AchievementTopic {
  for (const r of ranges) {
    if (index >= r.start && index < r.end) return r.topic;
  }
  if (ranges.length && index >= ranges[ranges.length - 1].end) {
    return ranges[ranges.length - 1].topic;
  }
  return 'intro';
}

function normLangForUtterance(lang: string): string {
  const l = lang.replace('_', '-').toLowerCase();
  if (l.startsWith('en-us')) return 'en-US';
  return lang.replace('_', '-');
}

/**
 * Prefer smooth US English male voices (neural / natural); avoid thin embedded voices.
 */
function pickAmericanEnglishMaleVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (!voices.length) return null;

  const normLang = (v: SpeechSynthesisVoice) => v.lang.toLowerCase().replace('_', '-');
  const isEnUs = (v: SpeechSynthesisVoice) => {
    const l = normLang(v);
    return l.startsWith('en-us') || l === 'en_us';
  };

  let pool = voices.filter(isEnUs);
  if (!pool.length) {
    pool = voices.filter((v) => normLang(v).startsWith('en'));
  }

  const femaleHints =
    /female|woman|samantha|victoria|karen|susan|zira|jenny|aria|linda|heather|zoe|ivy|sara/i;
  const smoothHints = /neural|wavenet|natural|premium|online|google|enhanced|aaron|guy|davis|jason|brandon|christopher|eric|jacob|ryan|tony|tom|fred|daniel|david|mark/i;
  // Prefer "youth"/"boy" voice names when available (helps avoid old-sounding voices).
  const youthHints = /young|youth|teen|junior|kid|kids|juvenile|boy/i;
  const roughHints = /compact|embedded|legacy|basic|cris|offline|sapi\s*5|low\s*quality/i;
  const maleHints = /male|fred|tom|alex|daniel|david|aaron|mark|jacob|ryan|guy|davis|jason|brandon|eric|tony|christopher/i;

  const score = (v: SpeechSynthesisVoice) => {
    let s = 0;
    const n = v.name;
    if (isEnUs(v)) s += 30;
    if (smoothHints.test(n)) s += 32;
    if (youthHints.test(n)) s += 28;
    if (roughHints.test(n)) s -= 45;
    if (maleHints.test(n)) s += 12;
    if (femaleHints.test(n)) s -= 35;
    if (v.default) s += 2;
    return s;
  };

  const ranked = [...pool].sort((a, b) => score(b) - score(a));
  return ranked[0] ?? voices.find(isEnUs) ?? voices[0] ?? null;
}

function EndCrackersOverlay({ show }: { show: boolean }) {
  // Many crackers across the screen (bottom -> top via `pirates-cracker-rise`).
  const items = useMemo(
    () => [
      { key: 0, left: '6%', delay: '0s', dur: '1.25s', drift: '-42px', sym: '🎆' },
      { key: 1, left: '14%', delay: '0.07s', dur: '1.25s', drift: '-28px', sym: '💥' },
      { key: 2, left: '22%', delay: '0.14s', dur: '1.25s', drift: '-14px', sym: '✨' },
      { key: 3, left: '30%', delay: '0.21s', dur: '1.25s', drift: '0px', sym: '🎇' },
      { key: 4, left: '38%', delay: '0.28s', dur: '1.25s', drift: '14px', sym: '🎆' },
      { key: 5, left: '46%', delay: '0.35s', dur: '1.25s', drift: '28px', sym: '💥' },
      { key: 6, left: '54%', delay: '0.42s', dur: '1.25s', drift: '42px', sym: '✨' },
      { key: 7, left: '62%', delay: '0.49s', dur: '1.25s', drift: '42px', sym: '🎇' },
      { key: 8, left: '70%', delay: '0.56s', dur: '1.25s', drift: '28px', sym: '🎆' },
      { key: 9, left: '78%', delay: '0.63s', dur: '1.25s', drift: '14px', sym: '💥' },
      { key: 10, left: '86%', delay: '0.7s', dur: '1.25s', drift: '0px', sym: '✨' },
      { key: 11, left: '94%', delay: '0.77s', dur: '1.25s', drift: '-14px', sym: '🎇' },

      { key: 12, left: '18%', delay: '0.88s', dur: '1.25s', drift: '-10px', sym: '🎆' },
      { key: 13, left: '34%', delay: '0.95s', dur: '1.25s', drift: '10px', sym: '💥' },
      { key: 14, left: '66%', delay: '1.02s', dur: '1.25s', drift: '-10px', sym: '✨' },
      { key: 15, left: '82%', delay: '1.09s', dur: '1.25s', drift: '10px', sym: '🎇' },
    ],
    [],
  );

  if (!show) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[35] overflow-hidden" aria-hidden>
      {items.map((it) => (
        <span
          key={it.key}
          className="absolute bottom-0 select-none text-2xl sm:text-4xl drop-shadow-[0_0_12px_rgba(250,204,21,0.85)]"
          style={{
            left: it.left,
            ['--drift-x' as string]: it.drift,
            animation: `pirates-cracker-rise ${it.dur} ease-out ${it.delay} forwards`,
          }}
        >
          {it.sym}
        </span>
      ))}
    </div>
  );
}

export default function AchievementsWelcome() {
  const router = useRouter();
  const { fullText, ranges, chunks } = useMemo(() => buildAchievementNarration(), []);
  const [typedLen, setTypedLen] = useState(0);
  const [speechOn, setSpeechOn] = useState(true);
  const [slideIndex, setSlideIndex] = useState(0);
  const [fireworksCycle, setFireworksCycle] = useState(0);
  const [skipClicked, setSkipClicked] = useState(false);
  const timeoutRefs = useRef<number[]>([]);
  const revealRafRef = useRef<number | null>(null);
  const caretRef = useRef<HTMLSpanElement>(null);
  // Awards/stats block removed per latest UI request.
  /** ~6 visible lines; scroll so newest content stays at bottom (older lines scroll up). */
  const textViewportRef = useRef<HTMLDivElement>(null);

  const cancelReveal = useCallback(() => {
    if (revealRafRef.current != null) {
      cancelAnimationFrame(revealRafRef.current);
      revealRafRef.current = null;
    }
  }, []);

  const displayed = fullText.slice(0, typedLen);
  const currentTopic = topicAtIndex(Math.max(0, typedLen - 1), ranges);
  const topicImgs = TOPIC_BACKGROUNDS[currentTopic] ?? [];
  const miniLeftPhoto =
    topicImgs.length > 0 ? topicImgs[Math.min(slideIndex, topicImgs.length - 1)] : null;

  const storyComplete = typedLen >= fullText.length;
  /** Only shown-so-far (no full-story preview — that was hiding the “typing” effect). */
  const readLine = lineForTicker(displayed);
  const isFinal = storyComplete;

  // (Awards/stats loading removed)

  useLayoutEffect(() => {
    const el = textViewportRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [typedLen, readLine]);

  const stopSpeech = useCallback(() => {
    cancelReveal();
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    timeoutRefs.current.forEach((id) => window.clearTimeout(id));
    timeoutRefs.current = [];
  }, [cancelReveal]);

  useEffect(() => {
    if (!topicImgs.length) {
      setSlideIndex(0);
      return;
    }
    setSlideIndex(0);
    if (topicImgs.length <= 1) return;
    let current = 0;
    const id = window.setInterval(() => {
      current += 1;
      if (current >= topicImgs.length) {
        window.clearInterval(id);
        return;
      }
      setSlideIndex(current);
    }, PHOTO_MS);
    return () => window.clearInterval(id);
  }, [currentTopic, topicImgs.length]);

  useEffect(() => {
    if (!speechOn) return;
    const synth = window.speechSynthesis;
    let cancelled = false;

    const clearTimers = () => {
      timeoutRefs.current.forEach((t) => window.clearTimeout(t));
      timeoutRefs.current = [];
    };

    const runQueue = () => {
      synth.cancel();
      cancelReveal();
      clearTimers();
      setTypedLen(0);

      const voiceList = () => synth.getVoices();
      const voice = pickAmericanEnglishMaleVoice(voiceList());

      let chunkIndex = 0;

      const next = () => {
        if (cancelled) return;
        if (chunkIndex >= chunks.length) {
          setTypedLen(fullText.length);
          return;
        }

        const { speechText, start, end, pauseAfterMs } = chunks[chunkIndex];
        const u = new SpeechSynthesisUtterance(speechText);
        const chunkRate = SPEECH_RATE;
        u.rate = chunkRate;
        u.pitch = UTTERANCE_PITCH;
        const vPick = voice ?? pickAmericanEnglishMaleVoice(voiceList());
        if (vPick) {
          u.voice = vPick;
          u.lang = normLangForUtterance(vPick.lang);
        } else {
          u.lang = 'en-US';
        }

        const segLen = Math.max(1, end - start);
        // Match on-screen reveal to speech: chars/sec scales with utterance rate
        const charsPerSec = 11 * chunkRate;
        const durationMs = Math.max(
          1200,
          Math.min(120_000, (segLen / charsPerSec) * 1000),
        );

        u.onstart = () => {
          cancelReveal();
          setTypedLen(start);
          const t0 = performance.now();
          const tick = (now: number) => {
            if (cancelled) return;
            const frac = Math.min(1, (now - t0) / durationMs);
            setTypedLen(start + Math.floor(frac * segLen));
            if (frac < 1) {
              revealRafRef.current = requestAnimationFrame(tick);
            }
          };
          revealRafRef.current = requestAnimationFrame(tick);
        };

        u.onend = () => {
          cancelReveal();
          setTypedLen(end);
          chunkIndex += 1;
          if (chunkIndex >= chunks.length) {
            setTypedLen(fullText.length);
            return;
          }
          const t = window.setTimeout(() => next(), chunks[chunkIndex - 1].pauseAfterMs);
          timeoutRefs.current.push(t);
        };

        u.onerror = () => {
          cancelReveal();
          chunkIndex += 1;
          setTypedLen(end);
          const t = window.setTimeout(() => next(), 200);
          timeoutRefs.current.push(t);
        };

        synth.speak(u);
      };

      if (voiceList().length) {
        next();
      } else {
        synth.onvoiceschanged = () => {
          synth.onvoiceschanged = null;
          if (!cancelled) next();
        };
      }
    };

    const startT = window.setTimeout(runQueue, 500);

    return () => {
      cancelled = true;
      cancelReveal();
      window.clearTimeout(startT);
      synth.cancel();
      clearTimers();
    };
  }, [speechOn, fullText, chunks, cancelReveal]);

  useEffect(() => {
    if (speechOn) return;
    stopSpeech();
    let len = 0;
    setTypedLen(0);
    const id = window.setInterval(() => {
      len += 1;
      if (len > fullText.length) {
        window.clearInterval(id);
        setTypedLen(fullText.length);
        return;
      }
      setTypedLen(len);
    }, TYPING_MS_NO_SPEECH);
    return () => window.clearInterval(id);
  }, [speechOn, fullText, stopSpeech]);

  useEffect(() => () => stopSpeech(), [stopSpeech]);

  function handleSkip() {
    setSkipClicked(true);
    stopSpeech();
    router.replace('/login?force=1');
  }

  // Keep blasting crackers (3 per cycle) until Skip is clicked.
  useEffect(() => {
    if (!isFinal || skipClicked) return;
    setFireworksCycle((c) => c + 1); // start immediately
    const id = window.setInterval(() => {
      setFireworksCycle((c) => c + 1);
    }, 2200);
    return () => window.clearInterval(id);
  }, [isFinal, skipClicked]);

  return (
    <div className="fixed inset-0 z-[1] flex flex-col bg-black overflow-hidden">
      <EndCrackersOverlay key={fireworksCycle} show={isFinal && !skipClicked} />

      {/* Plain text (outside blocks): WELCOME */}
      {!isFinal && (
        <header className="pointer-events-none absolute left-0 right-0 z-30 top-[2.5%] text-center px-4">
          <div className="text-[clamp(26px,4.5vw,40px)] font-extrabold tracking-[0.14em] text-amber-300 underline decoration-[3px] underline-offset-[6px]">
            WELCOME
          </div>
        </header>
      )}

      <div className="absolute inset-0 z-0">
        {isFinal ? (
          <div className="absolute inset-0 bg-black" />
        ) : (
          <>
            {/* Phone: show full artwork (letterbox). Laptop+: edge-to-edge cover. */}
            <div className="absolute inset-0 bg-black" aria-hidden />
            <Image
              src={STATIC_ACHIEVEMENTS_BG}
              alt="Pirates team lineup"
              fill
              className="object-contain object-center md:object-cover md:object-center"
              sizes="100vw"
              priority
            />
            <div className="absolute inset-0 bg-black/30 pointer-events-none" aria-hidden />
          </>
        )}
        {!isFinal && (
          <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black via-black/55 to-transparent pointer-events-none" />
        )}
      </div>

      {/* Narration: ~6 lines visible; scroll keeps newest at bottom. */}
      {!isFinal && (
        <footer className="absolute z-40 left-1/2 top-[30%] -translate-x-1/2 w-[92%] max-w-4xl bottom-0 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex flex-col pointer-events-auto">
          <div className="flex-1 min-h-0" aria-hidden />
          <div className="flex flex-col gap-3 w-full">
            {/* Big narration block centered at top + one mini (Slide A) full image at bottom */}
            <div className="flex flex-col gap-4 items-center">
              <div className="w-full border border-amber-500/25 bg-black/80 backdrop-blur-md rounded-2xl overflow-hidden">
                <div
                  ref={textViewportRef}
                  className="h-[4.65em] sm:h-[4.8em] md:h-[5.1em] overflow-y-auto overflow-x-hidden scroll-smooth px-5 py-4
                    text-[18px] sm:text-[20px] md:text-[22px] leading-[1.55] text-left
                    [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                >
                  <p className="m-0 break-words whitespace-normal">
                    <span className="font-medium text-amber-100 tracking-wide">{readLine}</span>
                    <span
                      ref={caretRef}
                      className="inline-block w-0.5 h-[0.9em] mx-0.5 align-middle bg-amber-400 animate-pulse rounded-sm"
                    />
                  </p>
                </div>
              </div>

              <div className="w-full max-w-[min(92vw,36rem)] mx-auto">
                <div className="relative w-full h-[clamp(200px,48vw,380px)] min-h-[200px] rounded-xl overflow-hidden bg-black border border-slate-800">
                  {miniLeftPhoto ? (
                    <Image
                      key={`${miniLeftPhoto.src}-${slideIndex}-${currentTopic}`}
                      src={miniLeftPhoto.src}
                      alt={miniLeftPhoto.alt}
                      fill
                      className="object-contain object-center bg-black"
                      unoptimized
                    />
                  ) : null}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 px-1 pb-1">
              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={speechOn}
                  onChange={(e) => {
                    const on = e.target.checked;
                    setSpeechOn(on);
                    if (!on) stopSpeech();
                    setTypedLen(0);
                  }}
                  className="rounded border-slate-600"
                />
                Narration
              </label>
              <button
                type="button"
                onClick={handleSkip}
                className="inline-flex items-center justify-center px-6 py-3 rounded-xl text-sm sm:text-base font-semibold bg-slate-700 hover:bg-slate-600 border border-slate-500 text-white shadow-md"
              >
                Skip to login
              </button>
            </div>
          </div>
        </footer>
      )}

      {isFinal && (
        <div className="absolute inset-0 z-[45] flex flex-col">
          <div className="flex-1 flex items-center justify-center px-4">
            <div
              className="text-center text-[clamp(44px,9vw,76px)] font-extrabold text-amber-200 tracking-tight"
              style={{ fontFamily: 'Times New Roman' }}
            >
              Go pirates
            </div>
          </div>
          <div className="pb-[max(0.75rem,env(safe-area-inset-bottom))] flex items-center justify-center px-4">
            <button
              type="button"
              onClick={handleSkip}
              className="inline-flex items-center justify-center px-8 py-4 rounded-xl text-base sm:text-lg font-semibold bg-slate-700 hover:bg-slate-600 border border-slate-500 text-white shadow-md"
            >
              Skip to login
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
