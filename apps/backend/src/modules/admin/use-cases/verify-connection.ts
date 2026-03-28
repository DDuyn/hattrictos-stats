import {
  type Result,
  type AppError,
  ok,
  err,
  notFoundError,
} from '@hattrictos-stats/shared';
import type { ChppTokenRepository } from '../infrastructure/chpp-token.repository';
import { createChppClient } from '../../../infrastructure/chpp/chpp-client';

export interface VerifyConnectionOutput {
  teamId: number | null;
  teamName: string | null;
  htLoginName: string | null;
  htUserId: string | null;
}

export type VerifyConnection = () => Promise<Result<VerifyConnectionOutput, AppError>>;

/**
 * Verifies that the stored CHPP token is valid and working by calling
 * teamdetails without a teamID (CHPP returns the token owner's team).
 *
 * Also reads UserID and Loginname from the XML response — Hattrick does NOT
 * return those fields in the access_token.ashx response, only in API calls.
 *
 * This confirms:
 * 1. A token exists in the database
 * 2. The token has not been revoked on Hattrick's side
 * 3. The full chain works: DB → decrypt → OAuth sign → CHPP API → XML parse
 */
export function createVerifyConnection(
  chppClientConfig: { consumerKey: string; consumerSecret: string },
  tokenRepository: ChppTokenRepository,
): VerifyConnection {
  return async (): Promise<Result<VerifyConnectionOutput, AppError>> => {
    const activeToken = await tokenRepository.getActive();
    if (!activeToken) {
      return err(
        notFoundError(
          'No active CHPP token found. Please connect via /api/admin/chpp/connect.',
        ),
      );
    }

    const client = createChppClient({
      ...chppClientConfig,
      accessToken: activeToken.accessToken,
      accessTokenSecret: activeToken.accessTokenSecret,
    });

    // teamdetails without teamID → returns the token owner's data
    const result = await client.fetch({ file: 'teamdetails' });
    if (!result.ok) return result;

    const data = result.value as {
      HattrickData?: {
        UserID?: number;
        User?: { UserID?: number; Loginname?: string };
        Team?: { TeamID?: number; TeamName?: string };
      };
    };

    const user = data.HattrickData?.User;
    const team = data.HattrickData?.Team;

    // UserID appears at root level and inside <User>; Loginname is inside <User>
    const htUserId = String(user?.UserID ?? data.HattrickData?.UserID ?? '');
    const htLoginName = user?.Loginname ?? null;

    return ok({
      teamId: team?.TeamID ?? null,
      teamName: team?.TeamName ?? null,
      htLoginName,
      htUserId: htUserId || null,
    });
  };
}
