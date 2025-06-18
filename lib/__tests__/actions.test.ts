import { createActionMessages } from '../actions';
import { TranscriptEntry } from '../../app/page';

describe('createActionMessages', () => {
  it('should return an empty array when given an empty array', () => {
    const input: TranscriptEntry[] = [];
    const expected: any[] = [];
    expect(createActionMessages(input)).toEqual(expected);
  });

  it('should correctly map a client speaker to a user role', () => {
    const input: TranscriptEntry[] = [{ speaker: 'client', text: 'Hello from client' }];
    const expected = [{ role: 'user', content: 'Hello from client' }];
    expect(createActionMessages(input)).toEqual(expected);
  });

  it('should correctly map a therapist speaker to an assistant role', () => {
    const input: TranscriptEntry[] = [{ speaker: 'therapist', text: 'Hello from therapist' }];
    const expected = [{ role: 'assistant', content: 'Hello from therapist' }];
    expect(createActionMessages(input)).toEqual(expected);
  });

  it('should correctly map a mixed array of speakers', () => {
    const input: TranscriptEntry[] = [
      { speaker: 'client', text: 'I feel anxious.' },
      { speaker: 'therapist', text: 'Tell me more about that.' },
      { speaker: 'client', text: 'It is about work.' },
    ];
    const expected = [
      { role: 'user', content: 'I feel anxious.' },
      { role: 'assistant', content: 'Tell me more about that.' },
      { role: 'user', content: 'It is about work.' },
    ];
    expect(createActionMessages(input)).toEqual(expected);
  });

  it('should handle entries with empty text', () => {
    const input: TranscriptEntry[] = [
        { speaker: 'client', text: '' },
        { speaker: 'therapist', text: '...' },
    ];
    const expected = [
        { role: 'user', content: '' },
        { role: 'assistant', content: '...' },
    ];
    expect(createActionMessages(input)).toEqual(expected);
  });
}); 