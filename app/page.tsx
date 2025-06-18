'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { useContinuousTranscription } from '../lib/useContinuousTranscription';
import { useChat } from 'ai/react';
import { ActionButtons } from '../components/ActionButtons';
import { ActionType } from '../lib/prompts';
import { DebugPanel } from '../components/DebugPanel';
import { createActionMessages } from '../lib/actions';

export interface TranscriptEntry {
  speaker: 'therapist' | 'client';
  text: string;
}

interface StreamedData {
  newSummary?: string;
}

export default function Page() {
  const [transcriptLog, setTranscriptLog] = useState<TranscriptEntry[]>([]);
  const [currentSummary, setCurrentSummary] = useState('');
  const [isClient, setIsClient] = useState(false);
  const [lastEvent, setLastEvent] = useState('');
  const [isPausedForAction, setIsPausedForAction] = useState(false);

  const handleSpeechEvent = useCallback((eventName: string) => {
    setLastEvent(eventName);
  }, []);

  const {
    isListening,
    transcript,
    start,
    stop,
    isSupported,
    takeTranscript,
  } = useContinuousTranscription(handleSpeechEvent);
  
  const { messages, append, isLoading: isChatLoading, data } = useChat({
    api: '/api/chat',
    onError: (error) => {
      console.error("❌ [CLIENT] API Request failed:", error);
      
      toast.error("AI Response Failed", {
        description: "There was a problem communicating with the AI. Please check your connection and try again.",
        duration: 5000
      });
    },
  });

  const handleAssignSpeaker = useCallback((speaker: 'therapist' | 'client') => {
    const textToAssign = takeTranscript();
    if (!textToAssign) return;
    setTranscriptLog(prevLog => [...prevLog, { speaker, text: textToAssign }]);
  }, [takeTranscript]);
  
  const handleClearStaging = useCallback(() => {
    takeTranscript();
  }, [takeTranscript]);
  
  const handleActionClick = (action: ActionType) => {
    if (isListening) {
      setIsPausedForAction(true);
      stop();
    }
    const MEMORY_BUFFER_SIZE = 6;

    const newLog = [...transcriptLog];
    const stagingText = takeTranscript().trim();
    if (stagingText) {
      newLog.push({ speaker: 'client', text: stagingText });
    }

    const buffer = newLog.slice(-MEMORY_BUFFER_SIZE);

    const messagesForAction = createActionMessages(buffer);

    const fullTranscript = newLog
      .map(e => `${e.speaker.charAt(0).toUpperCase() + e.speaker.slice(1)}: ${e.text}`)
      .join('\\n');

    append(
      { role: 'user', content: `Performing action: ${action}...` },
      {
        body: {
          action,
          messagesForAction,
          fullTranscript,
          currentSummary,
        },
      }
    );

    setTranscriptLog(newLog);
    takeTranscript(); 
  };

  const handleDownloadTranscript = () => {
    if (transcriptLog.length === 0 && !currentSummary) {
      toast.info("There is no transcript or summary to download.");
      return;
    }
  
    // 1. Create a professional header
    const now = new Date();
    const dateString = now.toLocaleDateString();
    const timeString = now.toLocaleTimeString();
    
    const header = `
========================================
   Therapy Session Transcript
========================================
Date: ${dateString}
Time: ${timeString}

Session Summary:
----------------
${currentSummary || "No summary was generated for this session."}
========================================

`;
  
    // 2. Format the main transcript with proper line breaks
    const formattedLog = transcriptLog
      .map(entry => `${entry.speaker.charAt(0).toUpperCase() + entry.speaker.slice(1)}: ${entry.text}`)
      .join('\n\n'); // Use double newline for readability
  
    // 3. Combine header and log into the final file content
    const fileContent = header.trim() + '\n\n' + formattedLog;
  
    // 4. Create and trigger the download
    const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    
    const timestamp = now.toISOString().replace(/[:.]/g, '-');
    link.download = `therapy-session-${timestamp}.txt`;
  
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    toast.success("Transcript downloaded.");
  };

  const lastAssistantMessage = messages.filter(m => m.role === 'assistant').pop();
  const isStagingAreaActive = (transcript.final.trim() || transcript.interim.trim()).length > 0;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        handleAssignSpeaker('therapist');
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        handleAssignSpeaker('client');
      } else if (event.key === ' ') {
        event.preventDefault();
        handleClearStaging();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleAssignSpeaker, handleClearStaging]);

  useEffect(() => {
    if (isPausedForAction && !isChatLoading && !isListening) {
      start();
      setIsPausedForAction(false);
    }
  }, [isPausedForAction, isChatLoading, isListening, start]);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (data && data.length > 0) {
      const lastDataEntry = data[data.length - 1] as StreamedData;
      if (typeof lastDataEntry === 'object' && lastDataEntry !== null && 'newSummary' in lastDataEntry) {
        if (lastDataEntry.newSummary && lastDataEntry.newSummary !== currentSummary) {
          setCurrentSummary(lastDataEntry.newSummary);
          toast.success("New summary received!");
        }
      }
    }
  }, [data, currentSummary]);

  if (!isClient) return null;

  if (!isSupported) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-red-100 text-red-800">
        <p className="text-2xl font-bold">Speech Recognition is not supported in this browser.</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col items-center min-h-screen bg-gray-100 p-4 sm:p-6 md:p-8">
        <main className="w-full max-w-4xl bg-white p-6 rounded-lg shadow-lg">
          <h1 className="text-3xl font-bold text-center mb-6 text-gray-800">Therapist AI Assistant</h1>
        
          <div className="p-4 mb-6 text-center bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700">
            <p className="font-bold">Demonstration Only</p>
            <p>This is a prototype. Do not use real Patient Health Information (PHI).</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col gap-6">
              <div className="text-center">
                <button
                  onClick={isListening ? stop : start}
                  className={`w-full px-8 py-3 text-lg font-semibold rounded-md text-white transition-colors ${
                    isListening ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'
                  }`}
                >
                  {isListening ? 'Stop Session' : 'Start Session'}
                </button>
              </div>
              
              <div className={`transition-opacity duration-300 ${isListening || isStagingAreaActive ? 'opacity-100' : 'opacity-50'}`}>
                <div className="border border-gray-300 rounded-lg p-4 bg-gray-50 min-h-[120px]">
                  <h3 className="text-sm font-semibold text-gray-500 mb-2">LIVE TEXT (Staging Area)</h3>
                  <p className="text-gray-800">
                    {transcript.final}
                    <span className="text-gray-500 font-normal">{transcript.interim}</span>
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 justify-center mt-4">
                  <button
                    onClick={() => handleAssignSpeaker('therapist')}
                    disabled={!isStagingAreaActive}
                    className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    Therapist
                  </button>
                  <button
                    onClick={() => handleAssignSpeaker('client')}
                    disabled={!isStagingAreaActive}
                    className="px-4 py-2 bg-purple-500 text-white rounded-md hover:bg-purple-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    Client
                  </button>
                  <button
                    onClick={handleClearStaging}
                    disabled={(transcript.final.length + transcript.interim.length) === 0}
                    className="col-span-2 mt-2 px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    Clear Staging Area
                  </button>
                </div>
                <p className="text-center text-xs text-gray-400 mt-2">
                  Use <strong>←</strong> for Therapist, <strong>→</strong> for Client, and <strong>Space</strong> to Clear
                </p>
              </div>
            </div>

            <div className="border-t-2 md:border-t-0 md:border-l-2 border-gray-200 md:pl-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-700">Final Transcript Log</h2>
                <button
                  onClick={handleDownloadTranscript}
                  disabled={transcriptLog.length === 0}
                  className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-sm"
                >
                  Download
                </button>
              </div>
              <div className="space-y-3 h-[400px] overflow-y-auto pr-2 bg-gray-50 p-3 rounded-md">
                {transcriptLog.length > 0 ? (
                  transcriptLog.map((entry, index) => (
                    <div
                      key={index}
                      className={`p-3 rounded-lg ${
                        entry.speaker === 'therapist'
                          ? 'bg-blue-100 text-blue-900'
                          : 'bg-purple-100 text-purple-900'
                      }`}
                    >
                      <strong className="capitalize font-bold">{entry.speaker}:</strong> {entry.text}
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 italic text-center mt-8">The transcript log will appear here.</p>
                )}
              </div>
            </div>
          </div>
          
          {currentSummary && (
            <div className="mt-8 border-t-2 border-gray-200 pt-6">
              <h2 className="text-xl font-semibold text-gray-700 mb-4">Current Session Summary</h2>
              <div className="border border-gray-300 rounded-lg p-4 bg-yellow-50">
                <p className="text-gray-800 whitespace-pre-wrap">{currentSummary}</p>
              </div>
            </div>
          )}

          <div className="mt-8 border-t-2 border-gray-200 pt-6">
            <h2 className="text-xl font-semibold text-gray-700 mb-4">AI Actions & Output</h2>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1">
                <h3 className="text-lg font-medium text-gray-600 mb-3">Actions</h3>
                <ActionButtons
                  onActionClick={handleActionClick}
                  isChatLoading={isChatLoading}
                  hasTranscript={transcriptLog.length > 0 || isStagingAreaActive}
                />
              </div>
              <div className="lg:col-span-2">
                <h3 className="text-lg font-medium text-gray-600 mb-3">AI Response</h3>
                <div className="border border-gray-300 rounded-lg p-4 bg-gray-50 min-h-[150px]">
                  {isChatLoading && !lastAssistantMessage ? <p className="text-gray-500">AI is thinking...</p> : null}
                  {lastAssistantMessage ? <p className="text-gray-800 whitespace-pre-wrap">{lastAssistantMessage.content}</p> : <p className="text-gray-500 italic">The AI's response will appear here.</p>}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
      <DebugPanel isListening={isListening} lastEvent={lastEvent} />
    </>
  );
}
