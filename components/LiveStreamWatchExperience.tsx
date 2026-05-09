'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { SVGProps } from 'react';
import {
  youtubeVideoIdFromUrl,
  youtubeLiveChatEmbedSrc,
  youtubeCanonicalWatchUrl,
} from '@/lib/live-stream-embed';

function ShareIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden {...props}>
      <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" strokeLinecap="round" strokeLinejoin="round" />
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
  const [showChatMobile, setShowChatMobile] = useState(false);
  const [copyFlash, setCopyFlash] = useState(false);
  const chatAnchorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setHost(typeof window !== 'undefined' ? window.location.hostname : '');
  }, []);

  const videoId = useMemo(
    () => youtubeVideoIdFromUrl(rawWatchUrl ?? '') ?? youtubeVideoIdFromUrl(embedUrl ?? ''),
    [rawWatchUrl, embedUrl],
  );

  const chatIframeSrc =
    active && embedUrl && videoId && host ? youtubeLiveChatEmbedSrc(videoId, host) : null;

  const shareTargetYoutube = videoId ? youtubeCanonicalWatchUrl(videoId) : null;

  async function shareViaDevice() {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const url = shareTargetYoutube ?? `${origin}${publicSharePath}`;
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
      setCopyFlash(true);
      window.setTimeout(() => setCopyFlash(false), 2000);
    } catch {
      window.prompt('Copy link:', url);
    }
  }

  async function copyPiratesWatchLink() {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const url = `${origin}${publicSharePath}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopyFlash(true);
      window.setTimeout(() => setCopyFlash(false), 2000);
    } catch {
      window.prompt('Copy Pirates watch page:', url);
    }
  }

  function toggleOrFocusChat() {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(min-width: 1024px)').matches) {
      chatAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else {
      setShowChatMobile((v) => !v);
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

  return (
    <div className="flex flex-col gap-4 w-full">
      <div className="rounded-lg overflow-hidden border border-slate-600 bg-black lg:grid lg:grid-cols-[1fr,minmax(260px,min(92vw,360px))] lg:h-[min(432px,calc(100vh-200px))]">
        <div className="relative w-full aspect-video lg:aspect-auto lg:h-full min-h-[200px]">
          <iframe
            title="Live stream"
            src={embedUrl}
            className="absolute inset-0 w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />

          <div className="absolute bottom-3 right-3 flex flex-col gap-2 items-end z-10 pointer-events-none">
            <div className="pointer-events-auto flex gap-2">
              {showYoutubeChat ? (
                <button
                  type="button"
                  onClick={toggleOrFocusChat}
                  className="flex items-center justify-center w-11 h-11 rounded-full bg-black/65 border border-white/25 text-white shadow-lg hover:bg-black/85 backdrop-blur-sm"
                  aria-label="Toggle or open YouTube live chat"
                  title="Live chat"
                >
                  <ChatBubbleIcon className="w-5 h-5" />
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => void shareViaDevice()}
                className="flex items-center justify-center w-11 h-11 rounded-full bg-black/65 border border-amber-400/40 text-amber-300 shadow-lg hover:bg-black/85 backdrop-blur-sm"
                aria-label="Share live stream link"
                title={copyFlash ? 'Copied!' : shareTargetYoutube ? 'Share stream' : 'Share'}
              >
                <ShareIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {showYoutubeChat ? (
          <div
            ref={chatAnchorRef}
            className="hidden lg:flex flex-col border-t lg:border-t-0 lg:border-l border-slate-700 bg-black min-h-0 h-full"
          >
            <div className="px-3 py-2 border-b border-slate-700 text-[11px] leading-snug text-slate-400 shrink-0">
              YouTube live chat — what you send here appears in YouTube&apos;s broadcast chat (same as on youtube.com)
              while the stream is live and chat is enabled.
            </div>
            <iframe
              title="YouTube live chat"
              src={chatIframeSrc!}
              className="flex-1 w-full min-h-0 border-0 bg-black"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen={false}
            />
          </div>
        ) : isVimeo ? (
          <div className="hidden lg:flex flex-col border-t lg:border-t-0 lg:border-l border-slate-700 bg-slate-900/40 p-4 text-sm text-slate-400 lg:justify-center lg:text-center">
            <p>
              Vimeo playback is embedded above. Live reactions and threads stay inside Vimeo&apos;s apps and site —
              use Share above to spread the Vimeo link if you pasted one here.
            </p>
          </div>
        ) : null}
      </div>

      {showYoutubeChat && showChatMobile ? (
        <div className="lg:hidden rounded-lg overflow-hidden border border-slate-600 bg-black flex flex-col max-h-[min(70vh,520px)]">
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700 bg-slate-900/90">
            <span className="text-xs text-slate-200 font-medium">YouTube live chat</span>
            <button
              type="button"
              className="text-xs text-amber-300 px-2 py-1 rounded border border-slate-600"
              onClick={() => setShowChatMobile(false)}
            >
              Close
            </button>
          </div>
          <iframe
            title="YouTube live chat"
            src={chatIframeSrc!}
            className="w-full min-h-[300px] flex-1 border-0 bg-black"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen={false}
          />
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2 gap-y-1 items-center text-xs">
        <span className="text-slate-500">Links:</span>
        {shareTargetYoutube ? (
          <a href={shareTargetYoutube} target="_blank" rel="noopener noreferrer" className="text-amber-400/90 underline">
            Open on YouTube
          </a>
        ) : rawWatchUrl && /^https?:/i.test(rawWatchUrl.trim()) ? (
          <a href={rawWatchUrl.trim()} target="_blank" rel="noopener noreferrer" className="text-amber-400/90 underline">
            Open stream page
          </a>
        ) : null}
        <button type="button" onClick={() => void copyPiratesWatchLink()} className="text-slate-400 underline hover:text-slate-200">
          Copy Pirates watch page
        </button>
      </div>
    </div>
  );
}
