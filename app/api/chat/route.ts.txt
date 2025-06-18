import {
  StreamData,
  StreamingTextResponse,
  OpenAIStream,
} from 'ai';
import OpenAI from 'openai';
import { ChatCompletionMessageParam } from 'openai/resources/index.mjs';
import { PROMPTS, ActionType } from '../../../lib/prompts';

export const runtime = 'edge';

// Define which actions need the full summary + history
const HIGH_CONTEXT_ACTIONS: ActionType[] = [
  'SummariseEnd',
  'SummariseMid',
  // Add any future analytical actions like 'IdentifyThemes' here
];

// Initialize the OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Helper function to format message history for high-context prompts
function formatHistoryToString(
  messages: Array<{ role: string; content: string }>,
): string {
  return messages
    .map(m => `${m.role.charAt(0).toUpperCase() + m.role.slice(1)}: ${m.content}`)
    .join('\n');
}

export async function POST(req: Request) {
  console.log("\n\n--- ✅ NEW REQUEST RECEIVED at /api/chat ✅ ---\n\n");
  const body = await req.json();

  // Log the exact payload received from the client
  console.log('--- Start of API Payload (Server-Side) ---');
  console.log(JSON.stringify(body, null, 2));
  console.log('--- End of API Payload (Server-Side) ---');
  
  // --- New Payload Structure (v2.0) ---
  const { action, messagesForAction, fullTranscript, currentSummary } = body;

  // Validate the action from the new payload
  if (!action || !PROMPTS[action as ActionType]) {
    return new Response(JSON.stringify({ error: 'Invalid action specified' }), { status: 400 });
  }

  const data = new StreamData();

  // --- Memory Task (Conditional Summarization) ---
  const transcriptTurnCount = (fullTranscript.match(/\\n/g) || []).length + 1;
  const SUMMARY_TRIGGER_THRESHOLD = 8; // Number of turns before a new summary is generated

  // We generate a new summary if the transcript is long enough and we don't have a summary yet,
  // or if the transcript has grown significantly since the last summary.
  // The 'action' check prevents re-summarizing a summary action.
  if (action !== 'Summary' && transcriptTurnCount >= SUMMARY_TRIGGER_THRESHOLD) {
    // This is an async side task; we don't want to block the primary action task.
    // We start it here and let it run in the background.
    (async () => {
      try {
        const summarySystemPrompt = "You are a text-processing AI. Your task is to update a previous summary with new information from a transcript. Output ONLY the new, consolidated summary and nothing else.";
        const summaryUserContent = `<PREVIOUS_SUMMARY>\n${currentSummary}\n</PREVIOUS_SUMMARY>\n\n<NEW_TRANSCRIPT_LINES>\n${fullTranscript}\n</NEW_TRANSCRIPT_LINES>`;

        const summaryMessages: ChatCompletionMessageParam[] = [
          { role: 'system', content: summarySystemPrompt },
          { role: 'user', content: summaryUserContent },
        ];
        
        console.log('--- Payload Sent to LLM (Memory Task) ---');
        console.log(JSON.stringify({ messages: summaryMessages }, null, 2));
        console.log('--- End of Memory Task Payload ---');

        const summaryResponse = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: summaryMessages,
          temperature: 0.5,
        });
        const newSummary = summaryResponse.choices[0].message.content;
        
        if (newSummary) {
          data.append({ newSummary });
        }
      } catch (e) {
        console.error("Error during summarization side task:", e);
        // Do not append anything, just log the error. The main action can still succeed.
      } finally {
        // IMPORTANT: Close the stream once the async task is done, regardless of success.
        data.close();
      }
    })();
  } else {
    // If we don't summarize, we must still close the stream.
    data.close();
  }

  // --- Action Task ---
  // This runs in parallel with the potential summarization task.

  let messagesForLLM: OpenAI.Chat.Completions.ChatCompletionMessageParam[];

  // --- THIS IS THE NEW ROUTING LOGIC ---
  if (HIGH_CONTEXT_ACTIONS.includes(action)) {
    // This is a "High-Context" Action. Build the detailed, single system prompt.
    console.log(`[SERVER] High-context action detected: ${action}. Injecting summary.`);
    
    const formattedHistory = formatHistoryToString(messagesForAction);
    const actionPrompt = PROMPTS[action as ActionType];

    const systemMessageContent = `
### INSTRUCTIONS ###
${actionPrompt}

### SESSION SUMMARY (PAST EVENTS) ###
${currentSummary || "No summary is available yet."}

### RECENT CONVERSATION (PRESENT) ###
${formattedHistory}

### FINAL COMMAND ###
Based on BOTH the summary and the recent conversation, execute your instructions now.
    `.trim();
    
    messagesForLLM = [
      {
        role: 'system',
        content: systemMessageContent
      }
    ];

  } else {
    // This is a "Low-Context" Action (e.g., Paraphrase).
    // Build the simpler payload with a separate system prompt and message history.
    console.log(`[SERVER] Low-context action detected: ${action}. Excluding summary.`);
    
    messagesForLLM = [
      {
        role: 'system',
        content: PROMPTS[action as ActionType]
      },
      ...messagesForAction
    ];
  }
  // --- END OF NEW ROUTING LOGIC ---


  // Now, use this dynamically created `messagesForLLM` array for the API call.
  console.log('--- Payload Sent to LLM (Action Task) ---');
  console.log(JSON.stringify({ messages: messagesForLLM }, null, 2));
  console.log('--- End of Action Task Payload ---');

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    stream: true,
    messages: messagesForLLM, // Use the new, dynamically constructed messages
    temperature: 0.7,
  });

  const stream = OpenAIStream(response);
  return new StreamingTextResponse(stream, {}, data);
}
