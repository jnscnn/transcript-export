import { describe, it, expect } from 'vitest';
import { extractMetadata } from '../src/metadata.js';

describe('extractMetadata', () => {
  it('should parse a standard Teams transcript filename', () => {
    const meta = extractMetadata('Weekly Standup-20260310_100000-Meeting Transcript.vtt');

    expect(meta.meetingName).toBe('Weekly Standup');
    expect(meta.date).toBe('2026-03-10');
    expect(meta.time).toBe('10:00:00');
    expect(meta.dateTime).toBe('2026-03-10T10:00:00Z');
    expect(meta.outputFileName).toBe('Weekly Standup_2026-03-10.md');
  });

  it('should handle UTC suffix in filename', () => {
    const meta = extractMetadata('Daily Huddle-20260225_075003UTC-Meeting Transcript.vtt');

    expect(meta.meetingName).toBe('Daily Huddle');
    expect(meta.date).toBe('2026-02-25');
    expect(meta.time).toBe('07:50:03');
  });

  it('should handle .docx extension', () => {
    const meta = extractMetadata('Team Sync-20260115_140000-Meeting Transcript.docx');

    expect(meta.meetingName).toBe('Team Sync');
    expect(meta.date).toBe('2026-01-15');
    expect(meta.outputFileName).toBe('Team Sync_2026-01-15.md');
  });

  it('should handle meeting names with special characters', () => {
    const meta = extractMetadata('[INT] Commerzbank - ATU Only - Weekly-20260309_150122UTC-Meeting Transcript.vtt');

    expect(meta.meetingName).toBe('[INT] Commerzbank - ATU Only - Weekly');
    expect(meta.date).toBe('2026-03-09');
  });

  it('should handle Meeting Recording pattern too', () => {
    const meta = extractMetadata('Commerzbank Ideation-20260303_154336-Meeting Recording.mp4');

    expect(meta.meetingName).toBe('Commerzbank Ideation');
    expect(meta.date).toBe('2026-03-03');
  });

  it('should fallback gracefully for non-standard filenames', () => {
    const fakeDate = new Date('2026-03-10T12:00:00Z');
    const meta = extractMetadata('random-transcript.vtt', fakeDate);

    expect(meta.meetingName).toBe('random-transcript');
    expect(meta.date).toBe('2026-03-10');
    expect(meta.outputFileName).toContain('random-transcript');
  });

  it('should sanitize output filenames', () => {
    const meta = extractMetadata('Meeting: Q&A <Review>-20260310_100000-Meeting Transcript.vtt');

    // Special chars should be replaced
    expect(meta.outputFileName).not.toContain(':');
    expect(meta.outputFileName).not.toContain('<');
    expect(meta.outputFileName).not.toContain('>');
  });
});
