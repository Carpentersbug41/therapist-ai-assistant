import { TranscriptEntry } from '../app/page';

export interface ActionMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Creates a "simulated reality" message buffer for the AI.
 * Maps the speaker to the appropriate role for the LLM.
 * @param buffer The last N entries from the transcript log.
 * @returns An array of messages formatted for the AI.
 */
export const createActionMessages = (buffer: TranscriptEntry[]): ActionMessage[] => {
  return buffer.map(entry => ({
    role: entry.speaker === 'client' ? 'user' : 'assistant',
    content: entry.text,
  }));
}; 