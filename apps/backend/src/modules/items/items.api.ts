import { Hono } from 'hono';
import {
  createItemInputSchema,
  updateItemInputSchema,
  paginationSchema,
  type JwtPayload,
} from '@repo/shared';
import { db } from '../../infrastructure/db/client';
import { jwtGuard } from '../../middleware/jwt';
import { errorToStatus } from '../../middleware/error-handler';
import { createItemsRepository } from './infrastructure/items.repository';
import { createCreateItem } from './use-cases/create-item';
import { createGetItem } from './use-cases/get-item';
import { createListItems } from './use-cases/list-items';
import { createUpdateItem } from './use-cases/update-item';
import { createActivateItem } from './use-cases/activate-item';
import { createDeactivateItem } from './use-cases/deactivate-item';
import { createDeleteItem } from './use-cases/delete-item';

type Env = { Variables: { jwtPayload: JwtPayload } };

const items = new Hono<Env>();
items.use('*', jwtGuard);

const repository = createItemsRepository(db);
const createItem = createCreateItem(repository);
const getItem = createGetItem(repository);
const listItems = createListItems(repository);
const updateItem = createUpdateItem(repository);
const activateItem = createActivateItem(repository);
const deactivateItem = createDeactivateItem(repository);
const deleteItem = createDeleteItem(repository);

// GET /api/items
items.get('/', async (c) => {
  const { userId } = c.get('jwtPayload');
  const query = c.req.query();
  const parsed = paginationSchema.safeParse(query);
  const { page, limit } = parsed.success ? parsed.data : { page: 1, limit: 20 };

  const result = await listItems(userId, page, limit);
  if (!result.ok) return c.json(result.error, errorToStatus(result.error.code));
  return c.json(result.value);
});

// GET /api/items/:id
items.get('/:id', async (c) => {
  const { userId } = c.get('jwtPayload');
  const { id } = c.req.param();

  const result = await getItem(id, userId);
  if (!result.ok) return c.json(result.error, errorToStatus(result.error.code));
  return c.json(result.value);
});

// POST /api/items
items.post('/', async (c) => {
  const { userId } = c.get('jwtPayload');
  const body = await c.req.json();
  const parsed = createItemInputSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message }, 400);
  }

  const result = await createItem(parsed.data, userId);
  if (!result.ok) return c.json(result.error, errorToStatus(result.error.code));
  return c.json(result.value, 201);
});

// PATCH /api/items/:id
items.patch('/:id', async (c) => {
  const { userId } = c.get('jwtPayload');
  const { id } = c.req.param();
  const body = await c.req.json();
  const parsed = updateItemInputSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message }, 400);
  }

  const result = await updateItem(id, parsed.data, userId);
  if (!result.ok) return c.json(result.error, errorToStatus(result.error.code));
  return c.json(result.value);
});

// POST /api/items/:id/activate
items.post('/:id/activate', async (c) => {
  const { userId } = c.get('jwtPayload');
  const { id } = c.req.param();

  const result = await activateItem(id, userId);
  if (!result.ok) return c.json(result.error, errorToStatus(result.error.code));
  return c.json(result.value);
});

// POST /api/items/:id/deactivate
items.post('/:id/deactivate', async (c) => {
  const { userId } = c.get('jwtPayload');
  const { id } = c.req.param();

  const result = await deactivateItem(id, userId);
  if (!result.ok) return c.json(result.error, errorToStatus(result.error.code));
  return c.json(result.value);
});

// DELETE /api/items/:id
items.delete('/:id', async (c) => {
  const { userId } = c.get('jwtPayload');
  const { id } = c.req.param();

  const result = await deleteItem(id, userId);
  if (!result.ok) return c.json(result.error, errorToStatus(result.error.code));
  return c.body(null, 204);
});

export { items as itemsApi };
