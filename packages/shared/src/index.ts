export { type Result, ok, err, isOk, isErr, unwrap, map } from './result';
export {
  type AppError,
  type ErrorCode,
  validationError,
  notFoundError,
  unauthorizedError,
  conflictError,
  internalError,
  chppError,
  chppRateLimitedError,
} from './result';

export type { JwtPayload } from './types/index';

export {
  loginInputSchema,
  registerInputSchema,
  authResponseSchema,
  createUserInputSchema,
  createUserResponseSchema,
  changePasswordInputSchema,
  userRoleSchema,
  type LoginInput,
  type RegisterInput,
  type AuthResponse,
  type CreateUserInput,
  type CreateUserResponse,
  type ChangePasswordInput,
} from './schemas/auth.schema';

export type { UserRole } from './types/index';

export {
  idParamSchema,
  paginationSchema,
  type IdParam,
  type PaginationInput,
  type PaginatedResponse,
} from './schemas/common.schema';
