#!/usr/bin/env node
/**
 * ODIN Schema Code Generator CLI
 *
 * Generates typed classes, builders, and tests from .schema.odin files.
 *
 * Usage:
 *   npx tsx src/cli.ts --schemas ../../schemas --output ./output --lang typescript
 *   npx tsx src/cli.ts --schemas ../../schemas --output ./output --lang typescript --tests ./tests
 */

import { generateAll } from './codegen.js';

const args = process.argv.slice(2);

function getArg(name: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 ? args[idx + 1] : undefined;
}

const schemasDir = getArg('schemas');
const outputDir = getArg('output') ?? './output';
const testsDir = getArg('tests');
const lang = getArg('lang') ?? 'typescript';

if (!schemasDir) {
  console.error('Usage: odin-codegen --schemas <path> [--output <path>] [--tests <path>] [--lang typescript]');
  console.error('');
  console.error('Options:');
  console.error('  --schemas <path>   Path to ODIN schemas directory (required)');
  console.error('  --output <path>    Output directory for generated code (default: ./output)');
  console.error('  --tests <path>     Output directory for generated tests (optional)');
  console.error('  --lang <lang>      Target language: typescript (default: typescript)');
  process.exit(1);
}

generateAll({ schemasDir, outputDir, testsDir, lang }).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
