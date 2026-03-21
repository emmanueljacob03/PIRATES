'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * Served from: public/achievements/intro.mp4 → /achievements/intro.mp4
 */
const INTRO_VIDEO_SRC = '/achievements/intro.mp4';

/** Wall-clock length we aim for (seconds). playbackRate = duration / this. */
const TARGET_PLAY_SECONDS = 8;

export default function IntroVideo({
  onComplete,
}: {
  onComplete: () => void;
}) {
  const [error, setError] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  /** Browser blocked unmuted autoplay — first tap on video area turns sound on */
  const [awaitingSoundTap, setAwaitingSoundTap] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const firstPlayingRef = useRef(false);

  const forceSoundOn = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.defaultMuted = false;
    v.muted = false;
    v.volume = 1;
    setMuted(false);
    setVolume(1);
    setAwaitingSoundTap(false);
    void v.play().catch(() => {});
  }, []);

  const handleSkip = useCallback(() => {
    const v = videoRef.current;
    if (v) {
      v.pause();
      v.removeAttribute('src');
      v.load();
    }
    onComplete();
  }, [onComplete]);

  useEffect(() => {
    if (error) onComplete();
  }, [error, onComplete]);

  const applyPlaybackRate = useCallback((v: HTMLVideoElement) => {
    const d = v.duration;
    if (d && Number.isFinite(d) && d > 0) {
      const r = Math.min(1.5, Math.max(0.25, d / TARGET_PLAY_SECONDS));
      v.playbackRate = r;
    } else {
      v.playbackRate = 0.75;
    }
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || error) return;

    const run = async () => {
      v.volume = 1;
      v.defaultMuted = false;
      v.muted = false;
      setMuted(false);
      try {
        await v.play();
        setAwaitingSoundTap(false);
      } catch {
        v.muted = true;
        setMuted(true);
        setAwaitingSoundTap(true);
        await v.play().catch(() => {});
      }
    };

    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only initial play / error recovery
  }, [error]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = muted;
  }, [muted]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.volume = Math.min(1, Math.max(0, volume));
  }, [volume]);

  if (error) return null;

  return (
    <div className="fixed inset-0 z-[1] bg-black overflow-hidden">
      <div className="absolute inset-0 overflow-hidden">
        <video
          ref={videoRef}
          className="intro-video-no-ui absolute inset-0 h-full w-full object-contain bg-black origin-center scale-[1.06] outline-none ring-0 focus:outline-none"
          style={{ objectPosition: 'center center' }}
          autoPlay
          muted={muted}
          playsInline
          preload="auto"
          controls={false}
          disablePictureInPicture
          disableRemotePlayback
          onLoadedMetadata={(e) => {
            applyPlaybackRate(e.currentTarget);
          }}
          onPlaying={(e) => {
            const v = e.currentTarget;
            if (firstPlayingRef.current) return;
            firstPlayingRef.current = true;
            // Some browsers resolve play() unmuted but still start muted — offer tap-to-unmute
            if (v.muted) setAwaitingSoundTap(true);
          }}
          onEnded={onComplete}
          onError={() => setError(true)}
        >
          <source src={INTRO_VIDEO_SRC} type="video/mp4" />
        </video>

        {/* One tap anywhere here = same as “audio on” (when autoplay had to start muted) */}
        {awaitingSoundTap && (
          <button
            type="button"
            className="absolute inset-0 bottom-[5.5rem] z-[6] w-full cursor-pointer bg-transparent"
            aria-label="Tap to turn on sound"
            onPointerDown={(e) => {
              e.preventDefault();
              forceSoundOn();
            }}
          />
        )}
      </div>

      <div className="absolute bottom-0 left-0 right-0 z-20 flex flex-wrap items-center justify-between gap-3 px-4 py-4 bg-gradient-to-t from-black/80 to-transparent">
        <div className="flex flex-wrap items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => {
              if (muted && volume === 0) setVolume(0.85);
              setAwaitingSoundTap(false);
              setMuted((m) => !m);
            }}
            className="shrink-0 px-3 py-2 rounded-lg text-sm font-medium bg-slate-700/95 hover:bg-slate-600 border border-slate-500 text-white"
            aria-label={muted ? 'Unmute' : 'Mute'}
            title={muted ? 'Sound on' : 'Mute'}
          >
            {muted ? '🔇 Volume' : '🔊 Volume'}
          </button>
          <label className="flex items-center gap-2 text-xs text-slate-200 min-w-[140px] flex-1 max-w-[220px]">
            <span className="sr-only">Volume</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={(e) => {
                const next = Number(e.target.value);
                setVolume(next);
                if (next > 0) {
                  setMuted(false);
                  setAwaitingSoundTap(false);
                  const v = videoRef.current;
                  if (v) {
                    v.muted = false;
                    v.volume = next;
                  }
                }
              }}
              className="intro-video-volume w-full accent-amber-400"
            />
          </label>
        </div>
        <button
          type="button"
          onClick={handleSkip}
          className="shrink-0 px-5 py-2.5 rounded-lg text-sm font-medium bg-slate-700/95 hover:bg-slate-600 border border-slate-500 text-white"
        >
          Skip
        </button>
      </div>
    </div>
  );
}
