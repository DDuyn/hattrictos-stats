import {
  type AppError,
  err,
  ok,
  type Result,
  unauthorizedError,
} from "@hattrictos-stats/shared";
import type {
  ChppClient,
  OAuthAccessToken,
} from "../../../infrastructure/chpp/chpp-client";
import type { ChppTokenRepository } from "../infrastructure/chpp-token.repository";
import { oauthStateStore } from "../infrastructure/oauth-state-store";

export interface HandleOAuthCallbackInput {
  /** The state value we included in the callback URL (CSRF check) */
  state: string;
  /** The oauth_token returned by Hattrick (must match our stored request token) */
  oauthToken: string;
  /** The verifier returned by Hattrick after the admin authorises */
  oauthVerifier: string;
}

export interface HandleOAuthCallbackOutput {
  htLoginName: string | null;
  htUserId: string | null;
}

export type HandleOAuthCallback = (
  input: HandleOAuthCallbackInput,
) => Promise<Result<HandleOAuthCallbackOutput, AppError>>;

/**
 * Completes the CHPP OAuth 1.0a flow.
 *
 * 1. Validates the `state` parameter (CSRF protection)
 * 2. Verifies the oauth_token matches what we sent in step 1
 * 3. Exchanges the verifier for a permanent access token
 * 4. Encrypts and stores the token in the database
 *
 * After this succeeds, the backend can make CHPP API calls using the stored token.
 */
export function createHandleOAuthCallback(
  chppClient: ChppClient,
  tokenRepository: ChppTokenRepository,
): HandleOAuthCallback {
  return async (
    input: HandleOAuthCallbackInput,
  ): Promise<Result<HandleOAuthCallbackOutput, AppError>> => {
    // Step 1: Validate state (CSRF protection) and retrieve the stored request token
    const pending = oauthStateStore.consume(input.state);
    if (!pending) {
      return err(
        unauthorizedError(
          "Invalid or expired OAuth state. Please restart the connection flow.",
        ),
      );
    }

    // Step 2: Verify the oauth_token matches what we sent
    if (input.oauthToken !== pending.requestToken) {
      return err(
        unauthorizedError(
          "OAuth token mismatch. The callback token does not match the initiated flow.",
        ),
      );
    }

    // Step 3: Exchange verifier for access token
    const accessTokenResult = await chppClient.getAccessToken(
      { token: pending.requestToken, tokenSecret: pending.requestTokenSecret },
      input.oauthVerifier,
    );
    if (!accessTokenResult.ok) return accessTokenResult;

    const accessToken: OAuthAccessToken = accessTokenResult.value;

    // Step 4: Encrypt and persist the token
    await tokenRepository.upsert(accessToken);

    // NOTE: htLoginName and htUserId are NOT available from the access token response.
    // They are read from the teamdetails endpoint — call /api/admin/chpp/verify to get them.
    return ok({
      htLoginName: null,
      htUserId: null,
    });
  };
}
