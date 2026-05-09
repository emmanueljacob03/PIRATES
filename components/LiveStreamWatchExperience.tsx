'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SVGProps } from 'react';
import {
  youtubeVideoIdFromUrl,
  youtubeLiveChatEmbedSrc,
  youtubeCanonicalWatchUrl,
} from '@/lib/live-stream-embed';
import { formatLikeCount } from '@/lib/format-like-count';

/** Share (nodes) — single share control. */
function ShareGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden {...props}>
      <circle cx="18" cy="5" r="3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="6" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="18" cy="19" r="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8.59 13.51l6.82 3.98M15.41 6.51l-6.82 3.98" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Filled thumbs-up (Material-style, clearly different from the old outline glyph). */
function LikeSolidIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z" />
    </svg>
  );
}

/** Outline thumbs-up (Feather-style) — pairs visually with LikeSolidIcon. */
function LikeOutlineIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden {...props}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"
      />
    </svg>
  );
}

/** Chat iframe draws at fixed size smaller than narrow rail → pan ↔ and ↕ inside the strip (mobile + desktop). */
const CHAT_IFRAME_PAN_WIDTH = 360;
const CHAT_IFRAME_PAN_HEIGHT = 560;

function ChatGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden {...props}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"
      />
    </svg>
  );
}

function TrimmedChatIframe({
  chatIframeSrc,
  onClose,
  panMode = true,
}: {
  chatIframeSrc: string;
  onClose: () => void;
  panMode?: boolean;
}) {
  return (
    <>
      <div
        className="flex items-center justify-between gap-1 px-1.5 py-0.5 border-b border-slate-700/90 shrink-0 bg-slate-950/90"
        title="Scroll sideways and vertically inside the panel to reach messages and Send. Sign in with Google when YouTube asks."
      >
        <span className="text-[10px] text-slate-500 pr-1 leading-tight">
          <span className="uppercase tracking-wide">Live chat</span>
          <span className="text-slate-600 font-normal normal-case"> · scroll</span>
        </span>
        <button
          type="button"
          className="text-[10px] text-amber-400/90 px-1 py-0.5 rounded hover:bg-white/5 shrink-0"
          onClick={onClose}
          aria-label="Close chat"
        >
          ×
        </button>
      </div>
      {panMode ? (
        <div
          className="flex-1 min-h-0 min-w-0 w-full overflow-auto overscroll-contain [scrollbar-width:thin] touch-pan-x touch-pan-y"
          title="Pan the chat — scroll sideways and up/down like a movable window."
        >
          <iframe
            title="YouTube live chat"
            src={chatIframeSrc}
            className="border-0 bg-black align-top shrink-0 block"
            width={CHAT_IFRAME_PAN_WIDTH}
            height={CHAT_IFRAME_PAN_HEIGHT}
            style={{
              width: CHAT_IFRAME_PAN_WIDTH,
              minWidth: CHAT_IFRAME_PAN_WIDTH,
              height: CHAT_IFRAME_PAN_HEIGHT,
              minHeight: CHAT_IFRAME_PAN_HEIGHT,
            }}
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      ) : (
        <iframe
          title="YouTube live chat"
          src={chatIframeSrc}
          className="w-full h-full min-h-0 flex-1 border-0 bg-black"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      )}
    </>
  );
}

const BAR =
  'pointer-events-auto flex items-center rounded-full border border-white/15 bg-black/55 backdrop-blur-md shadow-lg shadow-black/40 gap-0';

const BAR_BTN = 'p-2.5 text-white/90 hover:text-amber-200 hover:bg-white/10 transition-colors';

/** Narrow chat strip: smooth slide + inner content follows slightly after the shell (reads better when the panel is thin). */
const MOTION_CHAT =
  'transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.33,1,0.68,1)] motion-reduce:transition-none motion-reduce:duration-0';
const MOTION_CHAT_SHELL =
  'transition-transform duration-300 ease-[cubic-bezier(0.33,1,0.68,1)] motion-reduce:transition-none motion-reduce:duration-0';
const MOTION_W =
  'transition-[width,min-width,max-width,padding,margin,border-opacity,opacity] duration-300 ease-[cubic-bezier(0.33,1,0.68,1)] motion-reduce:transition-none motion-reduce:duration-0';
const MOTION_FADE =
  'transition-opacity duration-300 ease-[cubic-bezier(0.33,1,0.68,1)] motion-reduce:transition-none motion-reduce:duration-0';

const CHAT_SLIDE_MS = 300;

/** Keeps chat body mounted briefly after close so the panel/content can animate out; `entered` stages desktop inner slide-in. */
function useChatSlidePanel(open: boolean) {
  const [mounted, setMounted] = useState(false);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const t = window.setTimeout(() => setEntered(true), 56);
      return () => window.clearTimeout(t);
    }
    setEntered(false);
    const t = window.setTimeout(() => setMounted(false), CHAT_SLIDE_MS);
    return () => window.clearTimeout(t);
  }, [open]);

  return { mounted, entered };
}

export default function LiveStreamWatchExperience({
  active,
  embedUrl,
  rawWatchUrl,
  publicSharePath = '/watch',
}: {
  active: boolean;
  embedUrl: string | null;
  rawWatchUrl: string | null;
  publicSharePath?: string;
}) {
  const [host, setHost] = useState('');
  const [chatOpen, setChatOpen] = useState(false);
  const [shareFlash, setShareFlash] = useState(false);
  const [youtubeLikes, setYoutubeLikes] = useState<number | null>(null);
  const [youtubeComments, setYoutubeComments] = useState<number | null>(null);
  const { mounted: chatBodyMounted, entered: chatInnerEntered } = useChatSlidePanel(chatOpen);
  const likeBurstRef = useRef<number | null>(null);

  useEffect(() => {
    setHost(typeof window !== 'undefined' ? window.location.hostname : '');
  }, []);

  const videoId = useMemo(
    () => youtubeVideoIdFromUrl(rawWatchUrl ?? '') ?? youtubeVideoIdFromUrl(embedUrl ?? ''),
    [rawWatchUrl, embedUrl],
  );

  const fetchYoutubeLikes = useCallback(() => {
    if (!videoId || !active) return;
    fetch(`/api/youtube-stats?videoId=${encodeURIComponent(videoId)}`, { credentials: 'omit' })
      .then((r) => r.json())
      .then((d: { likeCount?: number | null; commentCount?: number | null }) => {
        const likes = d.likeCount;
        const comments = d.commentCount;
        setYoutubeLikes(typeof likes === 'number' && Number.isFinite(likes) ? likes : null);
        setYoutubeComments(typeof comments === 'number' && Number.isFinite(comments) ? comments : null);
      })
      .catch(() => {
        setYoutubeLikes(null);
        setYoutubeComments(null);
      });
  }, [videoId, active]);

  useEffect(() => {
    if (!videoId || !active) {
      setYoutubeLikes(null);
      setYoutubeComments(null);
      return;
    }
    fetchYoutubeLikes();
    const id = window.setInterval(fetchYoutubeLikes, 90_000);
    return () => window.clearInterval(id);
  }, [videoId, active, fetchYoutubeLikes]);

  useEffect(() => {
    if (likeBurstRef.current != null) {
      window.clearInterval(likeBurstRef.current);
      likeBurstRef.current = null;
    }
  }, [videoId, active]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') fetchYoutubeLikes();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [fetchYoutubeLikes]);

  useEffect(() => {
    return () => {
      if (likeBurstRef.current != null) {
        window.clearInterval(likeBurstRef.current);
        likeBurstRef.current = null;
      }
    };
  }, []);

  const chatIframeSrc =
    active && embedUrl && videoId && host ? youtubeLiveChatEmbedSrc(videoId, host) : null;
  const shareUrlYoutube = videoId ? youtubeCanonicalWatchUrl(videoId) : null;

  async function shareOnce() {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const url = shareUrlYoutube ?? `${origin}${publicSharePath}`;
    const title = 'Pirates — Live';
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, text: 'Watch the live stream', url });
        return;
      } catch {
        /* dismissed */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setShareFlash(true);
      window.setTimeout(() => setShareFlash(false), 2000);
    } catch {
      window.prompt('Copy link:', url);
    }
  }

  if (!active || !embedUrl) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-[45vh]">
        <p className="text-slate-400 text-center px-4">The stream is not live right now.</p>
      </div>
    );
  }

  const showYoutubeChat = Boolean(chatIframeSrc);
  const isVimeo = !videoId && /vimeo\.com|player\.vimeo/i.test(embedUrl);
  const likesLabel = videoId ? (youtubeLikes == null ? '0' : formatLikeCount(youtubeLikes)) : '—';
  const commentsLabel = videoId && youtubeComments != null ? formatLikeCount(youtubeComments) : null;

  function openYoutubeToLike() {
    if (!shareUrlYoutube) return;
    window.open(shareUrlYoutube, '_blank', 'noopener,noreferrer');
    if (likeBurstRef.current != null) window.clearInterval(likeBurstRef.current);
    let n = 0;
    fetchYoutubeLikes();
    likeBurstRef.current = window.setInterval(() => {
      fetchYoutubeLikes();
      if (++n >= 30) {
        if (likeBurstRef.current != null) window.clearInterval(likeBurstRef.current);
        likeBurstRef.current = null;
      }
    }, 4000);
  }
  const showOverlayShare = !shareUrlYoutube;
  const chatEndRounding = showOverlayShare ? '' : ' pr-3 rounded-r-full';

  const chatSrc = chatIframeSrc ?? '';

  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="rounded-lg overflow-hidden border border-slate-600 bg-black flex flex-col lg:flex-row lg:items-stretch">
        {/* Video + overlay chat drawer (mobile) */}
        <div className="relative flex-1 min-w-0 aspect-video lg:aspect-auto lg:min-h-[min(52vw,320px)] lg:max-h-[min(70vh,520px)] bg-black lg:overflow-hidden">
          <iframe
            title="Live stream"
            src={embedUrl}
            className="absolute inset-0 w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />

          {showYoutubeChat && chatIframeSrc ? (
            <>
              <button
                type="button"
                aria-label="Close chat"
                className={`absolute inset-0 z-[15] lg:hidden bg-black/50 ${MOTION_FADE} ${
                  chatOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
                }`}
                onClick={() => setChatOpen(false)}
              />
              {/* Mobile: narrow rail; pan chat ↔ ↕ inside (fixed iframe size > visible area) */}
              <div
                className={`absolute top-0 right-0 bottom-0 z-20 flex flex-col w-[min(186px,44vw)] max-w-[200px]
                  border-l border-slate-600/90 bg-black shadow-[-8px_0_24px_rgba(0,0,0,0.55)]
                  overflow-hidden lg:hidden ${MOTION_CHAT_SHELL} will-change-transform
                  ${chatOpen ? 'translate-x-0' : 'translate-x-full pointer-events-none'}`}
                aria-hidden={!chatOpen}
              >
                <div
                  className={`flex flex-col flex-1 min-h-0 h-full overflow-hidden ${MOTION_CHAT}
                    ${chatInnerEntered ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0 pointer-events-none'}`}
                >
                  {chatBodyMounted ? (
                    <TrimmedChatIframe chatIframeSrc={chatSrc} onClose={() => setChatOpen(false)} panMode />
                  ) : null}
                </div>
              </div>
            </>
          ) : null}

          {/* Bottom: Like | Comment | Share */}
          <div className="absolute bottom-0 left-0 right-0 z-30 flex justify-center pb-2.5 pt-10 bg-gradient-to-t from-black/80 via-black/25 to-transparent pointer-events-none">
            <div className={BAR} role="toolbar" aria-label="Stream actions">
              {videoId ? (
                <button
                  type="button"
                  className="flex items-center gap-1 pl-2.5 pr-2 py-1 text-white rounded-l-full hover:bg-white/10 transition-colors"
                  aria-label={`Opens YouTube to like this stream. Current likes: ${likesLabel}.${commentsLabel ? ` Current comments: ${commentsLabel}.` : ''}`}
                  title="Opens YouTube to like this stream. Display shows current YouTube likes and comments."
                  onClick={() => openYoutubeToLike()}
                >
                  <LikeSolidIcon className="w-[18px] h-[18px] text-amber-400 shrink-0" aria-hidden />
                  <span
                    aria-hidden
                    className="text-[11px] font-bold tabular-nums leading-none min-w-[2rem] text-center px-1 py-px rounded-full bg-black/55 border border-amber-500/35 text-amber-100"
                  >
                    {likesLabel}
                  </span>
                  {commentsLabel ? (
                    <span
                      aria-hidden
                      className="text-[11px] font-semibold tabular-nums leading-none min-w-[2rem] text-center px-1 py-px rounded-full bg-black/45 border border-slate-500/35 text-slate-200"
                    >
                      {commentsLabel}
                    </span>
                  ) : null}
                </button>
              ) : (
                <div className="flex items-center gap-1.5 pl-3 pr-2 py-1 text-white opacity-50">
                  <LikeOutlineIcon className="w-[18px] h-[18px] shrink-0" />
                  <span className="text-[13px] font-semibold tabular-nums leading-none min-w-[1.75rem]">—</span>
                </div>
              )}
              <span className="w-px self-stretch bg-white/15 my-1.5" aria-hidden />
              {showYoutubeChat ? (
                <button
                  type="button"
                  className={`${BAR_BTN}${chatOpen ? ' text-amber-300' : ''}${chatEndRounding}`}
                  aria-pressed={chatOpen}
                  aria-label={chatOpen ? 'Hide comments' : 'Show comments'}
                  title="Comments"
                  onClick={() => setChatOpen((v) => !v)}
                >
                  <ChatGlyph className="w-[18px] h-[18px]" />
                </button>
              ) : (
                <span
                  className={`${BAR_BTN} opacity-40 cursor-not-allowed${chatEndRounding}`}
                  title="Chat not available for this stream"
                >
                  <ChatGlyph className="w-[18px] h-[18px]" />
                </span>
              )}
              {showOverlayShare ? (
                <>
                  <span className="w-px self-stretch bg-white/15 my-1.5" aria-hidden />
                  <button
                    type="button"
                    className={`${BAR_BTN} pr-3 rounded-r-full`}
                    aria-label="Share stream"
                    title={shareFlash ? 'Copied' : 'Share'}
                    onClick={() => void shareOnce()}
                  >
                    <ShareGlyph className="w-[18px] h-[18px]" />
                  </button>
                </>
              ) : null}
            </div>
          </div>
        </div>

        {/* Desktop: thin rail slides in — width grows from 0 */}
        {showYoutubeChat && chatIframeSrc ? (
          <div
            className={`relative hidden lg:flex flex-col shrink-0 overflow-hidden border-slate-700 bg-black ${MOTION_W}
              min-h-[min(52vw,320px)] max-h-[min(70vh,520px)] self-stretch
              ${chatOpen ? 'lg:w-[min(186px,20vw)] lg:max-w-[200px] lg:border-l lg:opacity-100' : 'lg:w-0 lg:max-w-0 lg:border-l-0 lg:opacity-0'}`}
            aria-hidden={!chatOpen}
          >
            <div
              className={`flex flex-col flex-1 min-h-0 min-w-[min(186px,20vw)] max-w-[200px] h-full overflow-hidden ${MOTION_CHAT} will-change-transform motion-reduce:[will-change:auto] ${
                chatInnerEntered ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0 pointer-events-none'
              }`}
            >
              {chatBodyMounted ? (
                <TrimmedChatIframe chatIframeSrc={chatSrc} onClose={() => setChatOpen(false)} panMode={false} />
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      {isVimeo ? (
        <p className="text-slate-500 text-[11px] leading-snug max-w-xl">
          Vimeo playback above — like counts aren&apos;t fetched here; use Share. Chat uses YouTube-style embed only for
          YouTube URLs.
        </p>
      ) : null}
    </div>
  );
}
