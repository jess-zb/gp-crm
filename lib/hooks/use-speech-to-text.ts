"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { joinUtterance } from "@/lib/speech/join-utterance";

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionResultEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionResultEventLike = {
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function getSpeechRecognitionCtor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function messageForSpeechError(code: string): string | null {
  if (code === "aborted" || code === "no-speech") return null;
  if (code === "not-allowed") {
    return "Microphone access was blocked. Allow the mic in your browser, then try again.";
  }
  if (code === "audio-capture") return "No microphone found.";
  if (code === "network") return "Speech recognition needs a network connection.";
  return "Could not transcribe. Try again, or type the note.";
}

export function useSpeechToText({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const valueRef = useRef(value);
  valueRef.current = value;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const sessionBaseRef = useRef("");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const wantListeningRef = useRef(false);

  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSupported(getSpeechRecognitionCtor() !== null);
  }, []);

  const stop = useCallback(() => {
    wantListeningRef.current = false;
    const rec = recognitionRef.current;
    recognitionRef.current = null;
    if (!rec) {
      setListening(false);
      return;
    }
    rec.onend = null;
    rec.onresult = null;
    rec.onerror = null;
    try {
      rec.stop();
    } catch {
      // already stopped
    }
    setListening(false);
  }, []);

  const start = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setError("Speech-to-text works in Chrome and Edge.");
      return;
    }

    stop();
    setError(null);
    sessionBaseRef.current = valueRef.current;
    wantListeningRef.current = true;

    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";

    rec.onresult = (event) => {
      let committed = sessionBaseRef.current;
      let interim = "";
      for (let i = 0; i < event.results.length; i++) {
        const piece = event.results[i][0]?.transcript ?? "";
        if (event.results[i].isFinal) {
          committed = joinUtterance(committed, piece);
        } else {
          interim += piece;
        }
      }
      onChangeRef.current(joinUtterance(committed, interim));
    };

    rec.onerror = (event) => {
      const message = messageForSpeechError(event.error);
      if (!message) return;
      wantListeningRef.current = false;
      setError(message);
      setListening(false);
    };

    rec.onend = () => {
      if (!wantListeningRef.current) {
        setListening(false);
        return;
      }
      sessionBaseRef.current = valueRef.current;
      try {
        rec.start();
      } catch {
        wantListeningRef.current = false;
        setListening(false);
      }
    };

    recognitionRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      wantListeningRef.current = false;
      setError("Could not start the microphone. Try again.");
    }
  }, [stop]);

  useEffect(() => () => stop(), [stop]);

  const toggle = useCallback(() => {
    if (listening) stop();
    else start();
  }, [listening, start, stop]);

  return { supported, listening, error, start, stop, toggle };
}
