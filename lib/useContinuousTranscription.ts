'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

export interface Transcript {
  final: string;
  interim: string;
}

export function useContinuousTranscription() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState<Transcript>({ final: '', interim: '' });
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const restartAfterClearRef = useRef(false);
  const listeningRef = useRef(false);

  const setListeningState = (isListening: boolean) => {
    listeningRef.current = isListening;
    setIsListening(isListening);
  };

  // This holds the transcript that is finalized and waiting to be assigned to a speaker.
  const stagedFinalTranscriptRef = useRef<string>('');

  const clearStagedFinalTranscript = useCallback(() => {
    stagedFinalTranscriptRef.current = '';
    setTranscript({ final: '', interim: '' });
    if (recognitionRef.current && listeningRef.current) {
      restartAfterClearRef.current = true;
      recognitionRef.current.abort();
    }
  }, []);
  
  const processResult = (event: SpeechRecognitionEvent) => {
    let interim = '';
    let final = stagedFinalTranscriptRef.current;

    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        final += event.results[i][0].transcript;
      } else {
        interim += event.results[i][0].transcript;
      }
    }
    
    stagedFinalTranscriptRef.current = final;
    setTranscript({ final, interim });
  };
  
  const start = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.start();
    }
  }, []);

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      restartAfterClearRef.current = false;
      recognitionRef.current.stop();
    }
  }, []);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.error("Speech Recognition is not supported in this browser.");
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
      setListeningState(true);
      setTranscript({ final: stagedFinalTranscriptRef.current, interim: '' });
    };

    recognition.onend = () => {
      if (restartAfterClearRef.current) {
        restartAfterClearRef.current = false;
        // If we were listening, restart recognition.
        if (listeningRef.current) {
          recognitionRef.current?.start();
        }
      } else {
        setListeningState(false);
        setTranscript({ final: stagedFinalTranscriptRef.current, interim: '' });
      }
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error', event.error);
      if (event.error === 'aborted') {
        // This is an intentional abort. onend will handle the restart.
        return;
      }
      if (event.error === 'no-speech' || event.error === 'network') {
        // Automatically restart recognition on some non-critical errors
        setTimeout(() => {
          if (listeningRef.current) {
            recognitionRef.current?.start();
          }
        }, 100);
      } else {
        setListeningState(false);
      }
    };
    
    recognitionRef.current = recognition;

    return () => {
      recognition.stop();
    };
  }, []); // isListening is not needed here as we manage it inside.

  return {
    isListening,
    transcript,
    start,
    stop,
    clearStagedFinalTranscript,
    isSupported,
  };
} 