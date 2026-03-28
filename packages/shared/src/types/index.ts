export type UserRole = 'owner' | 'co_owner' | 'admin';

export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole | null;
}
