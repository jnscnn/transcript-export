# transcript-export

Convert Teams meeting transcripts (.vtt / .docx) into structured Markdown with YAML frontmatter — designed as a foundation for AI-powered workflows.

## How It Works

1. **Download** a transcript from Teams after a meeting (~3 clicks)
2. **Drop** the `.vtt` or `.docx` file into an inbox folder
3. **Run** this tool (one-shot or continuous watch mode)
4. **Markdown** output appears in the output folder with structured metadata

If the output folder is in OneDrive, it auto-syncs to SharePoint — making transcripts available to M365 Copilot, Azure AI Search, and custom AI agents.

```
Download .vtt from Teams (3 clicks)
       ↓
Drop into ~/OneDrive/TranscriptInbox/
       ↓
transcript-export detects → parses VTT → Markdown
       ↓
Output to ~/OneDrive/Transcripts/ (auto-syncs to SharePoint)
       ↓
M365 Copilot / AI workflows consume it
```

## Prerequisites

- **Node.js 20+**
- That's it. No API keys, no app registration, no admin consent.

## Setup

```bash
git clone https://github.com/jnscnn/transcript-export.git
cd transcript-export
npm install
```

Create your inbox and output folders (ideally inside your synced OneDrive):

```bash
mkdir "$HOME/OneDrive - Microsoft/TranscriptInbox"
mkdir "$HOME/OneDrive - Microsoft/Transcripts"
```

## Usage

### Watch Mode (continuous)

Watches the inbox folder and auto-converts new transcripts as they appear:

```bash
npx tsx src/index.ts watch \
  --inbox "$HOME/OneDrive - Microsoft/TranscriptInbox" \
  --output "$HOME/OneDrive - Microsoft/Transcripts"
```

### Convert Mode (one-shot)

Processes all pending files in the inbox and exits:

```bash
npx tsx src/index.ts convert \
  --inbox "$HOME/OneDrive - Microsoft/TranscriptInbox" \
  --output "$HOME/OneDrive - Microsoft/Transcripts"
```

### Single File

Convert a specific transcript file:

```bash
npx tsx src/index.ts convert \
  --file "Weekly Standup-20260310_100000-Meeting Transcript.vtt" \
  --output ./Transcripts
```

### Options

| Flag | Description |
|------|-------------|
| `-i, --inbox <dir>` | Inbox folder (default: `./TranscriptInbox`) |
| `-o, --output <dir>` | Output folder (default: `./Transcripts`) |
| `-f, --file <path>` | Convert a single file |
| `--no-move` | Don't move processed files to `/processed/` |
| `-h, --help` | Show help |

## How to Download Transcripts from Teams

1. Open the meeting chat in Teams
2. Click on the transcript (or find it in the meeting recap)
3. Click **"..."** (more options) → **"Download"**
4. Save the `.vtt` file to your inbox folder

For meetings you organize, transcripts are also available in your OneDrive `/Recordings` folder.

## Output Format

Each transcript becomes a Markdown file with YAML frontmatter:

```markdown
---
meeting: "Weekly Standup"
date: 2026-03-10
attendees: [Jane Smith, John Doe, Alice Johnson]
speakers: [Jane Smith, John Doe, Alice Johnson]
---

# Weekly Standup — Tuesday, March 10, 2026

**Date:** Tuesday, March 10, 2026, 10:00 AM
**Attendees:** Jane Smith, John Doe, Alice Johnson

---

## Transcript

**Jane Smith** *(00:00:00)*
Good morning everyone. Let's get started.

**John Doe** *(00:00:05)*
Sure, I have a quick update on the project.

---

*Auto-generated transcript. Processed 2026-03-10T14:00:00Z.*
```

The YAML frontmatter makes files machine-parseable for downstream AI workflows.

## Supported Formats

| Format | Source | Notes |
|--------|--------|-------|
| `.vtt` (WebVTT) | Teams transcript download | Primary format, includes speaker tags |
| `.docx` | Teams transcript export | Parsed via mammoth, speaker/timestamp extraction |

## Downstream AI Workflows

Once Markdown transcripts land in SharePoint (via OneDrive sync):

| Workflow | How |
|----------|-----|
| **M365 Copilot** | Automatic — Copilot indexes SharePoint content for chat grounding |
| **Azure AI Search** | Index the SharePoint library for RAG pipelines |
| **Meeting summaries** | Feed markdown to an LLM for summarization |
| **Action items** | Parse transcripts with an LLM to extract tasks |

## Development

```bash
npm install
npm test          # Run unit tests (vitest)
npm run build     # Compile TypeScript
```
