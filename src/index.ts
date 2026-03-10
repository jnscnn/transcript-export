#!/usr/bin/env node

import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { watchInbox, processInbox } from './watcher.js';
import { convertFile } from './converter.js';

const { values, positionals } = parseArgs({
  options: {
    inbox: { type: 'string', short: 'i' },
    output: { type: 'string', short: 'o' },
    file: { type: 'string', short: 'f' },
    'no-move': { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
  allowPositionals: true,
  strict: false,
});

const subcommand = positionals[0] ?? 'convert';

if (values.help) {
  console.log(`
transcript-export — Convert Teams meeting transcripts to Markdown

Usage:
  transcript-export watch    [options]  Watch inbox folder continuously
  transcript-export convert  [options]  Process all pending files and exit

Options:
  -i, --inbox <dir>     Inbox folder to watch/process (default: ./TranscriptInbox)
  -o, --output <dir>    Output folder for Markdown files (default: ./Transcripts)
  -f, --file <path>     Convert a single file (skip inbox)
  --no-move             Don't move processed files to /processed/
  -h, --help            Show this help

Workflow:
  1. Download transcript from Teams (click "..." → Download on the transcript)
  2. Drop the .vtt or .docx file into the inbox folder
  3. Run this tool (or leave it in watch mode)
  4. Markdown output appears in the output folder
  5. If output folder is in OneDrive, it auto-syncs to SharePoint
  `);
  process.exit(0);
}

async function main(): Promise<void> {
  const inboxDir = resolve(values.inbox as string ?? './TranscriptInbox');
  const outputDir = resolve(values.output as string ?? './Transcripts');
  const moveProcessed = !(values['no-move'] as boolean);

  // Ensure directories exist
  await mkdir(inboxDir, { recursive: true });
  await mkdir(outputDir, { recursive: true });

  if (values.file) {
    // Single file mode
    const filePath = resolve(values.file as string);
    if (!existsSync(filePath)) {
      console.error(`❌ File not found: ${filePath}`);
      process.exit(1);
    }

    console.log(`📝 Converting: ${filePath}\n`);
    const result = await convertFile(filePath, outputDir);
    console.log(`✅ ${result.meetingName} (${result.date})`);
    console.log(`   ${result.entryCount} entries → ${result.outputFile}`);
    return;
  }

  if (!existsSync(inboxDir)) {
    console.error(`❌ Inbox folder not found: ${inboxDir}`);
    process.exit(1);
  }

  if (subcommand === 'watch') {
    watchInbox(inboxDir, outputDir, { moveProcessed });
    // Keep the process alive
    process.on('SIGINT', () => {
      console.log('\n👋 Stopping watcher.');
      process.exit(0);
    });
  } else {
    // One-shot convert mode
    const count = await processInbox(inboxDir, outputDir, { moveProcessed });
    console.log(`\n✨ Done: ${count} file(s) converted.`);
  }
}

main().catch((err: Error) => {
  console.error('💥 Fatal error:', err.message);
  process.exit(1);
});
