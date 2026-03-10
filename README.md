# transcript-export

Export Microsoft Teams meeting transcripts to structured Markdown and upload to SharePoint — designed as a foundation for AI-powered workflows.

## How It Works

1. **Polls** the Microsoft Graph API for new transcripts on a set of configured recurring meetings
2. **Parses** the WebVTT transcript into structured entries (speaker, timestamp, text)
3. **Transforms** into Markdown with YAML frontmatter (machine-readable metadata for AI)
4. **Uploads** the `.md` file to a SharePoint document library via Graph API

```
Teams Meeting (transcription enabled)
       ↓
Graph API: fetch VTT transcript
       ↓
Parse VTT → structured Markdown with YAML frontmatter
       ↓
Upload to SharePoint doc library
       ↓
Available for M365 Copilot, Azure AI Search, custom AI agents
```

## Prerequisites

- **Node.js 20+**
- **Transcription enabled** on the target meetings (Teams meeting options or admin policy)
- You must be the **organizer or participant** of the target meetings

> **No app registration required.** This tool uses the Microsoft Graph PowerShell well-known client ID — a first-party Microsoft app pre-registered in every M365 tenant. Authentication uses device-code flow with your own M365 credentials.

## Setup

### 1. Configure

```bash
cp config.example.json config.json
```

Edit `config.json` with your tenant ID, SharePoint site info, and target meetings. Your tenant ID is `72f988bf-86f1-41af-91ab-2d7cd011db47` for Microsoft corporate.

### 2. Discover Meeting IDs

```bash
npx tsx src/index.ts list-meetings -c config.json
```

This lists your recent online meetings with their Graph API meeting IDs. Copy the IDs for the meetings you want to track into your `config.json`.

### 3. Run

```bash
# First run — will prompt for device-code authentication
npx tsx src/index.ts -c config.json

# Dry run — show what would be processed without uploading
npx tsx src/index.ts -c config.json --dry-run

# Silent mode — uses cached token, suitable for scheduled execution
npx tsx src/index.ts -c config.json --silent
```

## Config File

See `config.example.json` for the full template. Key sections:

```jsonc
{
  "auth": {
    "tenantId": "your-tenant-id",
    "tokenCachePath": "~/.transcript-export/token-cache.json"
  },
  "sharepoint": {
    "siteId": "contoso.sharepoint.com,site-guid,web-guid",
    "driveId": "drive-id-from-graph-api",
    "basePath": "/Transcripts"
  },
  "meetings": [
    {
      "name": "Weekly Standup",
      "meetingId": "MSoxMjM0NTY3...",
      "organizerId": "organizer-user-guid",
      "outputFolder": "Weekly-Standup"
    }
  ]
}
```

### Finding your SharePoint site ID and drive ID

Use the [Graph Explorer](https://developer.microsoft.com/en-us/graph/graph-explorer) to find these:

```
GET https://graph.microsoft.com/v1.0/sites/{your-sharepoint-domain}:/sites/{site-name}
```

The response includes `id` (site ID). Then get the document library drive:

```
GET https://graph.microsoft.com/v1.0/sites/{siteId}/drives
```

## Scheduling (Windows Task Scheduler)

Run the tool automatically every 2 hours during business hours:

```powershell
$action = New-ScheduledTaskAction `
  -Execute "npx" `
  -Argument "tsx src/index.ts -c config.json --silent" `
  -WorkingDirectory "C:\path\to\transcript-export"

$trigger = New-ScheduledTaskTrigger `
  -Daily -At "8:00AM" `
  -RepetitionInterval (New-TimeSpan -Hours 2) `
  -RepetitionDuration (New-TimeSpan -Hours 12)

Register-ScheduledTask -TaskName "TranscriptExport" -Action $action -Trigger $trigger
```

> **Important:** Run the tool interactively once first (`npx tsx src/index.ts -c config.json`) to complete the device-code authentication. The cached refresh token is then used for silent scheduled runs.

## Output Format

Each transcript is saved as a Markdown file with YAML frontmatter:

```markdown
---
meeting: "Weekly Standup"
date: 2026-03-10
organizer: jane.smith@contoso.com
attendees: [Jane Smith, John Doe, Alice Johnson]
speakers: [Jane Smith, John Doe, Alice Johnson]
---

# Weekly Standup — Monday, March 10, 2026

**Date:** Monday, March 10, 2026, 10:00 AM – 10:30 AM
**Organizer:** jane.smith@contoso.com
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

The YAML frontmatter makes files machine-readable for downstream AI workflows.

## Downstream AI Workflows

Once Markdown transcripts land in SharePoint:

| Workflow | How |
|----------|-----|
| **M365 Copilot** | Automatic — Copilot indexes SharePoint content for chat grounding |
| **Azure AI Search** | Index the SharePoint library for RAG pipelines |
| **Meeting summaries** | Add an AI layer to this tool (see Future section) |
| **Action items** | Parse transcripts with an LLM to extract tasks |

## Development

```bash
npm install
npm test          # Run unit tests (vitest)
npm run build     # Compile TypeScript
```

## Important Notes

- **Metered API:** The Graph transcript API is a [metered API](https://learn.microsoft.com/en-us/graph/teams-licenses#payment-models-for-meeting-apis). There's a seeded capacity included with M365 licenses, but high-volume usage may incur costs. For 1–5 recurring meetings, usage should stay within the free tier.
- **Transcript delay:** Transcripts aren't available instantly after a meeting ends. There's typically a 5–15 minute processing delay. The 2-hour polling cadence handles this comfortably.
- **Token expiry:** MSAL refresh tokens are long-lived but can expire after extended inactivity (~90 days). If scheduled runs start failing, run interactively once to re-authenticate.
