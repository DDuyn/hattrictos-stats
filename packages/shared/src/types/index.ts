export type UserRole = 'owner' | 'co_owner' | 'admin';

export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole | null;
  /** htTeamId of the team this user can write press notes for, null if none */
  htTeamId: number | null;
}
