'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

export interface Transcript {
  final: string;
  interim: string;
}

// NOTE: This is the v2.4 implementation. It is deterministic AND captures interim text on demand.
export function useContinuousTranscription(onEvent: (eventName: string) => void) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState<Transcript>({ final: '', interim: '' });
  const [isSupported, setIsSupported] = useState(false);
  
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  
  const listeningRef = useRef(false); 
  const finalTranscriptRef = useRef<string>('');
  const interimTranscriptRef = useRef<string>(''); // NEW: Ref to track interim text

  const takeTranscript = useCallback(() => {
    onEvent('takeTranscript');
    
    // 1. Immediately command the recognition engine to stop. This remains the core of the robust design.
    recognitionRef.current?.stop();

    // 2. Capture BOTH final and interim text from our internal refs.
    const capturedText = (finalTranscriptRef.current + ' ' + interimTranscriptRef.current).trim();
    
    // 3. Clear both internal refs.
    finalTranscriptRef.current = '';
    interimTranscriptRef.current = '';

    // 4. Reset the public-facing transcript state.
    setTranscript({ final: '', interim: '' });
    
    // 5. Return the full captured text.
    return capturedText;
  }, [onEvent]);

  const processResult = useCallback((event: SpeechRecognitionEvent) => {
    onEvent('onresult');
    let interim = '';
    let final = '';

    // Rebuild the full transcript string from the results
    for (let i = 0; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        final += event.results[i][0].transcript + ' ';
      } else {
        interim += event.results[i][0].transcript;
      }
    }
    
    // Update our internal refs and the public state
    finalTranscriptRef.current = final.trim();
    interimTranscriptRef.current = interim.trim();
    setTranscript({ final: final.trim(), interim: interim.trim() });
  }, [onEvent]);

  const start = useCallback(() => {
    if (recognitionRef.current && !listeningRef.current) {
      onEvent('start (manual)');
      listeningRef.current = true;
      setIsListening(true);
      finalTranscriptRef.current = '';
      interimTranscriptRef.current = '';
      setTranscript({ final: '', interim: '' });
      recognitionRef.current.start();
    }
  }, [onEvent]);

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      onEvent('stop (manual)');
      listeningRef.current = false;
      recognitionRef.current.stop();
    }
  }, [onEvent]);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }
    setIsSupported(true);

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.onresult = processResult;
    
    recognition.onstart = () => {
      onEvent('onstart');
      setIsListening(true);
    };

    recognition.onend = () => {
      onEvent('onend');
      setIsListening(false);
      
      if (listeningRef.current) {
        onEvent('restarting...');
        // If restarting after a takeTranscript, the transcript refs have already been cleared.
        // If restarting after a natural pause, we need to consolidate the text.
        if (interimTranscriptRef.current) {
            finalTranscriptRef.current = (finalTranscriptRef.current + ' ' + interimTranscriptRef.current).trim();
            interimTranscriptRef.current = '';
            setTranscript({ final: finalTranscriptRef.current, interim: '' });
        }
        
        try {
          recognition.start();
        } catch (e) {
          console.error("[SpeechService] Restart failed:", e);
          onEvent('restart_failed');
          listeningRef.current = false;
        }
      }
    };

    recognition.onerror = (event) => {
      onEvent(`onerror: ${event.error}`);
      if (event.error === 'no-speech' || event.error === 'network') {
          return; // The onend handler will take care of restarting if needed.
      }
      listeningRef.current = false;
    };
    
    recognitionRef.current = recognition;

    return () => {
      listeningRef.current = false;
      recognition.stop();
    };
  }, [onEvent, processResult]);

  return { isListening, transcript, start, stop, isSupported, takeTranscript };
}
