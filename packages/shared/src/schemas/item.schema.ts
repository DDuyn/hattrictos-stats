import { z } from 'zod';

export const itemStatusSchema = z.enum(['active', 'inactive']);

export const createItemInputSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).default(''),
});

export const updateItemInputSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
});

export const itemResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  status: itemStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type ItemStatus = z.infer<typeof itemStatusSchema>;
export type CreateItemInput = z.infer<typeof createItemInputSchema>;
export type UpdateItemInput = z.infer<typeof updateItemInputSchema>;
export type ItemResponse = z.infer<typeof itemResponseSchema>;
