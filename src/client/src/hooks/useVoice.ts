import { useState, useRef, useCallback, useEffect } from 'react';

declare global {
  interface Window {
    SpeechRecognition?: typeof SpeechRecognition;
    webkitSpeechRecognition?: typeof SpeechRecognition;
  }
}

export function useVoice() {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const onResultRef = useRef<((transcript: string) => void) | null>(null);

  useEffect(() => {
    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    setIsSupported(!!Recognition);
    if (Recognition) {
      const recognition = new Recognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        const last = event.results[event.results.length - 1];
        const transcript = last[0].transcript.trim();
        if (last.isFinal && transcript && onResultRef.current) {
          onResultRef.current(transcript);
          onResultRef.current = null;
        }
      };

      recognition.onend = () => setIsListening(false);
      recognition.onerror = () => setIsListening(false);

      recognitionRef.current = recognition;
      return () => {
        try {
          recognition.abort();
        } catch {
          // ignore
        }
        recognitionRef.current = null;
      };
    }
  }, []);

  const startListening = useCallback((onResult: (transcript: string) => void) => {
    const rec = recognitionRef.current;
    if (!rec) return;
    onResultRef.current = onResult;
    try {
      rec.start();
      setIsListening(true);
    } catch {
      setIsListening(false);
      onResultRef.current = null;
    }
  }, []);

  const stopListening = useCallback(() => {
    const rec = recognitionRef.current;
    if (rec && isListening) {
      try {
        rec.stop();
      } catch {
        // ignore
      }
    }
    setIsListening(false);
    onResultRef.current = null;
  }, [isListening]);

  const speak = useCallback((text: string) => {
    if (!text || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.95;
    window.speechSynthesis.speak(u);
  }, []);

  return { isSupported, isListening, startListening, stopListening, speak };
}
