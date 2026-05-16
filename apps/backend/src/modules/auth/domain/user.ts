import { type Result, ok, validationError } from '@hattrictos-stats/shared';
import type { AppError, UserRole } from '@hattrictos-stats/shared';

export interface UserProps {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  role: UserRole | null;
  htTeamId: number | null;
  createdAt: Date;
}

export class User {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly passwordHash: string;
  readonly role: UserRole | null;
  readonly htTeamId: number | null;
  readonly createdAt: Date;

  private constructor(props: UserProps) {
    this.id = props.id;
    this.email = props.email;
    this.name = props.name;
    this.passwordHash = props.passwordHash;
    this.role = props.role;
    this.htTeamId = props.htTeamId;
    this.createdAt = props.createdAt;
  }

  static create(props: UserProps): Result<User, AppError> {
    if (!props.email.includes('@')) {
      return { ok: false, error: validationError('Invalid email format') };
    }
    if (props.name.trim().length === 0) {
      return { ok: false, error: validationError('Name cannot be empty') };
    }
    return ok(new User(props));
  }

  static fromPersistence(props: UserProps): User {
    return new User(props);
  }

  toResponse() {
    return {
      id: this.id,
      email: this.email,
      name: this.name,
      role: this.role,
      htTeamId: this.htTeamId,
    };
  }
}
