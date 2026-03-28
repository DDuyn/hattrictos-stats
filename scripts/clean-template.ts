#!/usr/bin/env bun
/**
 * Clean Template Script
 *
 * Removes the example "items" module and renames the project so you can
 * start fresh with only the auth system and infrastructure in place.
 *
 * Usage:
 *   bun run scripts/clean-template.ts
 *
 * What it does:
 *   1.  Asks for the new project name (e.g. "my-saas")
 *   2.  Deletes apps/backend/src/modules/items/ (entire folder)
 *   3.  Deletes apps/backend/src/tests/items.integration.test.ts
 *   4.  Removes items route from apps/backend/src/app.ts
 *   4.  Removes itemsTable export from infrastructure/db/schema.ts
 *   5.  Deletes packages/shared/src/schemas/item.schema.ts
 *   6.  Removes item schema exports from packages/shared/src/index.ts
 *   7.  Deletes apps/frontend/src/domain/item/ (API, service, validations)
 *   8.  Deletes apps/frontend/src/pages/items/ (controller + view)
 *   9.  Removes /items route and import from apps/frontend/src/index.tsx
 *   10. Removes Items nav entry and BoxIcon from AppLayout.tsx
 *   11. Replaces Home page with a minimal authenticated landing (controller + view)
 *   12. Renames the project in all package.json files (name, devDeps, --filter scripts)
 *   13. Updates @repo/shared imports in all .ts/.tsx source files
 *   14. Updates the service name in render.yaml
 *   15. Deletes the old local.db and migrations (you regenerate after cleanup)
 */

import { rmSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dir, '..');
const BACKEND = resolve(ROOT, 'apps/backend');
const FRONTEND = resolve(ROOT, 'apps/frontend');
const SHARED = resolve(ROOT, 'packages/shared');

let changes = 0;

function log(msg: string) {
  console.log(`  ✓ ${msg}`);
}

function removeDir(path: string, label: string) {
  if (existsSync(path)) {
    rmSync(path, { recursive: true });
    log(label);
    changes++;
  }
}

function removeFile(path: string, label: string) {
  if (existsSync(path)) {
    rmSync(path);
    log(label);
    changes++;
  }
}

async function editFile(path: string, replacements: [string, string][], label: string) {
  if (!existsSync(path)) return;
  let content = await Bun.file(path).text();
  let modified = false;
  for (const [search, replace] of replacements) {
    if (content.includes(search)) {
      content = content.replace(search, replace);
      modified = true;
    }
  }
  if (modified) {
    await Bun.write(path, content);
    log(label);
    changes++;
  }
}

async function replaceInSourceFiles(
  dir: string,
  search: string,
  replace: string,
  label: string,
) {
  const glob = new Bun.Glob('**/*.{ts,tsx}');
  let count = 0;
  for await (const file of glob.scan({ cwd: dir, absolute: true })) {
    let content = await Bun.file(file).text();
    if (content.includes(search)) {
      content = content.replaceAll(search, replace);
      await Bun.write(file, content);
      count++;
    }
  }
  if (count > 0) {
    log(`${label} (${count} file${count > 1 ? 's' : ''})`);
    changes++;
  }
}

async function writeFile(path: string, content: string, label: string) {
  await Bun.write(path, content);
  log(label);
  changes++;
}

// ─── Helpers ─────────────────────────────────────────────────

function toKebabCase(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function prompt(question: string): Promise<string> {
  process.stdout.write(question);
  for await (const line of console) {
    return line.trim();
  }
  return '';
}

// ─── Ask for project name ─────────────────────────────────────

console.log('\n┌─────────────────────────────────────────┐');
console.log('│        bun-monorepo-template setup      │');
console.log('└─────────────────────────────────────────┘\n');

const rawName = await prompt('Project name (e.g. my-saas): ');

if (!rawName) {
  console.error('\n  Error: project name cannot be empty.\n');
  process.exit(1);
}

const projectName = toKebabCase(rawName);

if (projectName !== rawName.trim().toLowerCase()) {
  console.log(`\n  → Name normalized to: "${projectName}"`);
}

console.log(`\nSetting up project "${projectName}"...\n`);

// ─── Step 1: Delete items backend module ─────────────────────

removeDir(
  resolve(BACKEND, 'src/modules/items'),
  'Deleted apps/backend/src/modules/items/',
);

removeFile(
  resolve(BACKEND, 'src/tests/items.integration.test.ts'),
  'Deleted apps/backend/src/tests/items.integration.test.ts',
);

// ─── Step 2: Remove items route from app.ts ──────────────────

await editFile(
  resolve(BACKEND, 'src/app.ts'),
  [
    ["import { itemsApi } from './modules/items/items.api';\n", ''],
    ["  app.route('/api/items', itemsApi);\n", ''],
  ],
  'Removed items route from app.ts',
);

// ─── Step 3: Remove itemsTable from schema barrel ────────────

await editFile(
  resolve(BACKEND, 'src/infrastructure/db/schema.ts'),
  [
    ["export { itemsTable } from '../../modules/items/infrastructure/items.table';\n", ''],
  ],
  'Removed itemsTable from infrastructure/db/schema.ts',
);

// ─── Step 4: Delete item schema file ─────────────────────────

removeFile(
  resolve(SHARED, 'src/schemas/item.schema.ts'),
  'Deleted packages/shared/src/schemas/item.schema.ts',
);

// ─── Step 5: Remove item exports from shared index ───────────

await editFile(
  resolve(SHARED, 'src/index.ts'),
  [
    [
      `\nexport {
  itemStatusSchema,
  createItemInputSchema,
  updateItemInputSchema,
  itemResponseSchema,
  type ItemStatus,
  type CreateItemInput,
  type UpdateItemInput,
  type ItemResponse,
} from './schemas/item.schema';\n`,
      '',
    ],
  ],
  'Removed item exports from packages/shared/src/index.ts',
);

// ─── Step 6: Delete item domain folder ───────────────────────

removeDir(
  resolve(FRONTEND, 'src/domain/item'),
  'Deleted apps/frontend/src/domain/item/',
);

// ─── Step 7: Delete items page folder ────────────────────────

removeDir(
  resolve(FRONTEND, 'src/pages/items'),
  'Deleted apps/frontend/src/pages/items/',
);

// ─── Step 8: Remove /items route from index.tsx ──────────────

await editFile(
  resolve(FRONTEND, 'src/index.tsx'),
  [
    ["import Items from './pages/items/Items';\n", ''],
    ["        <Route path=\"/items\" component={Items} />\n", ''],
  ],
  'Removed /items route from index.tsx',
);

// ─── Step 9: Remove Items nav entry and BoxIcon ───────────────

await editFile(
  resolve(FRONTEND, 'src/components/AppLayout.tsx'),
  [
    [
      `function BoxIcon(props: { class?: string }) {
  return (
    <svg class={props.class} fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
    </svg>
  );
}

`,
      '',
    ],
    [`  { label: 'Items', href: '/items', icon: BoxIcon },\n`, ''],
  ],
  'Removed Items nav entry and BoxIcon from AppLayout.tsx',
);

// ─── Step 10: Replace Home page ───────────────────────────────

await writeFile(
  resolve(FRONTEND, 'src/pages/home/home.ctrl.ts'),
  `import { createStore } from 'solid-js/store';
import type { Navigator } from '@solidjs/router';
import { isAuthenticated } from '../../lib/api-client';

export function createHomeCtrl(navigate: Navigator) {
  const [state, setState] = createStore({
    loading: true,
  });

  async function init() {
    if (!isAuthenticated()) {
      navigate('/login', { replace: true });
      return;
    }
    setState('loading', false);
  }

  return { state, setState, init };
}
`,
  'Replaced home.ctrl.ts with minimal controller',
);

await writeFile(
  resolve(FRONTEND, 'src/pages/home/Home.tsx'),
  `import { onMount } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { createHomeCtrl } from './home.ctrl';

export default function Home() {
  const navigate = useNavigate();
  const ctrl = createHomeCtrl(navigate);

  onMount(() => ctrl.init());

  return (
    <>
      <div class="mb-8">
        <h1 class="text-2xl font-semibold text-gray-900">Home</h1>
        <p class="text-sm text-gray-500 mt-0.5">Start building your app</p>
      </div>
      <p class="text-gray-600 text-sm">Welcome! Add your features here.</p>
    </>
  );
}
`,
  'Replaced Home.tsx with minimal landing page',
);

// ─── Step 11: Rename project in package.json files ────────────

async function renameInPackageJson(path: string, replacements: [string, string][], label: string) {
  if (!existsSync(path)) return;
  const raw = await Bun.file(path).text();
  let content = raw;
  let modified = false;
  for (const [from, to] of replacements) {
    // Replace all occurrences as plain text to cover name, devDependencies keys, and script --filter values
    if (content.includes(from)) {
      content = content.replaceAll(from, to);
      modified = true;
    }
  }
  if (modified) {
    await Bun.write(path, content);
    log(label);
    changes++;
  }
}

await renameInPackageJson(
  resolve(ROOT, 'package.json'),
  [
    ['bun-monorepo-template', projectName],
    ['--filter backend', `--filter ${projectName}-api`],
    ['--filter frontend', `--filter ${projectName}-web`],
    ['"backend": "workspace:*"', `"${projectName}-api": "workspace:*"`],
  ],
  `Renamed root package.json → "${projectName}"`,
);

await renameInPackageJson(
  resolve(BACKEND, 'package.json'),
  [['backend', `${projectName}-api`]],
  `Renamed backend package.json → "${projectName}-api"`,
);

await renameInPackageJson(
  resolve(FRONTEND, 'package.json'),
  [['frontend', `${projectName}-web`]],
  `Renamed frontend package.json → "${projectName}-web"`,
);

await renameInPackageJson(
  resolve(SHARED, 'package.json'),
  [['@repo/shared', `@${projectName}/shared`]],
  `Renamed shared package.json → "@${projectName}/shared"`,
);

// ─── Step 12: Replace @repo/shared imports in source files ───

await replaceInSourceFiles(
  resolve(ROOT, 'apps'),
  '@repo/shared',
  `@${projectName}/shared`,
  `Updated @repo/shared imports → "@${projectName}/shared" in apps/`,
);

await replaceInSourceFiles(
  resolve(ROOT, 'packages'),
  '@repo/shared',
  `@${projectName}/shared`,
  `Updated @repo/shared imports → "@${projectName}/shared" in packages/`,
);

// ─── Step 13: Update render.yaml service name ─────────────────

await editFile(
  resolve(ROOT, 'render.yaml'),
  [['    name: api\n', `    name: ${projectName}-api\n`]],
  `Updated render.yaml service name → "${projectName}-api"`,
);

// ─── Step 14: Delete old database and migrations ──────────────

removeFile(
  resolve(BACKEND, 'local.db'),
  'Deleted local.db',
);
removeDir(
  resolve(BACKEND, 'src/infrastructure/db/migrations'),
  'Deleted old migrations',
);

// ─── Summary ──────────────────────────────────────────────────

if (changes > 0) {
  console.log(`\nDone! ${changes} changes applied.\n`);
  console.log('Next steps:');
  console.log('  1. bun install            # Update workspace references after rename');
  console.log('  2. bun run db:generate    # Generate migration for the clean schema');
  console.log('  3. bun run db:migrate     # Apply migrations to local database');
  console.log('  4. bun run dev            # Start building\n');
} else {
  console.log('\nNothing to clean — template already set up.\n');
}
