import mammoth from 'mammoth';
import type { TranscriptEntry } from './parser.js';

/**
 * Teams .docx transcript format (typical):
 *
 *   Speaker Name
 *   HH:MM:SS
 *   Spoken text goes here spanning one or more lines.
 *
 *   Another Speaker
 *   HH:MM:SS
 *   Their spoken text.
 *
 * Some variants have "Speaker Name  HH:MM:SS" on a single line.
 */

// Pattern: standalone timestamp line like "0:05:23" or "00:05:23" or "1:23:45"
const TIMESTAMP_PATTERN = /^\d{1,2}:\d{2}:\d{2}$/;

// Pattern: combined "Speaker Name  HH:MM:SS" on one line
const SPEAKER_TIMESTAMP_PATTERN = /^(.+?)\s{2,}(\d{1,2}:\d{2}:\d{2})$/;

/**
 * Parse a Teams .docx transcript file into structured entries.
 */
export async function parseDocx(filePath: string): Promise<TranscriptEntry[]> {
  const result = await mammoth.extractRawText({ path: filePath });
  return parseDocxText(result.value);
}

/**
 * Parse the extracted text from a Teams .docx transcript.
 * Exported for testing without needing a real .docx file.
 */
export function parseDocxText(text: string): TranscriptEntry[] {
  const entries: TranscriptEntry[] = [];
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;

    // Try combined "Speaker Name  HH:MM:SS" pattern
    const combinedMatch = line.match(SPEAKER_TIMESTAMP_PATTERN);
    if (combinedMatch) {
      const speaker = combinedMatch[1]!.trim();
      const timestamp = normalizeTimestamp(combinedMatch[2]!);
      i++;

      // Collect text lines until next speaker/timestamp
      const textParts: string[] = [];
      while (i < lines.length) {
        const nextLine = lines[i]!;
        if (nextLine.match(SPEAKER_TIMESTAMP_PATTERN) || nextLine.match(TIMESTAMP_PATTERN)) break;
        // Check if next line is a speaker name (followed by a timestamp)
        if (i + 1 < lines.length && lines[i + 1]!.match(TIMESTAMP_PATTERN)) break;
        textParts.push(nextLine);
        i++;
      }

      if (textParts.length > 0) {
        entries.push({ timestamp, speaker, text: textParts.join(' ') });
      }
      continue;
    }

    // Try separate "Speaker Name" / "HH:MM:SS" / "Text" pattern
    if (i + 2 < lines.length && lines[i + 1]!.match(TIMESTAMP_PATTERN)) {
      const speaker = line;
      const timestamp = normalizeTimestamp(lines[i + 1]!);
      i += 2;

      const textParts: string[] = [];
      while (i < lines.length) {
        const nextLine = lines[i]!;
        if (nextLine.match(TIMESTAMP_PATTERN)) break;
        if (nextLine.match(SPEAKER_TIMESTAMP_PATTERN)) break;
        if (i + 1 < lines.length && lines[i + 1]!.match(TIMESTAMP_PATTERN)) break;
        textParts.push(nextLine);
        i++;
      }

      if (textParts.length > 0) {
        entries.push({ timestamp, speaker, text: textParts.join(' ') });
      }
      continue;
    }

    // Skip unrecognized lines
    i++;
  }

  return entries;
}

/** Normalize timestamps to HH:MM:SS format (pad hours if needed). */
function normalizeTimestamp(ts: string): string {
  const parts = ts.split(':');
  if (parts.length === 3 && parts[0]!.length === 1) {
    return `0${ts}`;
  }
  return ts;
}
