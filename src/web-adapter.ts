/**
 * Web adapter — generates code from SchemaDoc JSON (the website's format)
 * instead of ParsedSchemaFile (the CLI's format from Odin.parseSchema).
 *
 * This allows the website to use the same generators as the CLI tool,
 * ensuring identical output.
 */

import type { SchemaFieldType, SchemaField, SchemaType, OdinSchema } from '@odin-foundation/core';
import type { ParsedSchemaFile, ResolvedType } from './types.js';
import { typeNameToInterface, namespaceIdToOutputPath, resolveType } from './codegen.js';
import { generateTypeScript } from './generators/typescript.js';
import { generateCSharp } from './generators/csharp.js';
import { generateJava } from './generators/java.js';
import { generatePython } from './generators/python.js';
import { generateRuby } from './generators/ruby.js';
import { generateRust } from './generators/rust.js';

// ─────────────────────────────────────────────────────────────────────────────
// Website SchemaDoc types (matches website's schema-tree.ts)
// ─────────────────────────────────────────────────────────────────────────────

export interface WebSchemaDoc {
  id: string;
  title: string;
  description: string;
  slug: string;
  imports: { path: string; alias: string; resolvedSlug: string }[];
  types: WebTypeDef[];
}

export interface WebTypeDef {
  name: string;
  description: string;
  fields: WebFieldDef[];
}

export interface WebFieldDef {
  name: string;
  type: string;
  required: boolean;
  confidential: boolean;
  deprecated: boolean;
  description: string;
  constraints: string;
  enumValues: string[];
  reference: string;
  isArray: boolean;
  default: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Adapter: WebSchemaDoc → ParsedSchemaFile
// ─────────────────────────────────────────────────────────────────────────────

function webFieldTypeToSchemaFieldType(field: WebFieldDef): SchemaFieldType {
  if (field.reference) {
    return { kind: 'typeRef', name: field.reference };
  }
  if (field.enumValues.length > 0) {
    return { kind: 'enum', values: field.enumValues };
  }
  switch (field.type) {
    case 'string': return { kind: 'string' };
    case 'boolean': return { kind: 'boolean' };
    case 'number': return { kind: 'number' };
    case 'integer': return { kind: 'integer' };
    case 'currency': return { kind: 'currency', places: 2 };
    case 'percent': return { kind: 'percent' };
    case 'date': return { kind: 'date' };
    case 'timestamp': return { kind: 'timestamp' };
    case 'time': return { kind: 'time' };
    case 'duration': return { kind: 'duration' };
    case 'binary': return { kind: 'binary' };
    case 'enum': return { kind: 'enum', values: field.enumValues };
    default: return { kind: 'string' };
  }
}

function webFieldToSchemaField(field: WebFieldDef): SchemaField {
  const fieldName = field.isArray ? `${field.name}[]` : field.name;
  return {
    path: fieldName,
    type: webFieldTypeToSchemaFieldType(field),
    required: field.required,
    nullable: !field.required,
    redacted: field.confidential,
    deprecated: field.deprecated,
    constraints: [],
    conditionals: [],
  };
}

function webSchemaDocToParsed(doc: WebSchemaDoc): ParsedSchemaFile {
  const types = new Map<string, SchemaType>();
  for (const typeDef of doc.types) {
    const fields = new Map<string, SchemaField>();
    for (const field of typeDef.fields) {
      const fieldName = field.isArray ? `${field.name}[]` : field.name;
      fields.set(fieldName, webFieldToSchemaField(field));
    }
    types.set(typeDef.name, { name: typeDef.name, fields });
  }

  const exportedTypes = new Set<string>();
  for (const typeDef of doc.types) {
    exportedTypes.add(typeNameToInterface(typeDef.name));
  }

  const schema: OdinSchema = {
    metadata: { id: doc.id, title: doc.title, description: doc.description },
    imports: [],
    types,
    fields: new Map(),
    arrays: new Map(),
    constraints: new Map(),
  };

  return {
    relativePath: doc.slug + '.schema.odin',
    namespaceId: doc.id || doc.slug,
    schema,
    types,
    dependencies: new Set(),
    outputPath: namespaceIdToOutputPath(doc.id || doc.slug),
    exportedTypes,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API for website
// ─────────────────────────────────────────────────────────────────────────────

export interface GeneratedFile {
  path: string;
  content: string;
}

const GENERATORS: Record<string, (parsed: ParsedSchemaFile, all: Map<string, ParsedSchemaFile>) => string> = {
  typescript: generateTypeScript,
  csharp: generateCSharp,
  java: generateJava,
  python: generatePython,
  ruby: generateRuby,
  rust: generateRust,
};

const EXTENSIONS: Record<string, string> = {
  typescript: '.ts',
  csharp: '.cs',
  java: '.java',
  python: '.py',
  ruby: '.rb',
  rust: '.rs',
};

/**
 * Generate code for a single schema in the specified language.
 * Accepts the website's SchemaDoc JSON format.
 */
export function generateFromWebSchema(
  schema: WebSchemaDoc,
  lang: string,
  allSchemas?: WebSchemaDoc[]
): GeneratedFile[] {
  const gen = GENERATORS[lang];
  const ext = EXTENSIONS[lang];
  if (!gen || !ext) return [];

  const parsed = webSchemaDocToParsed(schema);
  const allParsed = new Map<string, ParsedSchemaFile>();
  allParsed.set(parsed.namespaceId, parsed);

  // Convert all schemas for cross-reference resolution
  if (allSchemas) {
    for (const s of allSchemas) {
      const p = webSchemaDocToParsed(s);
      allParsed.set(p.namespaceId, p);
    }
  }

  const code = gen(parsed, allParsed);
  if (!code) return [];

  const filePath = parsed.outputPath.replace(/\.ts$/, ext);
  return [{ path: filePath, content: code }];
}

/**
 * Generate code for multiple schemas (with dependency resolution).
 */
export function generateTreeFromWebSchemas(
  schemas: WebSchemaDoc[],
  lang: string
): GeneratedFile[] {
  const gen = GENERATORS[lang];
  const ext = EXTENSIONS[lang];
  if (!gen || !ext) return [];

  const allParsed = new Map<string, ParsedSchemaFile>();
  const parsedList: ParsedSchemaFile[] = [];

  for (const schema of schemas) {
    const parsed = webSchemaDocToParsed(schema);
    allParsed.set(parsed.namespaceId, parsed);
    parsedList.push(parsed);
  }

  const files: GeneratedFile[] = [];
  for (const parsed of parsedList) {
    const code = gen(parsed, allParsed);
    if (!code) continue;
    const filePath = parsed.outputPath.replace(/\.ts$/, ext);
    files.push({ path: filePath, content: code });
  }

  return files;
}
