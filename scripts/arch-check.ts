#!/usr/bin/env bun
/**
 * Architecture Check Script
 *
 * Validates that source code follows the project's architectural rules.
 * Runs as part of the pre-push hook and CI pipeline.
 * Zero external dependencies — pure Bun.Glob + regex.
 *
 * Rules enforced:
 *   1. No `throw` statements inside use-cases/ (must use Result pattern)
 *   2. No `class ` declarations outside domain/ (must use factory functions)
 *   3. No `console.log` in production source (use structured logger instead)
 */

import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dir, '..');
const APPS = resolve(ROOT, 'apps');

type Violation = { file: string; line: number; rule: string; snippet: string };

const violations: Violation[] = [];
let filesChecked = 0;

function rel(path: string) {
  return path.replace(`${ROOT}/`, '');
}

async function checkFile(
  filePath: string,
  checks: { rule: string; pattern: RegExp; skip?: (line: string, filePath: string) => boolean }[],
) {
  const text = await Bun.file(filePath).text();
  const lines = text.split('\n');
  filesChecked++;

  for (const check of checks) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (check.pattern.test(line)) {
        if (check.skip?.(line, filePath)) continue;
        violations.push({
          file: rel(filePath),
          line: i + 1,
          rule: check.rule,
          snippet: line.trim(),
        });
      }
    }
  }
}

// ─── Rule 1: No throw in use-cases/ ──────────────────────────
// use-cases must return Result<T, E>, never throw

const useCasesGlob = new Bun.Glob('**/use-cases/**/*.ts');

for await (const file of useCasesGlob.scan({ cwd: APPS, absolute: true })) {
  // Skip test files
  if (file.includes('.test.') || file.includes('.spec.')) continue;
  await checkFile(file, [
    {
      rule: 'no-throw-in-use-cases',
      pattern: /\bthrow\b/,
      skip: (line) => line.trim().startsWith('//') || line.trim().startsWith('*'),
    },
  ]);
}

// ─── Rule 2: No class outside domain/ ────────────────────────
// Only domain entities may use classes; everything else uses factory functions

const modulesGlob = new Bun.Glob('**/modules/**/*.ts');

for await (const file of modulesGlob.scan({ cwd: APPS, absolute: true })) {
  // Allow classes in domain/ (entities use class + private constructor)
  if (file.includes('/domain/')) continue;
  // Skip test files
  if (file.includes('.test.') || file.includes('.spec.')) continue;
  await checkFile(file, [
    {
      rule: 'no-class-outside-domain',
      pattern: /^\s*(export\s+)?(abstract\s+)?class\s+/,
      skip: (line) => line.trim().startsWith('//') || line.trim().startsWith('*'),
    },
  ]);
}

// ─── Rule 3: No console.log in production source ─────────────
// Use the structured logger (c.var.log) instead

const sourceGlob = new Bun.Glob('**/*.{ts,tsx}');

for await (const file of sourceGlob.scan({ cwd: APPS, absolute: true })) {
  // Skip test files, setup files, and the logger itself (which wraps console)
  if (file.includes('.test.') || file.includes('.spec.')) continue;
  if (file.includes('/tests/setup.') || file.includes('/tests/test-helpers.')) continue;
  if (file.endsWith('/middleware/logger.ts')) continue;
  // Skip entry point startup log (src/index.ts)
  if (file.endsWith('/src/index.ts')) continue;
  await checkFile(file, [
    {
      rule: 'no-console-log',
      pattern: /\bconsole\.log\s*\(/,
      skip: (line) => line.trim().startsWith('//') || line.trim().startsWith('*'),
    },
  ]);
}

// ─── Report ───────────────────────────────────────────────────

const RULE_DESCRIPTIONS: Record<string, string> = {
  'no-throw-in-use-cases': 'Use-cases must return Result<T,E>, not throw. Replace with err(appError(...))',
  'no-class-outside-domain': 'Use factory functions outside domain/. Replace class with a factory function',
  'no-console-log': 'Use structured logger (c.var.log) instead of console.log in production source',
};

if (violations.length === 0) {
  console.log(`  ✓ arch-check passed (${filesChecked} files checked)`);
  process.exit(0);
}

console.error(`\n  ✗ arch-check failed — ${violations.length} violation${violations.length > 1 ? 's' : ''} found:\n`);

const byRule = violations.reduce(
  (acc, v) => {
    acc[v.rule] = acc[v.rule] ?? [];
    acc[v.rule].push(v);
    return acc;
  },
  {} as Record<string, Violation[]>,
);

for (const [rule, vs] of Object.entries(byRule)) {
  console.error(`  [${rule}]`);
  console.error(`  → ${RULE_DESCRIPTIONS[rule]}\n`);
  for (const v of vs) {
    console.error(`    ${v.file}:${v.line}`);
    console.error(`    ${v.snippet}\n`);
  }
}

process.exit(1);
