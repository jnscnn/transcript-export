export interface TranscriptEntry {
  timestamp: string;
  speaker: string;
  text: string;
}

export interface MeetingMetadata {
  subject: string;
  startDateTime: string;
  endDateTime?: string;
  organizer?: string;
  attendees?: string[];
}

/**
 * Parse a Teams WebVTT transcript into structured entries.
 *
 * Teams VTT format:
 * ```
 * WEBVTT
 *
 * 00:00:00.000 --> 00:00:05.230
 * <v Speaker Name>Hello everyone.</v>
 * ```
 */
export function parseVTT(vtt: string): TranscriptEntry[] {
  const entries: TranscriptEntry[] = [];

  // Split into cue blocks (separated by blank lines)
  const blocks = vtt.split(/\n\s*\n/).filter(b => b.trim());

  for (const block of blocks) {
    const lines = block.trim().split('\n');

    // Skip the WEBVTT header block
    if (lines[0]?.startsWith('WEBVTT')) continue;

    // Find the timestamp line (contains ' --> ')
    const timestampLine = lines.find(l => l.includes(' --> '));
    if (!timestampLine) continue;

    const timestamp = timestampLine.split(' --> ')[0]?.trim() ?? '';
    // Simplify timestamp: "00:05:23.000" → "00:05:23"
    const shortTimestamp = timestamp.replace(/\.\d+$/, '');

    // Remaining lines after timestamp are the cue text
    const textLines = lines.slice(lines.indexOf(timestampLine) + 1);
    const rawText = textLines.join(' ').trim();

    // Extract speaker from <v Speaker Name>...</v> tags
    const speakerMatch = rawText.match(/<v\s+([^>]+)>/);
    const speaker = speakerMatch?.[1] ?? 'Unknown';

    // Strip VTT tags to get clean text
    const text = rawText
      .replace(/<v\s+[^>]+>/g, '')
      .replace(/<\/v>/g, '')
      .trim();

    if (text) {
      entries.push({ timestamp: shortTimestamp, speaker, text });
    }
  }

  return entries;
}

/**
 * Convert parsed transcript entries + meeting metadata into structured Markdown
 * with YAML frontmatter for downstream AI workflows.
 */
export function toMarkdown(entries: TranscriptEntry[], meta: MeetingMetadata): string {
  const date = new Date(meta.startDateTime);
  const dateStr = date.toISOString().split('T')[0];
  const dateDisplay = date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const startTime = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const endTime = meta.endDateTime
    ? new Date(meta.endDateTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    : undefined;

  // Collect unique speakers
  const speakers = [...new Set(entries.map(e => e.speaker))];
  const attendees = meta.attendees?.length ? meta.attendees : speakers;

  // YAML frontmatter
  const frontmatter = [
    '---',
    `meeting: "${meta.subject}"`,
    `date: ${dateStr}`,
    meta.organizer ? `organizer: ${meta.organizer}` : null,
    `attendees: [${attendees.join(', ')}]`,
    `speakers: [${speakers.join(', ')}]`,
    '---',
  ].filter(Boolean).join('\n');

  // Header
  const timeLine = endTime ? `${startTime} – ${endTime}` : startTime;
  const header = [
    `# ${meta.subject} — ${dateDisplay}`,
    '',
    `**Date:** ${dateDisplay}, ${timeLine}`,
    meta.organizer ? `**Organizer:** ${meta.organizer}` : null,
    `**Attendees:** ${attendees.join(', ')}`,
    '',
    '---',
    '',
    '## Transcript',
    '',
  ].join('\n');

  // Transcript body — group consecutive entries by the same speaker
  const bodyParts: string[] = [];
  let currentSpeaker = '';

  for (const entry of entries) {
    if (entry.speaker !== currentSpeaker) {
      currentSpeaker = entry.speaker;
      bodyParts.push(`**${entry.speaker}** *(${entry.timestamp})*`);
    }
    bodyParts.push(entry.text);
    bodyParts.push('');
  }

  const footer = [
    '---',
    '',
    `*Auto-generated transcript. Processed ${new Date().toISOString()}.*`,
  ].join('\n');

  return [frontmatter, '', header, bodyParts.join('\n'), footer].join('\n');
}
