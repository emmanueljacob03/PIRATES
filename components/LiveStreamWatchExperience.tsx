'use client';

import { useEffect, useMemo, useState } from 'react';
import type { SVGProps } from 'react';
import {
  youtubeVideoIdFromUrl,
  youtubeLiveChatEmbedSrc,
  youtubeCanonicalWatchUrl,
} from '@/lib/live-stream-embed';

/** One share glyph (avoid duplicate upload-style icons). */
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

function ThumbUpOutline(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <path d="M7 10v12" />
      <path d="M15 5.88 14 10h5.83a2 2 0 011.925 2.565l-2.34 8.24A2 2 0 0117 22h-8V11" />
      <path d="M13 21H7a5 5 0 015-6V11" />
    </svg>
  );
}

function ChatBubbleIcon(props: SVGProps<SVGSVGElement>) {
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

const BTN_ROUND =
  'flex items-center justify-center w-10 h-10 rounded-full bg-black/70 border shadow-lg hover:bg-black/88 backdrop-blur-sm shrink-0';

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
  /** YouTube/Vimeo chat or comments panel — starts closed everywhere. */
  const [chatOpen, setChatOpen] = useState(false);
  const [shareFlash, setShareFlash] = useState(false);

  useEffect(() => {
    setHost(typeof window !== 'undefined' ? window.location.hostname : '');
  }, []);

  const videoId = useMemo(
    () => youtubeVideoIdFromUrl(rawWatchUrl ?? '') ?? youtubeVideoIdFromUrl(embedUrl ?? ''),
    [rawWatchUrl, embedUrl],
  );

  const chatIframeSrc =
    active && embedUrl && videoId && host ? youtubeLiveChatEmbedSrc(videoId, host) : null;

  /** Page where tapping Like can count on YouTube (must use YouTube UI while signed in). */
  const likeTargetYoutube = videoId ? youtubeCanonicalWatchUrl(videoId) : null;
  const likeTargetFallback =
    !likeTargetYoutube && rawWatchUrl?.trim() && /^https?:/i.test(rawWatchUrl.trim()) ? rawWatchUrl.trim() : null;
  const likeTarget = likeTargetYoutube ?? likeTargetFallback;

  /** Single share targets YouTube watch when applicable, otherwise public Pirates /watch URL. */
  async function shareOnce() {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const url = likeTargetYoutube ?? `${origin}${publicSharePath}`;
    const title = 'Pirates — Live';
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, text: 'Watch the live stream', url });
        return;
      } catch {
        /* cancelled */
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

  function openLikeOnYoutube() {
    if (!likeTarget) return;
    window.open(likeTarget, '_blank', 'noopener,noreferrer');
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

  return (
    <div className="flex flex-col gap-3 w-full">
      <div className="rounded-lg overflow-hidden border border-slate-600 bg-black flex flex-col">
        <div className="relative w-full aspect-video bg-black min-h-[200px] isolate shrink-0">
          <iframe
            title="Live stream"
            src={embedUrl}
            className="absolute inset-0 w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />

          {/* Chat · Like · Share — one Share only */}
          <div className="absolute bottom-3 right-3 flex flex-row gap-2 z-10 pointer-events-none">
            <div className="pointer-events-auto flex gap-2">
              {showYoutubeChat ? (
                <button
                  type="button"
                  onClick={() => setChatOpen((v) => !v)}
                  className={`${BTN_ROUND} ${chatOpen ? 'border-amber-400/70 text-amber-200' : 'border-white/25 text-white'}`}
                  aria-expanded={chatOpen}
                  aria-label={chatOpen ? 'Hide live chat' : 'Show live chat'}
                  title="Chat"
                >
                  <ChatBubbleIcon className="w-5 h-5" />
                </button>
              ) : null}
              {likeTarget ? (
                <button
                  type="button"
                  onClick={openLikeOnYoutube}
                  className={`${BTN_ROUND} border-rose-400/35 text-rose-100`}
                  aria-label={videoId ? 'Open YouTube to like' : 'Open stream site'}
                  title={
                    videoId
                      ? 'Opens YouTube — tap Like while signed in (counted on YouTube)'
                      : 'Opens the stream link to like or react on the hosting site'
                  }
                >
                  <ThumbUpOutline className="w-5 h-5" />
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => void shareOnce()}
                className={`${BTN_ROUND} border-amber-400/45 text-amber-300`}
                aria-label="Share stream"
                title={shareFlash ? 'Copied' : 'Share'}
              >
                <ShareGlyph className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Compact chat: closed by default; opens from chat bubble */}
        {showYoutubeChat && chatOpen ? (
          <>
            <button
              type="button"
              aria-label="Close chat"
              className="fixed inset-0 bg-black/50 z-40 lg:hidden"
              onClick={() => setChatOpen(false)}
            />
            <div
              className="
              fixed left-3 right-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-50 rounded-lg overflow-hidden flex flex-col
              border border-slate-600 bg-black shadow-2xl max-h-[min(36vh,280px)]
              lg:static lg:z-auto lg:left-auto lg:right-auto lg:bottom-auto lg:mx-auto lg:max-w-[232px]
              lg:rounded-none lg:border-x-0 lg:border-b-0 lg:shadow-none lg:border-t lg:border-slate-700
              lg:max-h-[200px]
            "
            >
              <div className="flex items-center justify-between px-2 py-1 border-b border-slate-700 shrink-0 bg-slate-900/95">
                <span className="text-[11px] text-slate-400 truncate pr-2">Live chat</span>
                <button
                  type="button"
                  className="text-[11px] text-amber-300 px-1.5 py-0.5 rounded border border-slate-600 hover:bg-slate-800 shrink-0"
                  onClick={() => setChatOpen(false)}
                >
                  Close
                </button>
              </div>
              <iframe
                title="YouTube live chat"
                src={chatIframeSrc!}
                className="w-full flex-1 min-h-[148px] max-h-[calc(min(36vh,280px)-40px)] border-0 bg-black lg:min-h-[140px] lg:max-h-[156px]"
                referrerPolicy="strict-origin-when-cross-origin"
              />
            </div>
          </>
        ) : null}
      </div>

      {/* Vimeo reminder only when Vimeo and chat not applicable */}
      {isVimeo ? (
        <p className="text-slate-500 text-[11px] leading-snug max-w-xl">
          Use Share for this link. Vimeo doesn&apos;t expose YouTube-style embedded live chat beside the player.
        </p>
      ) : null}
    </div>
  );
}
