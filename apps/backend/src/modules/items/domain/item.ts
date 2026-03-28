import {
  type Result,
  type AppError,
  type ItemStatus,
  type ItemResponse,
  ok,
  err,
  validationError,
} from '@repo/shared';

export interface ItemProps {
  id: string;
  name: string;
  description: string;
  status: ItemStatus;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export class Item {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  private _status: ItemStatus;
  readonly userId: string;
  readonly createdAt: Date;
  private _updatedAt: Date;

  private constructor(props: ItemProps) {
    this.id = props.id;
    this.name = props.name;
    this.description = props.description;
    this._status = props.status;
    this.userId = props.userId;
    this.createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
  }

  get status(): ItemStatus {
    return this._status;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  get isActive(): boolean {
    return this._status === 'active';
  }

  static create(
    name: string,
    description: string,
    userId: string,
  ): Result<Item, AppError> {
    if (name.trim().length === 0) {
      return err(validationError('Item name cannot be empty'));
    }
    if (name.length > 200) {
      return err(validationError('Item name cannot exceed 200 characters'));
    }
    if (description.length > 1000) {
      return err(validationError('Item description cannot exceed 1000 characters'));
    }

    const now = new Date();
    return ok(
      new Item({
        id: crypto.randomUUID(),
        name: name.trim(),
        description: description.trim(),
        status: 'inactive',
        userId,
        createdAt: now,
        updatedAt: now,
      }),
    );
  }

  static fromPersistence(props: ItemProps): Item {
    return new Item(props);
  }

  activate(): Result<Item, AppError> {
    if (this._status === 'active') {
      return err(validationError('Item is already active'));
    }
    this._status = 'active';
    this._updatedAt = new Date();
    return ok(this);
  }

  deactivate(): Result<Item, AppError> {
    if (this._status === 'inactive') {
      return err(validationError('Item is already inactive'));
    }
    this._status = 'inactive';
    this._updatedAt = new Date();
    return ok(this);
  }

  updateDetails(
    name?: string,
    description?: string,
  ): Result<Item, AppError> {
    if (name !== undefined) {
      if (name.trim().length === 0) {
        return err(validationError('Item name cannot be empty'));
      }
      if (name.length > 200) {
        return err(validationError('Item name cannot exceed 200 characters'));
      }
    }
    if (description !== undefined && description.length > 1000) {
      return err(validationError('Item description cannot exceed 1000 characters'));
    }

    return ok(
      new Item({
        id: this.id,
        name: name !== undefined ? name.trim() : this.name,
        description: description !== undefined ? description.trim() : this.description,
        status: this._status,
        userId: this.userId,
        createdAt: this.createdAt,
        updatedAt: new Date(),
      }),
    );
  }

  toResponse(): ItemResponse {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      status: this._status,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this._updatedAt.toISOString(),
    };
  }
}
