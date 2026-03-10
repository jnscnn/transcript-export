import type { Client } from '@microsoft/microsoft-graph-client';
import type { MeetingMetadata } from './parser.js';

export interface TranscriptInfo {
  id: string;
  createdDateTime: string;
  meetingId: string;
}

/**
 * List transcripts for a specific online meeting.
 * Returns transcripts sorted by creation date (newest first).
 */
export async function listTranscripts(
  client: Client,
  organizerId: string,
  meetingId: string,
  since?: string,
): Promise<TranscriptInfo[]> {
  let url = `/users/${organizerId}/onlineMeetings/${meetingId}/transcripts`;

  // Filter by date if watermark is provided
  if (since) {
    url += `?$filter=createdDateTime gt ${since}&$orderby=createdDateTime desc`;
  } else {
    url += '?$orderby=createdDateTime desc';
  }

  try {
    const response = await client.api(url).get();
    const transcripts: TranscriptInfo[] = (response.value ?? []).map(
      (t: Record<string, string>) => ({
        id: t.id,
        createdDateTime: t.createdDateTime,
        meetingId,
      }),
    );
    return transcripts;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`  ⚠ Failed to list transcripts for meeting ${meetingId}: ${msg}`);
    return [];
  }
}

/**
 * Fetch the transcript content as WebVTT text.
 */
export async function getTranscriptContent(
  client: Client,
  organizerId: string,
  meetingId: string,
  transcriptId: string,
): Promise<string> {
  const url = `/users/${organizerId}/onlineMeetings/${meetingId}/transcripts/${transcriptId}/content`;

  const response = await client
    .api(url)
    .header('Accept', 'text/vtt')
    .responseType('text' as never)
    .get();

  // The response is the raw VTT text
  return typeof response === 'string' ? response : String(response);
}

/**
 * Fetch meeting metadata (subject, times, attendees).
 */
export async function getMeetingMetadata(
  client: Client,
  organizerId: string,
  meetingId: string,
): Promise<MeetingMetadata> {
  const url = `/users/${organizerId}/onlineMeetings/${meetingId}`;

  const meeting = await client
    .api(url)
    .select('subject,startDateTime,endDateTime,participants')
    .get();

  const organizer = meeting.participants?.organizer?.upn ??
    meeting.participants?.organizer?.identity?.user?.displayName ??
    'Unknown';

  const attendees: string[] = (meeting.participants?.attendees ?? []).map(
    (a: Record<string, Record<string, Record<string, string>>>) =>
      a.upn ?? a.identity?.user?.displayName ?? 'Unknown',
  );

  return {
    subject: meeting.subject ?? 'Untitled Meeting',
    startDateTime: meeting.startDateTime,
    endDateTime: meeting.endDateTime,
    organizer,
    attendees: [organizer, ...attendees],
  };
}

/**
 * Upload a file to SharePoint via the Graph API.
 */
export async function uploadToSharePoint(
  client: Client,
  siteId: string,
  driveId: string,
  filePath: string,
  content: string,
): Promise<void> {
  // For files < 4MB, use simple upload
  const url = `/sites/${siteId}/drives/${driveId}/root:${filePath}:/content`;

  await client
    .api(url)
    .header('Content-Type', 'text/plain')
    .put(content);
}

/**
 * List the user's upcoming online meetings (helper for discovering meeting IDs).
 */
export async function listOnlineMeetings(
  client: Client,
): Promise<Array<{ subject: string; meetingId: string; joinUrl: string; organizer: string }>> {
  const response = await client
    .api('/me/events')
    .filter('isOnlineMeeting eq true')
    .select('subject,onlineMeeting,organizer,start')
    .orderby('start/dateTime desc')
    .top(25)
    .get();

  return (response.value ?? [])
    .filter((e: Record<string, Record<string, string>>) => e.onlineMeeting?.joinUrl)
    .map((e: Record<string, Record<string, Record<string, string>>>) => ({
      subject: e.subject ?? 'Untitled',
      meetingId: extractMeetingId(e.onlineMeeting?.joinUrl as unknown as string),
      joinUrl: e.onlineMeeting?.joinUrl as unknown as string,
      organizer: (e.organizer as Record<string, Record<string, string>>)?.emailAddress?.name ?? 'Unknown',
    }));
}

/**
 * Extract the online meeting ID from a Teams join URL.
 * The meeting ID is the base64-encoded segment after /meetup-join/ or in the query string.
 */
function extractMeetingId(joinUrl: string): string {
  try {
    const url = new URL(joinUrl);
    // Format: https://teams.microsoft.com/l/meetup-join/ENCODED_MEETING_ID/...
    const pathMatch = url.pathname.match(/\/meetup-join\/([^/]+)/);
    if (pathMatch) {
      return decodeURIComponent(pathMatch[1]);
    }
    return joinUrl; // Fallback: return the full URL
  } catch {
    return joinUrl;
  }
}
