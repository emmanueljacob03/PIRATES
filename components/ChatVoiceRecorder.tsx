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
      className={`w-11 h-11 rounded-full flex flex-col items-center justify-center shrink-0 border touch-manipulation ${
        isRecording
          ? 'bg-red-900/80 border-red-500/70 text-red-100 animate-pulse'
          : 'text-slate-200 hover:bg-slate-700/80 border-slate-600/80'
      } disabled:opacity-40`}
      aria-label={isRecording ? 'Stop recording and send' : 'Record voice message'}
      title={isRecording ? 'Tap to stop and send' : 'Tap to record voice'}
    >
      <span className="text-lg leading-none" aria-hidden>
        {isRecording ? '⏹' : '🎤'}
      </span>
      {isRecording ? <span className="text-[9px] tabular-nums leading-none mt-0.5">{seconds}s</span> : null}
    </button>
  );
}
