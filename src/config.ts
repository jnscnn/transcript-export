import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { existsSync } from 'node:fs';

export interface MeetingConfig {
  name: string;
  meetingId: string;
  organizerId: string;
  outputFolder: string;
}

export interface SharePointConfig {
  siteId: string;
  driveId: string;
  basePath: string;
}

export interface AuthConfig {
  clientId: string;
  tenantId: string;
  tokenCachePath: string;
}

export interface AppConfig {
  auth: AuthConfig;
  sharepoint: SharePointConfig;
  meetings: MeetingConfig[];
  watermarkPath: string;
}

export interface Watermarks {
  [meetingId: string]: string; // ISO date string of last processed transcript
}

function expandHome(p: string): string {
  return p.startsWith('~') ? resolve(homedir(), p.slice(2)) : resolve(p);
}

export async function loadConfig(configPath: string): Promise<AppConfig> {
  const raw = await readFile(resolve(configPath), 'utf-8');
  const config = JSON.parse(raw) as AppConfig;

  config.auth.tokenCachePath = expandHome(config.auth.tokenCachePath);
  config.watermarkPath = expandHome(config.watermarkPath);

  return config;
}

export async function loadWatermarks(watermarkPath: string): Promise<Watermarks> {
  const path = expandHome(watermarkPath);
  if (!existsSync(path)) return {};

  const raw = await readFile(path, 'utf-8');
  return JSON.parse(raw) as Watermarks;
}

export async function saveWatermarks(watermarkPath: string, watermarks: Watermarks): Promise<void> {
  const path = expandHome(watermarkPath);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(watermarks, null, 2), 'utf-8');
}
