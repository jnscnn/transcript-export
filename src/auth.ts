import {
  PublicClientApplication,
  CryptoProvider,
  type AuthenticationResult,
  type AccountInfo,
} from '@azure/msal-node';
import { Client } from '@microsoft/microsoft-graph-client';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { existsSync } from 'node:fs';
import type { AuthConfig } from './config.js';

const SCOPES = [
  'User.Read',
  'OnlineMeetings.Read',
  'OnlineMeetingTranscript.Read.All',
  'Calendars.Read',
  'Sites.ReadWrite.All',
];

/**
 * Build an MSAL PublicClientApplication with persistent token cache.
 */
async function buildMsalApp(config: AuthConfig): Promise<PublicClientApplication> {
  const pca = new PublicClientApplication({
    auth: {
      clientId: config.clientId,
      authority: `https://login.microsoftonline.com/${config.tenantId}`,
    },
  });

  // Load cached tokens if available
  if (existsSync(config.tokenCachePath)) {
    const cacheData = await readFile(config.tokenCachePath, 'utf-8');
    pca.getTokenCache().deserialize(cacheData);
  }

  return pca;
}

/**
 * Persist the token cache to disk after acquiring tokens.
 */
async function persistCache(pca: PublicClientApplication, cachePath: string): Promise<void> {
  const cacheData = pca.getTokenCache().serialize();
  await mkdir(dirname(cachePath), { recursive: true });
  await writeFile(cachePath, cacheData, 'utf-8');
}

/**
 * Acquire a token silently (cached) or interactively (device-code flow).
 */
async function acquireToken(
  pca: PublicClientApplication,
  config: AuthConfig,
  silent: boolean,
): Promise<AuthenticationResult> {
  // Try silent acquisition first
  const accounts = await pca.getTokenCache().getAllAccounts();
  if (accounts.length > 0) {
    try {
      const result = await pca.acquireTokenSilent({
        account: accounts[0] as AccountInfo,
        scopes: SCOPES,
      });
      await persistCache(pca, config.tokenCachePath);
      return result;
    } catch {
      // Silent failed — fall through to interactive
    }
  }

  if (silent) {
    throw new Error(
      'No cached token available and --silent mode is enabled. Run interactively first to authenticate.',
    );
  }

  // Device-code flow — user must visit a URL and enter a code
  const result = await pca.acquireTokenByDeviceCode({
    scopes: SCOPES,
    deviceCodeCallback: (response) => {
      console.log('\n🔐 Authentication required:');
      console.log(response.message);
      console.log();
    },
  });

  if (!result) {
    throw new Error('Device-code authentication failed — no token received.');
  }

  await persistCache(pca, config.tokenCachePath);
  return result;
}

/**
 * Get an authenticated Microsoft Graph client using device-code flow.
 *
 * First run: prompts user to visit https://microsoft.com/devicelogin
 * Subsequent runs: uses cached refresh token (silent).
 */
export async function getGraphClient(
  config: AuthConfig,
  silent: boolean = false,
): Promise<Client> {
  const pca = await buildMsalApp(config);
  const authResult = await acquireToken(pca, config, silent);

  return Client.init({
    authProvider: (done) => {
      done(null, authResult.accessToken);
    },
  });
}
