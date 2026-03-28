/**
 * In-memory store for OAuth 1.0a state during the authorization flow.
 *
 * The OAuth flow has a ~2-minute window between:
 *   Step 1: backend requests a request token (generates state + stores token secret)
 *   Step 3: Hattrick redirects back with oauth_token + oauth_verifier
 *
 * We store a random `state` value alongside the request token secret.
 * The state is included in the callback URL and verified when Hattrick returns,
 * preventing CSRF attacks on the callback endpoint.
 *
 * Entries expire automatically after OAUTH_STATE_TTL_MS to prevent memory leaks
 * if the admin starts the flow but never completes it.
 */

export interface OAuthPendingState {
  requestToken: string;
  requestTokenSecret: string;
  expiresAt: number;
}

const OAUTH_STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// Module-level singleton — shared between start-oauth and handle-oauth-callback
const pendingStates = new Map<string, OAuthPendingState>();

export const oauthStateStore = {
  set(state: string, data: Omit<OAuthPendingState, 'expiresAt'>): void {
    // Clean up any expired entries before adding a new one
    const now = Date.now();
    for (const [key, value] of pendingStates) {
      if (value.expiresAt <= now) {
        pendingStates.delete(key);
      }
    }

    pendingStates.set(state, {
      ...data,
      expiresAt: now + OAUTH_STATE_TTL_MS,
    });
  },

  get(state: string): OAuthPendingState | null {
    const entry = pendingStates.get(state);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      pendingStates.delete(state);
      return null;
    }
    return entry;
  },

  consume(state: string): OAuthPendingState | null {
    const entry = this.get(state);
    if (entry) pendingStates.delete(state);
    return entry;
  },

  /** Exposed for testing only */
  clear(): void {
    pendingStates.clear();
  },
};
