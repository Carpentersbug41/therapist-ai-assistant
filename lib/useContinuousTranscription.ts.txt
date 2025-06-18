'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

export interface Transcript {
  final: string;
  interim: string;
}

export function useContinuousTranscription(onEvent: (eventName: string) => void) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState<Transcript>({ final: '', interim: '' });
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  
  const listeningRef = useRef(false);
  const finalTranscriptRef = useRef<string>('');
  const interimTranscriptRef = useRef<string>('');
  
  const ignoreNextResultRef = useRef(false);
  const ignoreTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const setListeningState = (isListening: boolean) => {
    listeningRef.current = isListening;
    setIsListening(isListening);
  };

  const takeTranscript = useCallback(() => {
    onEvent('takeTranscript');
    
    if (ignoreTimeoutRef.current) {
      clearTimeout(ignoreTimeoutRef.current);
      ignoreTimeoutRef.current = null;
    }

    const final = finalTranscriptRef.current;
    const interim = interimTranscriptRef.current;
    
    finalTranscriptRef.current = '';
    interimTranscriptRef.current = '';
    
    ignoreNextResultRef.current = true;
    
    ignoreTimeoutRef.current = setTimeout(() => {
      if (ignoreNextResultRef.current) {
        console.log('[SpeechService] ignoreNextResultRef timed out, unsetting.');
        onEvent('ignore_timeout');
        ignoreNextResultRef.current = false;
      }
      ignoreTimeoutRef.current = null;
    }, 250);
    
    setTranscript({ final: '', interim: '' });
    
    return (final + interim).trim();
  }, [onEvent]);

  const processResult = useCallback((event: SpeechRecognitionEvent) => {
    if (ignoreNextResultRef.current) {
      console.log('[SpeechService] Ignored stray result after takeTranscript.');
      onEvent('ignoredResult');
      ignoreNextResultRef.current = false;
      if (ignoreTimeoutRef.current) {
        clearTimeout(ignoreTimeoutRef.current);
        ignoreTimeoutRef.current = null;
      }
      return;
    }
    
    onEvent('onresult');
    let interim = '';
    let final = finalTranscriptRef.current;

    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        final += event.results[i][0].transcript;
      } else {
        interim += event.results[i][0].transcript;
      }
    }
    
    finalTranscriptRef.current = final;
    interimTranscriptRef.current = interim;
    setTranscript({ final, interim });
  }, [onEvent]);
  
  const start = useCallback(() => {
    if (recognitionRef.current) {
      onEvent('start (manual)');
      setListeningState(true);
      recognitionRef.current.start();
    }
  }, [onEvent]);

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      onEvent('stop (manual)');
      setListeningState(false);
      recognitionRef.current.stop();
    }
  }, [onEvent]);

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
      console.log('[SpeechService] Event: onstart');
      onEvent('onstart');
      setIsListening(true);
    };

    recognition.onend = () => {
      console.log('[SpeechService] Event: onend');
      onEvent('onend');
      if (listeningRef.current) {
        console.log('[SpeechService] Desired state is listening, restarting service...');
        onEvent('restarting...');
        try {
          recognition.start();
        } catch (e) {
          console.error("[SpeechService] Restart failed:", e);
          onEvent('restart_failed');
          setListeningState(false);
        }
      } else {
        setIsListening(false);
      }
    };

    recognition.onerror = (event) => {
      console.error(`[SpeechService] Event: onerror, error: "${event.error}"`);
      onEvent(`onerror: ${event.error}`);
    };
    
    recognitionRef.current = recognition;

    return () => {
      listeningRef.current = false;
      if (ignoreTimeoutRef.current) {
        clearTimeout(ignoreTimeoutRef.current);
      }
      recognition.stop();
    };
  }, [onEvent, processResult]);

  return { isListening, transcript, start, stop, isSupported, takeTranscript };
}
