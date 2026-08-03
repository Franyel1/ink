"use client";

import { useEffect, useRef, useState } from "react";
import { useClientFlag } from "@/lib/useClientFlag";

// Minimal shape of the Web Speech API — not in lib.dom.d.ts by default.
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Dictation for a text field, backed by the browser's Web Speech API. */
export function useSpeechToText(onFinalChunk: (text: string) => void) {
  const supported = useClientFlag(() => getRecognitionCtor() !== null);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const onFinalChunkRef = useRef(onFinalChunk);

  // Kept current after every render so the long-lived `onresult` handler always
  // reports to the latest callback.
  useEffect(() => {
    onFinalChunkRef.current = onFinalChunk;
  });

  useEffect(() => {
    return () => recognitionRef.current?.stop();
  }, []);

  function start() {
    const Ctor = getRecognitionCtor();
    if (!Ctor || listening) return;
    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang =
      typeof navigator !== "undefined" ? navigator.language : "en-US";
    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          const text = result[0].transcript.trim();
          if (text) onFinalChunkRef.current(text);
        }
      }
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }

  function stop() {
    recognitionRef.current?.stop();
    setListening(false);
  }

  return {
    supported,
    listening,
    toggle: () => (listening ? stop() : start()),
  };
}
