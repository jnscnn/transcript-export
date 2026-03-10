import { readFile, writeFile, mkdir, stat, rename } from 'node:fs/promises';
import { basename, join, extname } from 'node:path';
import { existsSync } from 'node:fs';
import { parseVTT, toMarkdown, type MeetingMetadata } from './parser.js';
import { parseDocx } from './docx-parser.js';
import { extractMetadata } from './metadata.js';

export interface ConvertResult {
  inputFile: string;
  outputFile: string;
  meetingName: string;
  date: string;
  entryCount: number;
}

/**
 * Convert a single transcript file (.vtt or .docx) to Markdown.
 */
export async function convertFile(
  inputPath: string,
  outputDir: string,
): Promise<ConvertResult> {
  const fileName = basename(inputPath);
  const ext = extname(inputPath).toLowerCase();

  // Extract metadata from filename
  const fileStat = await stat(inputPath);
  const meta = extractMetadata(fileName, fileStat.birthtime);

  // Parse based on file type
  let entries;
  if (ext === '.vtt') {
    const content = await readFile(inputPath, 'utf-8');
    entries = parseVTT(content);
  } else if (ext === '.docx') {
    entries = await parseDocx(inputPath);
  } else {
    throw new Error(`Unsupported file type: ${ext}. Expected .vtt or .docx`);
  }

  if (entries.length === 0) {
    throw new Error(`No transcript entries found in ${fileName}`);
  }

  // Build meeting metadata (partial — we only have what the filename tells us)
  const speakers = [...new Set(entries.map(e => e.speaker))];
  const meetingMeta: MeetingMetadata = {
    subject: meta.meetingName,
    startDateTime: meta.dateTime,
    endDateTime: meta.dateTime,
    organizer: '',
    attendees: speakers, // Use speakers as attendees since we don't have a participant list
  };

  // Generate markdown
  const markdown = toMarkdown(entries, meetingMeta);

  // Ensure output directory exists
  await mkdir(outputDir, { recursive: true });

  // Write output file
  const outputPath = join(outputDir, meta.outputFileName);
  await writeFile(outputPath, markdown, 'utf-8');

  return {
    inputFile: inputPath,
    outputFile: outputPath,
    meetingName: meta.meetingName,
    date: meta.date,
    entryCount: entries.length,
  };
}

/**
 * Mark an input file as processed by moving it to a /processed subfolder.
 */
export async function markProcessed(inputPath: string): Promise<void> {
  const dir = join(inputPath, '..', 'processed');
  await mkdir(dir, { recursive: true });
  const dest = join(dir, basename(inputPath));
  await rename(inputPath, dest);
}

/**
 * Check if a file is a supported transcript format.
 */
export function isSupportedFile(fileName: string): boolean {
  const ext = extname(fileName).toLowerCase();
  return ext === '.vtt' || ext === '.docx';
}
