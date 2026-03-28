import { type Result, ok, validationError } from '@repo/shared';
import type { AppError } from '@repo/shared';

export interface UserProps {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  createdAt: Date;
}

export class User {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly passwordHash: string;
  readonly createdAt: Date;

  private constructor(props: UserProps) {
    this.id = props.id;
    this.email = props.email;
    this.name = props.name;
    this.passwordHash = props.passwordHash;
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
    };
  }
}
