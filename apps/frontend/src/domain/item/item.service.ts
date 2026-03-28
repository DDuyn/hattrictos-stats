import {
  type ItemResponse,
  type PaginatedResponse,
  type AppError,
  ok,
  internalError,
} from '@repo/shared';
import { type FieldErrors } from '../validation';
import { validateCreateItemInput } from './item.validations';
import { itemsApi } from './item.api';

export type ItemServiceResult<T> =
  | { ok: true; value: T }
  | { ok: false; fieldErrors: FieldErrors }
  | { ok: false; error: AppError };

export async function createItem(
  name: string,
  description?: string,
): Promise<ItemServiceResult<ItemResponse>> {
  const validation = validateCreateItemInput(name, description);
  if (!validation.ok) return validation;

  try {
    const response = await itemsApi.create(validation.value);
    return ok(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Something went wrong';
    return { ok: false, error: internalError(message) };
  }
}

export async function listItems(
  page = 1,
  limit = 20,
): Promise<{ ok: true; value: PaginatedResponse<ItemResponse> } | { ok: false; error: AppError }> {
  try {
    const response = await itemsApi.list(page, limit);
    return ok(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Something went wrong';
    return { ok: false, error: internalError(message) };
  }
}

export async function toggleItem(
  item: ItemResponse,
): Promise<{ ok: true; value: ItemResponse } | { ok: false; error: AppError }> {
  try {
    const response =
      item.status === 'active'
        ? await itemsApi.deactivate(item.id)
        : await itemsApi.activate(item.id);
    return ok(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Something went wrong';
    return { ok: false, error: internalError(message) };
  }
}

export async function deleteItem(
  id: string,
): Promise<{ ok: true; value: void } | { ok: false; error: AppError }> {
  try {
    await itemsApi.delete(id);
    return ok(undefined);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Something went wrong';
    return { ok: false, error: internalError(message) };
  }
}
