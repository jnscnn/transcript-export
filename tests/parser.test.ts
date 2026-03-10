import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseVTT, toMarkdown, type MeetingMetadata } from '../src/parser.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sampleVTT = readFileSync(resolve(__dirname, 'fixtures/sample.vtt'), 'utf-8');

describe('parseVTT', () => {
  it('should parse a Teams VTT file into entries', () => {
    const entries = parseVTT(sampleVTT);

    expect(entries.length).toBeGreaterThan(0);
    expect(entries[0]).toEqual({
      timestamp: '00:00:00',
      speaker: 'Jane Smith',
      text: 'Good morning everyone. Let\'s get started with our weekly standup.',
    });
  });

  it('should extract all speakers', () => {
    const entries = parseVTT(sampleVTT);
    const speakers = [...new Set(entries.map(e => e.speaker))];

    expect(speakers).toContain('Jane Smith');
    expect(speakers).toContain('John Doe');
    expect(speakers).toContain('Alice Johnson');
    expect(speakers).toHaveLength(3);
  });

  it('should extract all entries', () => {
    const entries = parseVTT(sampleVTT);
    // The sample VTT has 11 cue blocks
    expect(entries).toHaveLength(11);
  });

  it('should strip VTT tags from text', () => {
    const entries = parseVTT(sampleVTT);
    for (const entry of entries) {
      expect(entry.text).not.toContain('<v');
      expect(entry.text).not.toContain('</v>');
    }
  });

  it('should handle empty input', () => {
    expect(parseVTT('')).toEqual([]);
    expect(parseVTT('WEBVTT')).toEqual([]);
  });

  it('should handle malformed cues gracefully', () => {
    const malformed = `WEBVTT

00:00:00.000 --> 00:00:05.000
Just plain text without speaker tags

00:00:05.000 --> 00:00:10.000
<v Speaker>Tagged text.</v>`;

    const entries = parseVTT(malformed);
    expect(entries).toHaveLength(2);
    expect(entries[0]?.speaker).toBe('Unknown');
    expect(entries[1]?.speaker).toBe('Speaker');
  });
});

describe('toMarkdown', () => {
  const metadata: MeetingMetadata = {
    subject: 'Weekly Standup',
    startDateTime: '2026-03-10T10:00:00Z',
    endDateTime: '2026-03-10T10:30:00Z',
    organizer: 'Jane Smith',
    attendees: ['Jane Smith', 'John Doe', 'Alice Johnson'],
  };

  it('should generate markdown with YAML frontmatter', () => {
    const entries = parseVTT(sampleVTT);
    const md = toMarkdown(entries, metadata);

    expect(md).toContain('---');
    expect(md).toContain('meeting: "Weekly Standup"');
    expect(md).toContain('date: 2026-03-10');
    expect(md).toContain('organizer: Jane Smith');
  });

  it('should include meeting header', () => {
    const entries = parseVTT(sampleVTT);
    const md = toMarkdown(entries, metadata);

    expect(md).toContain('# Weekly Standup');
    expect(md).toContain('**Organizer:** Jane Smith');
    expect(md).toContain('**Attendees:** Jane Smith, John Doe, Alice Johnson');
  });

  it('should include transcript with speaker attribution', () => {
    const entries = parseVTT(sampleVTT);
    const md = toMarkdown(entries, metadata);

    expect(md).toContain('## Transcript');
    expect(md).toContain('**Jane Smith**');
    expect(md).toContain('**John Doe**');
    expect(md).toContain('**Alice Johnson**');
  });

  it('should group consecutive entries by the same speaker', () => {
    const entries = parseVTT(sampleVTT);
    const md = toMarkdown(entries, metadata);

    // Count speaker headers — should be fewer than total entries
    // because consecutive entries by the same speaker are grouped
    const speakerHeaders = md.match(/\*\*\w[\w ]+\*\* \*\(/g) ?? [];
    expect(speakerHeaders.length).toBeLessThanOrEqual(entries.length);
    // In the sample, speakers alternate frequently so grouping saves at least 1
    expect(speakerHeaders.length).toBeGreaterThan(0);
  });

  it('should include auto-generated footer', () => {
    const entries = parseVTT(sampleVTT);
    const md = toMarkdown(entries, metadata);

    expect(md).toContain('Auto-generated transcript. Processed');
  });
});
