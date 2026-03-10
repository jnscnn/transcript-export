import { watch, type FSWatcher } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { convertFile, markProcessed, isSupportedFile } from './converter.js';

/**
 * Watch an inbox folder for new transcript files and auto-convert them.
 * Uses a debounce to handle OneDrive's progressive file writes.
 */
export function watchInbox(
  inboxDir: string,
  outputDir: string,
  options: { moveProcessed?: boolean } = {},
): FSWatcher {
  const { moveProcessed = true } = options;
  const pending = new Map<string, NodeJS.Timeout>();
  const DEBOUNCE_MS = 3000; // Wait 3s after last change before processing

  console.log(`👀 Watching ${inboxDir} for new transcripts...`);
  console.log(`   Output: ${outputDir}`);
  console.log('   Press Ctrl+C to stop.\n');

  const watcher = watch(inboxDir, { persistent: true }, (_event, filename) => {
    if (!filename || !isSupportedFile(filename)) return;

    // Debounce: reset timer on every change to the same file
    const existing = pending.get(filename);
    if (existing) clearTimeout(existing);

    pending.set(
      filename,
      setTimeout(() => {
        pending.delete(filename);
        processFile(join(inboxDir, filename), outputDir, moveProcessed);
      }, DEBOUNCE_MS),
    );
  });

  watcher.on('error', (err) => {
    console.error('⚠ Watcher error:', err.message);
  });

  return watcher;
}

/**
 * Process all pending transcript files in the inbox (one-shot mode).
 */
export async function processInbox(
  inboxDir: string,
  outputDir: string,
  options: { moveProcessed?: boolean } = {},
): Promise<number> {
  const { moveProcessed = true } = options;
  const files = await readdir(inboxDir);
  const transcripts = files.filter(isSupportedFile);

  if (transcripts.length === 0) {
    console.log('📭 No transcript files found in inbox.');
    return 0;
  }

  console.log(`📬 Found ${transcripts.length} transcript(s) to process.\n`);

  let processed = 0;
  for (const file of transcripts) {
    const success = await processFile(join(inboxDir, file), outputDir, moveProcessed);
    if (success) processed++;
  }

  return processed;
}

async function processFile(
  inputPath: string,
  outputDir: string,
  moveProcessed: boolean,
): Promise<boolean> {
  try {
    const result = await convertFile(inputPath, outputDir);
    console.log(`✅ ${result.meetingName} (${result.date})`);
    console.log(`   ${result.entryCount} entries → ${result.outputFile}`);

    if (moveProcessed) {
      await markProcessed(inputPath);
      console.log('   Moved to /processed/');
    }
    console.log();
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`❌ Failed: ${inputPath}`);
    console.error(`   ${msg}\n`);
    return false;
  }
}
