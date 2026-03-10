/**
 * Extract meeting metadata from Teams transcript filename patterns.
 *
 * Teams filenames follow these patterns:
 *   {Meeting Name}-{YYYYMMDD}_{HHMMSS}-Meeting Transcript.vtt
 *   {Meeting Name}-{YYYYMMDD}_{HHMMSS}UTC-Meeting Transcript.vtt
 *   {Meeting Name}-{YYYYMMDD}_{HHMMSS}-Meeting Transcript.docx
 */

export interface FileMetadata {
  meetingName: string;
  date: string;       // ISO date: YYYY-MM-DD
  time: string;       // HH:MM:SS
  dateTime: string;   // ISO datetime
  outputFileName: string; // Sanitized filename for the .md output
}

// Pattern: MeetingName-YYYYMMDD_HHMMSS[UTC]-Meeting Transcript.ext
const TEAMS_FILENAME_PATTERN = /^(.+)-(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})(UTC)?-Meeting Transcript\.\w+$/;

// Fallback: MeetingName-YYYYMMDD_HHMMSS[UTC]-Meeting Recording.ext (some transcripts use this)
const TEAMS_RECORDING_PATTERN = /^(.+)-(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})(UTC)?-Meeting Recording\.\w+$/;

/**
 * Extract metadata from a Teams transcript/recording filename.
 * Falls back to using the raw filename and current date if the pattern doesn't match.
 */
export function extractMetadata(fileName: string, fileCreatedAt?: Date): FileMetadata {
  const match = fileName.match(TEAMS_FILENAME_PATTERN) ?? fileName.match(TEAMS_RECORDING_PATTERN);

  if (match) {
    const [, name, year, month, day, hour, min, sec] = match;
    const meetingName = name!.trim();
    const date = `${year}-${month}-${day}`;
    const time = `${hour}:${min}:${sec}`;
    const dateTime = `${date}T${time}Z`;

    return {
      meetingName,
      date,
      time,
      dateTime,
      outputFileName: sanitizeFileName(`${meetingName}_${date}.md`),
    };
  }

  // Fallback: use filename (without extension) and file creation date
  const baseName = fileName.replace(/\.\w+$/, '');
  const fallbackDate = fileCreatedAt ?? new Date();
  const date = fallbackDate.toISOString().split('T')[0]!;
  const time = fallbackDate.toISOString().split('T')[1]?.split('.')[0] ?? '00:00:00';

  return {
    meetingName: baseName,
    date,
    time,
    dateTime: fallbackDate.toISOString(),
    outputFileName: sanitizeFileName(`${baseName}_${date}.md`),
  };
}

/** Remove characters that are problematic in filenames. */
function sanitizeFileName(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, ' ').trim();
}
