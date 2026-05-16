import { z } from 'zod';

export const contactRedactorSchema = z.object({
  type: z.literal('redactor'),
  email: z.string().email({ message: 'Email inválido' }),
  team: z.string().min(1, { message: 'El equipo es obligatorio' }).max(100),
  htUser: z.string().min(1, { message: 'El usuario de Hattrick es obligatorio' }).max(100),
  motivation: z.string().max(1000).optional(),
});

export const contactErrorSchema = z.object({
  type: z.literal('error'),
  email: z.string().email({ message: 'Email inválido' }),
  errorType: z.enum([
    'datos_incorrectos',
    'error_web',
    'nota_prensa',
    'otro',
  ]),
  description: z.string().min(10, { message: 'La descripción debe tener al menos 10 caracteres' }).max(2000),
  steps: z.string().max(1000).optional(),
  url: z.string().url({ message: 'URL inválida' }).optional().or(z.literal('')),
});

export const contactSchema = z.discriminatedUnion('type', [
  contactRedactorSchema,
  contactErrorSchema,
]);

export type ContactRedactorInput = z.infer<typeof contactRedactorSchema>;
export type ContactErrorInput = z.infer<typeof contactErrorSchema>;
export type ContactInput = z.infer<typeof contactSchema>;
