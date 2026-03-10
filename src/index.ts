#!/usr/bin/env node

import { parseArgs } from 'node:util';
import { loadConfig, loadWatermarks, saveWatermarks } from './config.js';
import { getGraphClient } from './auth.js';
import { listTranscripts, getTranscriptContent, getMeetingMetadata, uploadToSharePoint, listOnlineMeetings } from './graph.js';
import { parseVTT, toMarkdown } from './parser.js';

const { values, positionals } = parseArgs({
  options: {
    config: { type: 'string', short: 'c', default: './config.json' },
    silent: { type: 'boolean', short: 's', default: false },
    'dry-run': { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
  allowPositionals: true,
  strict: false,
});

if (values.help) {
  console.log(`
transcript-export — Export Teams meeting transcripts to Markdown on SharePoint

Usage:
  transcript-export [options]                Process new transcripts
  transcript-export list-meetings [options]  Show your online meetings with IDs

Options:
  -c, --config <path>  Config file path (default: ./config.json)
  -s, --silent         Use cached auth only, don't prompt for login
  --dry-run            Show what would be processed without uploading
  -h, --help           Show this help
  `);
  process.exit(0);
}

const subcommand = positionals[0];

async function main(): Promise<void> {
  const configPath = values.config as string;
  const silent = values.silent as boolean;
  const dryRun = values['dry-run'] as boolean;

  if (subcommand === 'list-meetings') {
    await handleListMeetings(configPath, silent);
    return;
  }

  await handleProcessTranscripts(configPath, silent, dryRun);
}

async function handleListMeetings(configPath: string, silent: boolean): Promise<void> {
  const config = await loadConfig(configPath);
  const client = await getGraphClient(config.auth, silent);

  console.log('📅 Your recent online meetings:\n');
  const meetings = await listOnlineMeetings(client);

  if (meetings.length === 0) {
    console.log('  No online meetings found.');
    return;
  }

  for (const m of meetings) {
    console.log(`  📌 ${m.subject}`);
    console.log(`     Organizer: ${m.organizer}`);
    console.log(`     Meeting ID: ${m.meetingId}`);
    console.log(`     Join URL: ${m.joinUrl}`);
    console.log();
  }

  console.log(`Found ${meetings.length} meeting(s). Copy the Meeting ID into your config.json.`);
}

async function handleProcessTranscripts(
  configPath: string,
  silent: boolean,
  dryRun: boolean,
): Promise<void> {
  const config = await loadConfig(configPath);
  const watermarks = await loadWatermarks(config.watermarkPath);
  const client = await getGraphClient(config.auth, silent);

  console.log(`🚀 Processing ${config.meetings.length} meeting(s)...`);
  if (dryRun) console.log('   (dry run — no files will be uploaded)\n');

  let totalProcessed = 0;
  let totalSkipped = 0;
  let totalFailed = 0;

  for (const meeting of config.meetings) {
    console.log(`\n📋 ${meeting.name}`);
    const since = watermarks[meeting.meetingId];

    const transcripts = await listTranscripts(
      client,
      meeting.organizerId,
      meeting.meetingId,
      since,
    );

    if (transcripts.length === 0) {
      console.log('   No new transcripts.');
      totalSkipped++;
      continue;
    }

    console.log(`   Found ${transcripts.length} new transcript(s)`);

    for (const transcript of transcripts) {
      try {
        console.log(`   📝 Transcript ${transcript.id} (${transcript.createdDateTime})`);

        if (dryRun) {
          console.log('      [dry run] Would fetch, parse, and upload');
          totalProcessed++;
          continue;
        }

        // Fetch VTT content
        const vtt = await getTranscriptContent(
          client,
          meeting.organizerId,
          meeting.meetingId,
          transcript.id,
        );

        // Fetch meeting metadata
        let metadata;
        try {
          metadata = await getMeetingMetadata(client, meeting.organizerId, meeting.meetingId);
        } catch {
          // Fallback metadata if we can't fetch
          metadata = {
            subject: meeting.name,
            startDateTime: transcript.createdDateTime,
            endDateTime: transcript.createdDateTime,
            organizer: meeting.organizerId,
            attendees: [],
          };
        }

        // Parse VTT and generate Markdown
        const entries = parseVTT(vtt);
        const markdown = toMarkdown(entries, metadata);

        // Build output file path
        const date = new Date(transcript.createdDateTime).toISOString().split('T')[0];
        const fileName = `${meeting.name.replace(/[^a-zA-Z0-9-_ ]/g, '')}_${date}.md`;
        const filePath = `${config.sharepoint.basePath}/${meeting.outputFolder}/${fileName}`;

        // Upload to SharePoint
        await uploadToSharePoint(
          client,
          config.sharepoint.siteId,
          config.sharepoint.driveId,
          filePath,
          markdown,
        );

        console.log(`      ✅ Uploaded: ${filePath}`);

        // Update watermark
        watermarks[meeting.meetingId] = transcript.createdDateTime;
        totalProcessed++;
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`      ❌ Failed: ${msg}`);
        totalFailed++;
      }
    }
  }

  // Persist watermarks
  if (!dryRun) {
    await saveWatermarks(config.watermarkPath, watermarks);
  }

  console.log(`\n✨ Done: ${totalProcessed} processed, ${totalSkipped} skipped, ${totalFailed} failed`);
}

main().catch((err: Error) => {
  console.error('💥 Fatal error:', err.message);
  process.exit(1);
});
