'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

function pickMime(): string {
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
  if (typeof MediaRecorder === 'undefined') return '';
  for (const t of types) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return '';
}

/** WhatsApp-style mic (idle) / stop (recording). Preview/send is handled by parent after onRecorded. */
export default function ChatVoiceRecorder({
  onRecorded,
  onError,
  disabled,
}: {
  onRecorded: (blob: Blob, mimeType: string) => void;
  onError?: (message: string) => void;
  disabled: boolean;
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const mrRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const stopTicks = useCallback(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  const toggle = useCallback(async () => {
    if (disabled) return;
    if (isRecording) {
      mrRef.current?.stop();
      return;
    }
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      onError?.('Voice recording is not supported in this browser.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const mime = pickMime();
      const mr = mime
        ? new MediaRecorder(stream, { mimeType: mime })
        : new MediaRecorder(stream);
      mrRef.current = mr;
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        const type = mr.mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: type });
        chunksRef.current = [];
        stopTicks();
        setIsRecording(false);
        setSeconds(0);
        if (blob.size > 512) {
          onRecorded(blob, type);
        } else {
          onError?.('Recording was too short.');
        }
      };
      mr.start(200);
      setIsRecording(true);
      setSeconds(0);
      tickRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      onError?.('Microphone access denied or unavailable.');
    }
  }, [disabled, isRecording, onError, onRecorded, stopTicks]);

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      disabled={disabled}
      className={`w-12 h-12 rounded-full flex flex-col items-center justify-center shrink-0 touch-manipulation shadow-md transition ${
        isRecording
          ? 'bg-[#e53935] text-white animate-pulse'
          : 'bg-[#25D366] text-white hover:bg-[#20bd5a] active:scale-95'
      } disabled:opacity-40`}
      aria-label={isRecording ? 'Stop recording' : 'Record voice message'}
      title={isRecording ? 'Tap to stop — then confirm to send' : 'Hold to record — tap to stop, then confirm'}
    >
      {isRecording ? (
        <>
          <span className="text-[10px] font-bold tabular-nums leading-none">{seconds}s</span>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="mt-0.5" aria-hidden>
            <rect x="6" y="6" width="12" height="12" rx="2" />
          </svg>
        </>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="23" />
          <line x1="8" y1="23" x2="16" y2="23" />
        </svg>
      )}
    </button>
  );
}
