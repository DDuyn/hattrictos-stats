import { type AppError, ok, type Result } from "@hattrictos-stats/shared";
import type { ChppClient } from "../../../infrastructure/chpp/chpp-client";
import { oauthStateStore } from "../infrastructure/oauth-state-store";

export interface StartOAuthOutput {
  /** URL the admin should be redirected to in order to authorise the app */
  authorizeUrl: string;
}

export type StartOAuth = (
  appUrl: string,
) => Promise<Result<StartOAuthOutput, AppError>>;

/**
 * Initiates the CHPP OAuth 1.0a flow.
 *
 * 1. Requests a request token from CHPP
 * 2. Generates a random `state` for CSRF protection
 * 3. Stores the request token secret in memory (TTL 10 min)
 * 4. Returns the Hattrick authorize URL (with state embedded in the callback)
 *
 * The admin must be redirected to the returned URL to authorise the app.
 * After authorising, Hattrick will redirect to /api/admin/chpp/callback with
 * oauth_token and oauth_verifier query params.
 */
export function createStartOAuth(chppClient: ChppClient): StartOAuth {
  return async (
    appUrl: string,
  ): Promise<Result<StartOAuthOutput, AppError>> => {
    // Generate a cryptographically random state for CSRF protection
    const state = crypto.randomUUID();

    const callbackUrl = `${appUrl}/api/admin/chpp/callback?state=${encodeURIComponent(state)}`;

    const result = await chppClient.getRequestToken(callbackUrl);
    if (!result.ok) return result;

    const { requestToken, authorizeUrl } = result.value;

    // Store the request token secret keyed by state — consumed on callback
    oauthStateStore.set(state, {
      requestToken: requestToken.token,
      requestTokenSecret: requestToken.tokenSecret,
    });

    return ok({ authorizeUrl });
  };
}
