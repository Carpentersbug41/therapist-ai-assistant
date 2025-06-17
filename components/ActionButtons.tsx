'use client';

import { PROMPTS, ActionType } from '../lib/prompts';

interface ActionButtonsProps {
  onActionClick: (action: ActionType) => void;
  isChatLoading: boolean;
  hasTranscript: boolean;
}

export function ActionButtons({ onActionClick, isChatLoading, hasTranscript }: ActionButtonsProps) {

  return (
    <div className="flex flex-wrap gap-3">
      {Object.keys(PROMPTS).map(key => {
        const actionKey = key as ActionType;
        return (
          <button
            key={actionKey}
            onClick={() => onActionClick(actionKey)}
            disabled={!hasTranscript || isChatLoading}
            className="px-4 py-2 text-sm font-medium text-white bg-gray-600 rounded-lg hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {actionKey.replace(/([A-Z])/g, ' $1').trim()} {/* Adds spaces for readability */}
          </button>
        );
      })}
    </div>
  );
} 