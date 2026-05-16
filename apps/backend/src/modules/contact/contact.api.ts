import { Hono } from 'hono';
import { contactSchema, type ContactInput } from '@hattrictos-stats/shared';
import { env } from '../../config/env';

const app = new Hono();

const ERROR_TYPE_LABELS: Record<string, string> = {
  datos_incorrectos: 'Datos incorrectos (resultado, clasificación, estadística...)',
  error_web: 'Error en la web (página no carga, botón roto, diseño roto...)',
  nota_prensa: 'Nota de prensa con contenido incorrecto',
  otro: 'Otro',
};

function buildRedactorIssue(data: Extract<ContactInput, { type: 'redactor' }>) {
  const title = `[Redactor] Solicitud de acceso — ${data.htUser}`;
  const body = [
    '## Solicitud de acceso como redactor',
    '',
    `**Email de contacto:** ${data.email}`,
    `**Usuario de Hattrick:** ${data.htUser}`,
    `**Equipo que quiere cubrir:** ${data.team}`,
    data.motivation ? `\n**Motivación:**\n${data.motivation}` : '',
  ]
    .filter((l) => l !== undefined)
    .join('\n');
  return { title, body, labels: ['redactor'] };
}

function buildErrorIssue(data: Extract<ContactInput, { type: 'error' }>) {
  const title = `[Error] ${ERROR_TYPE_LABELS[data.errorType] ?? data.errorType}`;
  const body = [
    '## Reporte de error',
    '',
    `**Tipo de error:** ${ERROR_TYPE_LABELS[data.errorType] ?? data.errorType}`,
    `**Email de contacto:** ${data.email}`,
    '',
    '**Descripción:**',
    data.description,
    data.steps ? `\n**Pasos para reproducirlo:**\n${data.steps}` : '',
    data.url ? `\n**URL:** ${data.url}` : '',
  ]
    .filter((l) => l !== undefined)
    .join('\n');
  return { title, body, labels: ['bug'] };
}

app.post('/', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ message: parsed.error.issues[0]?.message ?? 'Datos inválidos' }, 400);
  }

  const input = parsed.data;

  if (!env.GITHUB_TOKEN || !env.GITHUB_REPO) {
    return c.json(
      { message: 'El sistema de contacto no está configurado. Por favor, contacta con el administrador.' },
      503,
    );
  }

  const { title, body: issueBody, labels } =
    input.type === 'redactor' ? buildRedactorIssue(input) : buildErrorIssue(input);

  const response = await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}/issues`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({ title, body: issueBody, labels }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    console.error('[contact] GitHub API error', response.status, errText);
    return c.json(
      { message: 'No se pudo enviar el formulario. Inténtalo de nuevo más tarde.' },
      502,
    );
  }

  const issue = (await response.json()) as { number: number; html_url: string };
  return c.json({ issueNumber: issue.number, issueUrl: issue.html_url }, 201);
});

export { app as contactApi };
