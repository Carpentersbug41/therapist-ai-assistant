'use client';

import { useState, useEffect } from 'react';
import { useContinuousTranscription } from '../lib/useContinuousTranscription';
import { useChat } from 'ai/react';
import { ActionButtons } from '../components/ActionButtons';
import { ActionType } from '../lib/prompts';

// Define the shape of a single entry in our final transcript log
export interface TranscriptEntry {
  speaker: 'therapist' | 'client';
  text: string;
}

export default function Page() {
  const [transcriptLog, setTranscriptLog] = useState<TranscriptEntry[]>([]);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);
  
  const {
    isListening,
    transcript,
    start,
    stop,
    clearStagedFinalTranscript,
    isSupported,
  } = useContinuousTranscription();
  
  const { messages, append, isLoading: isChatLoading } = useChat({
    api: '/api/chat', // Point to our modified API route
    onFinish: (message) => {
      console.log("✅ [CLIENT] Request finished successfully. Last message:", message);
    },
    onError: (error) => {
      console.error("❌ [CLIENT] Request failed:", error);
    },
  });

  const handleAssignSpeaker = (speaker: 'therapist' | 'client') => {
    const textToAssign = (transcript.final + transcript.interim).trim();
    if (!textToAssign) return;
    setTranscriptLog(prevLog => [...prevLog, { speaker, text: textToAssign }]);
    clearStagedFinalTranscript();
  };
  
  const handleActionClick = (action: ActionType) => {
    // 1. Get text from staging area.
    const textToAssign = (transcript.final + transcript.interim).trim();

    // 2. Create an updated transcript log.
    // We'll work with a new variable to avoid state update delays.
    let updatedLog = [...transcriptLog];
    if (textToAssign) {
      const newEntry: TranscriptEntry = { speaker: 'client', text: textToAssign };
      updatedLog.push(newEntry);
      setTranscriptLog(updatedLog); // Update the state for the UI
      clearStagedFinalTranscript(); // Clear the staging area
    }

    // If there's nothing in the log at all (even after adding from staging), we'll create a dummy transcript to force the API call for debugging.
    let formattedTranscript;
    if (updatedLog.length === 0) {
      console.log("[CLIENT] Transcript is empty. Using dummy data to force API call for debugging.");
      formattedTranscript = "Client: This is a sample transcript to ensure the API call happens for debugging.";
    } else {
      // Format the *entire updated* transcript for the API.
      formattedTranscript = updatedLog
        .map(entry => `${entry.speaker.charAt(0).toUpperCase() + entry.speaker.slice(1)}: ${entry.text}`)
        .join('\n');
    }

    // 4. Call append from useChat.
    append({
      role: 'user',
      content: `Action: ${action}. Transcript is attached.`,
      data: {
        action: action,
        transcript: formattedTranscript,
      },
    });
  };

  // Find the last assistant message to display
  const lastAssistantMessage = messages.filter(m => m.role === 'assistant').pop();

  if (!isClient) {
    return null; // Render nothing on the server
  }

  if (!isSupported) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-red-100 text-red-800">
        <p className="text-2xl font-bold">
          Speech Recognition is not supported in this browser. Please use Chrome or Edge.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center min-h-screen bg-gray-100 p-4 sm:p-6 md:p-8">
      <main className="w-full max-w-4xl bg-white p-6 rounded-lg shadow-lg">
        <h1 className="text-3xl font-bold text-center mb-6 text-gray-800">
          Therapist AI Assistant
        </h1>
        
        <div className="p-4 mb-6 text-center bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700">
          <p className="font-bold">Demonstration Only</p>
          <p>This is a prototype. Do not use real Patient Health Information (PHI).</p>
        </div>

        {/* --- Transcription Section --- */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Left Column: Controls and Staging */}
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
            
            <div className={`transition-opacity duration-300 ${isListening || transcript.final ? 'opacity-100' : 'opacity-50'}`}>
              <div className="border border-gray-300 rounded-lg p-4 bg-gray-50 min-h-[120px]">
                <h3 className="text-sm font-semibold text-gray-500 mb-2">LIVE TEXT (Staging Area)</h3>
                <p className="text-gray-800">
                  {transcript.final}
                  <span className="text-gray-500">{transcript.interim}</span>
                </p>
              </div>
              <div className="flex gap-4 justify-center mt-4">
                <button
                  onClick={() => handleAssignSpeaker('therapist')}
                  disabled={!(transcript.final.trim() || transcript.interim.trim())}
                  className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  Assign to Therapist
                </button>
                <button
                  onClick={() => handleAssignSpeaker('client')}
                  disabled={!(transcript.final.trim() || transcript.interim.trim())}
                  className="flex-1 px-4 py-2 bg-purple-500 text-white rounded-md hover:bg-purple-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  Assign to Client
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Final Transcript Log */}
          <div className="border-t-2 md:border-t-0 md:border-l-2 border-gray-200 md:pl-6">
            <h2 className="text-xl font-semibold text-gray-700 mb-4">Final Transcript Log</h2>
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
        
        {/* Placeholder for AI Actions */}
        <div className="mt-8 border-t-2 border-gray-200 pt-6">
          <h2 className="text-xl font-semibold text-gray-700 mb-4">AI Actions & Output</h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <h3 className="text-lg font-medium text-gray-600 mb-3">Actions</h3>
              <ActionButtons
                onActionClick={handleActionClick}
                isChatLoading={isChatLoading}
                hasTranscript={transcriptLog.length > 0 || (transcript.final + transcript.interim).trim().length > 0}
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
  );
}
