'use client';

interface DebugPanelProps {
  isListening: boolean;
  lastEvent: string;
}

export function DebugPanel({ isListening, lastEvent }: DebugPanelProps) {
  return (
    <div className="fixed bottom-4 right-4 bg-gray-800 text-white p-4 rounded-lg shadow-lg text-sm font-mono z-50">
      <h4 className="font-bold text-lg mb-2 border-b border-gray-600 pb-1">Debug Status</h4>
      <div className="flex items-center space-x-2">
        <span>Service Listening:</span>
        <span className={`px-2 py-1 rounded-full text-xs font-bold ${isListening ? 'bg-green-500' : 'bg-red-500'}`}>
          {isListening ? 'TRUE' : 'FALSE'}
        </span>
      </div>
      <div className="mt-2">
        <span>Last Event Fired: <strong className="text-yellow-400">{lastEvent || 'none'}</strong></span>
      </div>
    </div>
  );
} 