/**
 * ODIN Schema Code Generator
 *
 * Reads .schema.odin files and generates typed code + tests.
 * Adapted from working/generate-schema-api.ts for standalone CLI use.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { Odin } from '@odin-foundation/core';
import type { OdinSchema, SchemaType, SchemaField, SchemaFieldType } from '@odin-foundation/core';
import { generateTypeScript } from './generators/typescript.js';
import { generateCSharp } from './generators/csharp.js';
import { generateJava } from './generators/java.js';
import { generatePython } from './generators/python.js';
import { generateRuby } from './generators/ruby.js';
import { generateRust } from './generators/rust.js';
import { generateTests } from './generators/tests.js';
import { generateCSharpTests } from './generators/tests-csharp.js';
import { generateJavaTests } from './generators/tests-java.js';
import { generatePythonTests } from './generators/tests-python.js';
import { generateRubyTests } from './generators/tests-ruby.js';
import { generateRustTests, generateInlineRustTests } from './generators/tests-rust.js';
import type { ParsedSchemaFile, ResolvedType } from './types.js';

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export interface CodegenOptions {
  schemasDir: string;
  outputDir: string;
  testsDir?: string;
  lang: string;
}

export async function generateAll(opts: CodegenOptions): Promise<void> {
  const schemasDir = path.resolve(opts.schemasDir);
  const outputDir = path.resolve(opts.outputDir);
  const testsDir = opts.testsDir ? path.resolve(opts.testsDir) : undefined;

  console.log('ODIN Schema Code Generator');
  console.log('==========================');
  console.log(`Schemas:  ${schemasDir}`);
  console.log(`Output:   ${outputDir}`);
  if (testsDir) console.log(`Tests:    ${testsDir}`);
  console.log(`Language: ${opts.lang}`);
  console.log('');

  // Discover
  console.log('Discovering schema files...');
  const schemaFiles = await discoverSchemaFiles(schemasDir);
  console.log(`  Found ${schemaFiles.length} schema files`);

  // Parse
  console.log('Parsing schemas...');
  const parsedSchemas = new Map<string, ParsedSchemaFile>();
  const successfulSchemas: ParsedSchemaFile[] = [];

  for (const file of schemaFiles) {
    try {
      const parsed = await parseSchemaFile(schemasDir, file);
      parsedSchemas.set(parsed.namespaceId, parsed);
      successfulSchemas.push(parsed);
    } catch (error) {
      console.error(`  Error parsing ${file}:`, error);
    }
  }
  console.log(`  Successfully parsed ${successfulSchemas.length} schemas`);

  // Deduplicate
  const seenOutputPaths = new Set<string>();
  const uniqueSchemas: ParsedSchemaFile[] = [];
  for (const schema of successfulSchemas) {
    if (!seenOutputPaths.has(schema.outputPath)) {
      seenOutputPaths.add(schema.outputPath);
      uniqueSchemas.push(schema);
    }
  }

  const schemasWithTypes = uniqueSchemas.filter((s) => s.types.size > 0);

  // Clean and generate
  console.log('');
  console.log('Cleaning output directory...');
  try { await fs.rm(outputDir, { recursive: true, force: true }); } catch {}
  await fs.mkdir(outputDir, { recursive: true });

  console.log('Generating code...');
  let generatedCount = 0;

  const LANG_EXT: Record<string, string> = {
    typescript: '.ts', csharp: '.cs', java: '.java', python: '.py', ruby: '.rb', rust: '.rs'
  };
  const LANG_GEN: Record<string, (p: ParsedSchemaFile, a: Map<string, ParsedSchemaFile>) => string> = {
    typescript: generateTypeScript,
    csharp: generateCSharp,
    java: generateJava,
    python: generatePython,
    ruby: generateRuby,
    rust: generateRust,
  };

  const ext = LANG_EXT[opts.lang];
  const gen = LANG_GEN[opts.lang];
  if (!ext || !gen) {
    console.error(`  Language '${opts.lang}' not supported. Available: ${Object.keys(LANG_EXT).join(', ')}`);
    process.exit(1);
  }

  for (const parsed of schemasWithTypes) {
    try {
      const code = gen(parsed, parsedSchemas);
      if (!code) continue;

      let relPath = parsed.outputPath.replace(/\.ts$/, ext);
      // Rust requires underscores in file/module names, and no keywords as filenames
      if (opts.lang === 'rust') {
        const RUST_KW = new Set(['return', 'type', 'self', 'super', 'crate', 'mod', 'fn', 'struct', 'enum', 'trait', 'impl', 'pub', 'use', 'let', 'mut', 'const', 'static', 'ref', 'if', 'else', 'match', 'for', 'while', 'loop', 'break', 'continue', 'move', 'box', 'where', 'async', 'await', 'dyn', 'abstract', 'become', 'do', 'final', 'macro', 'override', 'priv', 'typeof', 'unsized', 'virtual', 'yield', 'try', 'union', 'as', 'in']);
        relPath = relPath.replace(/-/g, '_').split('/').map(p => {
          const base = p.replace(/\.rs$/, '');
          return RUST_KW.has(base) ? base + '_.rs' : p;
        }).join('/');
      }
      // Python requires underscores in module names, not hyphens, and no reserved words
      if (opts.lang === 'python') {
        const PY_RESERVED = new Set(['return', 'class', 'import', 'from', 'pass', 'raise', 'yield', 'def', 'del', 'global', 'nonlocal', 'assert', 'break', 'continue']);
        relPath = relPath.replace(/-/g, '_').split('/').map(p => {
          const base = p.replace(/\.py$/, '');
          return PY_RESERVED.has(base) ? base + '_.py' : p;
        }).join('/');
      }
      const outPath = path.join(outputDir, relPath);
      await fs.mkdir(path.dirname(outPath), { recursive: true });

      // Rust: append inline tests to source file
      let finalCode = code;
      if (opts.lang === 'rust' && testsDir) {
        const inlineTests = generateInlineRustTests(parsed, parsedSchemas);
        if (inlineTests) finalCode += '\n' + inlineTests;
      }

      await fs.writeFile(outPath, finalCode, 'utf-8');
      generatedCount++;
    } catch (error) {
      console.error(`  Error generating ${parsed.outputPath}:`, error);
    }
  }

  if (opts.lang === 'typescript') {
    await generateBarrelExport(outputDir, schemasWithTypes);
  }

  // Python needs __init__.py in every directory for imports to work
  if (opts.lang === 'python') {
    const dirs = new Set<string>();
    for (const parsed of schemasWithTypes) {
      const outPath = path.join(outputDir, parsed.outputPath.replace(/\.ts$/, '.py').replace(/-/g, '_'));
      let dir = path.dirname(outPath);
      while (dir !== outputDir && dir.startsWith(outputDir)) {
        dirs.add(dir);
        dir = path.dirname(dir);
      }
    }
    await fs.writeFile(path.join(outputDir, '__init__.py'), '', 'utf-8');
    for (const dir of dirs) {
      const initPath = path.join(dir, '__init__.py');
      try { await fs.access(initPath); } catch { await fs.writeFile(initPath, '', 'utf-8'); }
    }
  }

  console.log(`  Generated ${generatedCount} modules`);

  // Tests
  if (testsDir) {
    console.log('');
    const LANG_TEST_GEN: Record<string, (testsDir: string, schemasDir: string, schemas: ParsedSchemaFile[], allSchemas: Map<string, ParsedSchemaFile>) => Promise<void>> = {
      typescript: generateTests,
      csharp: generateCSharpTests,
      java: generateJavaTests,
      python: generatePythonTests,
      ruby: generateRubyTests,
      rust: generateRustTests,
    };
    const testGen = LANG_TEST_GEN[opts.lang];
    if (testGen) {
      await testGen(testsDir, schemasDir, schemasWithTypes, parsedSchemas);
    } else {
      console.log(`  No test generator available for language '${opts.lang}'`);
    }
  }

  console.log('');
  console.log('Done.');
}

// ─────────────────────────────────────────────────────────────────────────────
// Schema Discovery & Parsing
// ─────────────────────────────────────────────────────────────────────────────

async function discoverSchemaFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  async function walk(currentDir: string): Promise<void> {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.name.endsWith('.schema.odin')) {
        files.push(path.relative(dir, fullPath));
      }
    }
  }
  await walk(dir);
  return files.sort();
}

async function parseSchemaFile(
  schemasDir: string,
  relativePath: string
): Promise<ParsedSchemaFile> {
  const fullPath = path.join(schemasDir, relativePath);
  const content = await fs.readFile(fullPath, 'utf-8');
  const schema = Odin.parseSchema(content);

  const namespaceId = schema.metadata.id ?? relativePath.replace(/\.schema\.odin$/, '');
  const outputPath = namespaceIdToOutputPath(namespaceId);
  const dependencies = collectDependencies(schema);

  const exportedTypes = new Set<string>();
  for (const [typeName, schemaType] of schema.types) {
    if (schemaType.fields.size === 1 && schemaType.fields.has('_composition')) {
      continue;
    }
    exportedTypes.add(typeNameToInterface(typeName));
  }

  return {
    relativePath,
    namespaceId,
    schema,
    types: schema.types,
    dependencies,
    outputPath,
    exportedTypes,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Barrel Export
// ─────────────────────────────────────────────────────────────────────────────

async function generateBarrelExport(
  outputDir: string,
  schemas: ParsedSchemaFile[]
): Promise<void> {
  const lines: string[] = [];
  lines.push('/** Generated ODIN schema types. Import modules directly to avoid naming conflicts. */');
  lines.push('');

  const byDomain = new Map<string, ParsedSchemaFile[]>();
  for (const schema of schemas) {
    const domain = schema.outputPath.split('/')[0] ?? 'root';
    if (!byDomain.has(domain)) byDomain.set(domain, []);
    byDomain.get(domain)!.push(schema);
  }

  for (const [domain, domainSchemas] of byDomain) {
    lines.push(`// ${domain}/ (${domainSchemas.length} modules)`);
    for (const schema of domainSchemas.slice(0, 3)) {
      const modulePath = './' + schema.outputPath.replace(/\.ts$/, '.js');
      lines.push(`//   ${modulePath}`);
    }
    if (domainSchemas.length > 3) {
      lines.push(`//   ... and ${domainSchemas.length - 3} more`);
    }
  }

  await fs.writeFile(path.join(outputDir, 'index.ts'), lines.join('\n'), 'utf-8');
  console.log('  Generated: index.ts');
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared Utilities (exported for generators)
// ─────────────────────────────────────────────────────────────────────────────

export function namespaceIdToOutputPath(namespaceId: string): string {
  let cleanId = namespaceId;
  if (cleanId.startsWith('foundation.odin.schema.')) {
    cleanId = cleanId.slice('foundation.odin.schema.'.length);
  }
  return cleanId.replace(/\./g, '/') + '.ts';
}

export function collectDependencies(schema: OdinSchema): Set<string> {
  const deps = new Set<string>();
  for (const [, schemaType] of schema.types) {
    for (const [, field] of schemaType.fields) {
      for (const ref of extractTypeReferences(field)) {
        if (ref.schemaNamespace) deps.add(ref.schemaNamespace);
      }
    }
  }
  for (const [, field] of schema.fields) {
    for (const ref of extractTypeReferences(field)) {
      if (ref.schemaNamespace) deps.add(ref.schemaNamespace);
    }
  }
  return deps;
}

export interface TypeReference {
  typeName: string;
  schemaNamespace: string | null;
  isArray: boolean;
}

export function extractTypeReferences(field: SchemaField): TypeReference[] {
  const refs: TypeReference[] = [];
  extractRefsFromType(field.type, refs);
  return refs;
}

function extractRefsFromType(type: SchemaFieldType, refs: TypeReference[]): void {
  if (type.kind === 'reference' && type.targetPath) {
    const parts = type.targetPath.split('.');
    if (parts.length > 1) {
      refs.push({ typeName: parts[parts.length - 1]!, schemaNamespace: parts.slice(0, -1).join('.'), isArray: false });
    } else {
      refs.push({ typeName: type.targetPath, schemaNamespace: null, isArray: false });
    }
  } else if (type.kind === 'typeRef') {
    const parts = type.name.split('.');
    if (parts.length > 1) {
      refs.push({ typeName: parts[parts.length - 1]!, schemaNamespace: parts.slice(0, -1).join('.'), isArray: false });
    } else {
      refs.push({ typeName: type.name, schemaNamespace: null, isArray: false });
    }
  } else if (type.kind === 'union') {
    for (const subType of type.types) {
      extractRefsFromType(subType, refs);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Naming Utilities
// ─────────────────────────────────────────────────────────────────────────────

export function toPascalCase(str: string): string {
  return str.split(/[-_]/).map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()).join('');
}

export function toCamelCase(str: string): string {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

const RESERVED_WORDS = new Set([
  'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default',
  'delete', 'do', 'else', 'enum', 'export', 'extends', 'false', 'finally', 'for',
  'function', 'if', 'import', 'in', 'instanceof', 'new', 'null', 'return', 'super',
  'switch', 'this', 'throw', 'true', 'try', 'typeof', 'var', 'void', 'while', 'with',
  'yield', 'let', 'static', 'implements', 'interface', 'package', 'private', 'protected',
  'public', 'await', 'abstract', 'boolean', 'byte', 'char', 'double', 'final', 'float',
  'goto', 'int', 'long', 'native', 'short', 'synchronized', 'throws', 'transient',
  'volatile', 'arguments', 'eval', 'number', 'string', 'symbol', 'undefined', 'constructor',
  'prototype',
]);

export function toSafeIdentifier(name: string): string {
  let safeName = toCamelCase(name.replace(/\./g, '_'));
  if (RESERVED_WORDS.has(safeName.toLowerCase())) safeName += '_';
  return safeName;
}

export function toSafePropertyName(name: string): string {
  let safeName = toCamelCase(name.replace(/\./g, '_'));
  if (/^\d/.test(safeName)) safeName = '_' + safeName;
  if (RESERVED_WORDS.has(safeName.toLowerCase())) safeName += '_';
  return safeName;
}

export function typeNameToInterface(typeName: string): string {
  return typeName.split('.').map((part) => toPascalCase(part)).join('');
}

export function getTypeNameFromRef(refPath: string): string {
  const parts = refPath.split('.');
  return parts[parts.length - 1]!;
}

// ─────────────────────────────────────────────────────────────────────────────
// Type Resolution
// ─────────────────────────────────────────────────────────────────────────────

export function findTypeByName(
  typeName: string,
  allSchemas: Map<string, ParsedSchemaFile>
): { schema: ParsedSchemaFile; type: SchemaType } | null {
  for (const [, schema] of allSchemas) {
    for (const [name, schemaType] of schema.types) {
      if (name === typeName) return { schema, type: schemaType };
    }
  }
  return null;
}

export function resolveTypeFields(
  schemaType: SchemaType,
  allSchemas: Map<string, ParsedSchemaFile>,
  visited: Set<string> = new Set()
): Map<string, SchemaField> {
  const resolvedFields = new Map<string, SchemaField>();

  const compositionField = schemaType.fields.get('_composition');
  if (compositionField && compositionField.type.kind === 'typeRef') {
    const baseTypeName = compositionField.type.name;
    if (!visited.has(baseTypeName)) {
      visited.add(baseTypeName);
      const baseTypeInfo = findTypeByName(baseTypeName, allSchemas);
      if (baseTypeInfo) {
        for (const [name, field] of resolveTypeFields(baseTypeInfo.type, allSchemas, visited)) {
          resolvedFields.set(name, field);
        }
      }
    }
  }

  for (const [name, field] of schemaType.fields) {
    if (name !== '_composition') resolvedFields.set(name, field);
  }

  return resolvedFields;
}

export function resolveType(
  typeName: string,
  schemaType: SchemaType,
  allSchemas: Map<string, ParsedSchemaFile>
): ResolvedType {
  const resolvedFields = resolveTypeFields(schemaType, allSchemas);
  const arrayFields: string[] = [];
  const requiredFields: string[] = [];
  const fields = new Map<string, { field: SchemaField; isArray: boolean }>();

  for (const [fieldName, field] of resolvedFields) {
    if (fieldName === '_composition') continue;
    const isArray = fieldName.endsWith('[]');
    const cleanFieldName = isArray ? fieldName.slice(0, -2) : fieldName;
    const tsFieldName = toSafePropertyName(cleanFieldName);
    fields.set(tsFieldName, { field, isArray });
    if (isArray) arrayFields.push(tsFieldName);
    if (field.required) requiredFields.push(tsFieldName);
  }

  const factoryPropName = toCamelCase(typeName.replace(/\./g, '_'));

  return {
    typeName,
    interfaceName: typeNameToInterface(typeName),
    factoryName: toSafeIdentifier(typeName),
    factoryPropName,
    arrayFields,
    requiredFields,
    fields,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Import Resolution
// ─────────────────────────────────────────────────────────────────────────────

export function findTypeSource(
  typeName: string,
  currentSchema: ParsedSchemaFile,
  allSchemas: Map<string, ParsedSchemaFile>
): { importPath: string } | null {
  const candidates: ParsedSchemaFile[] = [];
  for (const [, schema] of allSchemas) {
    if (schema === currentSchema) continue;
    if (schema.exportedTypes.has(typeName)) candidates.push(schema);
  }
  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    const aIsCommon = a.outputPath.startsWith('common/');
    const bIsCommon = b.outputPath.startsWith('common/');
    if (aIsCommon && !bIsCommon) return 1;
    if (bIsCommon && !aIsCommon) return -1;
    return b.outputPath.split('/').length - a.outputPath.split('/').length;
  });

  const bestMatch = candidates[0]!;
  return { importPath: calculateRelativePath(currentSchema.outputPath, bestMatch.outputPath) };
}

export function calculateRelativePath(fromPath: string, toPath: string): string {
  const fromDir = path.dirname(fromPath);
  const toDir = path.dirname(toPath);
  const toFile = path.basename(toPath, '.ts');

  if (fromDir === toDir) return './' + toFile + '.js';

  const fromParts = fromDir.split('/').filter(Boolean);
  const toParts = toDir.split('/').filter(Boolean);

  let commonLength = 0;
  while (commonLength < fromParts.length && commonLength < toParts.length && fromParts[commonLength] === toParts[commonLength]) {
    commonLength++;
  }

  const upCount = fromParts.length - commonLength;
  const downPath = toParts.slice(commonLength);
  let relativePath = upCount === 0 ? './' : '../'.repeat(upCount);
  if (downPath.length > 0) relativePath += downPath.join('/') + '/';
  return relativePath + toFile + '.js';
}
