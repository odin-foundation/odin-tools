/**
 * TypeScript code generator — produces interfaces + fluent builder factories.
 */

import type { SchemaFieldType, SchemaField } from '@odin-foundation/core';
import type { ParsedSchemaFile, ResolvedType } from '../types.js';
import {
  typeNameToInterface, getTypeNameFromRef, toSafeIdentifier, toSafePropertyName,
  toPascalCase, toCamelCase, resolveType, findTypeSource
} from '../codegen.js';

// ─────────────────────────────────────────────────────────────────────────────
// Type Mapping
// ─────────────────────────────────────────────────────────────────────────────

export function odinTypeToTypeScript(
  type: SchemaFieldType,
  nullable: boolean = false,
  usedTypes?: Set<string>
): string {
  let tsType: string;

  switch (type.kind) {
    case 'string': tsType = 'string'; break;
    case 'boolean': tsType = 'boolean'; break;
    case 'number': case 'integer': case 'decimal': case 'currency': case 'percent':
      tsType = 'number'; break;
    case 'date': case 'timestamp': case 'time': case 'duration':
      tsType = 'string'; break;
    case 'binary': tsType = 'string'; break;
    case 'null': tsType = 'null'; break;
    case 'reference':
      if (type.targetPath) {
        tsType = typeNameToInterface(getTypeNameFromRef(type.targetPath));
        usedTypes?.add(tsType);
      } else {
        tsType = 'unknown';
      }
      break;
    case 'typeRef':
      tsType = typeNameToInterface(getTypeNameFromRef(type.name));
      usedTypes?.add(tsType);
      break;
    case 'enum':
      tsType = type.values.map((v) => `'${v}'`).join(' | ');
      break;
    case 'union':
      tsType = type.types.map((t) => odinTypeToTypeScript(t, false, usedTypes)).join(' | ');
      break;
    default: tsType = 'unknown';
  }

  return nullable && type.kind !== 'null' ? `${tsType} | null` : tsType;
}

// ─────────────────────────────────────────────────────────────────────────────
// Interface Generation
// ─────────────────────────────────────────────────────────────────────────────

function generateInterface(resolved: ResolvedType, usedTypes: Set<string>): string {
  const lines: string[] = [];
  lines.push(`export interface ${resolved.interfaceName} {`);

  for (const [fieldName, { field, isArray }] of resolved.fields) {
    let tsType = odinTypeToTypeScript(field.type, field.nullable, usedTypes);
    if (isArray) {
      tsType = (field.type.kind === 'enum' || field.type.kind === 'union')
        ? `(${tsType})[]` : `${tsType}[]`;
    }

    const jsdocParts: string[] = [];
    if (field.deprecated) jsdocParts.push('@deprecated');
    if (field.redacted) jsdocParts.push('@confidential');
    if (field.computed) jsdocParts.push('@computed');
    if (field.immutable) jsdocParts.push('@immutable');
    if (field.conditionals.length > 0) {
      const conditions = field.conditionals.map(
        (c) => `${c.unless ? ':unless' : ':if'} ${c.field} ${c.operator} ${JSON.stringify(c.value)}`
      );
      jsdocParts.push(`@condition ${conditions.join(' OR ')}`);
    }
    for (const constraint of field.constraints) {
      if (constraint.kind === 'format') jsdocParts.push(`@format ${constraint.format}`);
    }

    if (jsdocParts.length > 0) lines.push(`  /** ${jsdocParts.join(' ')} */`);
    const optionalMarker = !field.required ? '?' : '';
    lines.push(`  ${fieldName}${optionalMarker}: ${tsType};`);
  }

  lines.push('}');
  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Import Generation
// ─────────────────────────────────────────────────────────────────────────────

function generateImports(
  parsed: ParsedSchemaFile,
  allSchemas: Map<string, ParsedSchemaFile>,
  usedTypes: Set<string>
): { imports: string[]; unresolvedTypes: Set<string> } {
  const imports: string[] = [];
  const importMap = new Map<string, Set<string>>();
  const unresolvedTypes = new Set<string>();

  for (const typeName of usedTypes) {
    if (parsed.exportedTypes.has(typeName)) continue;
    const sourceInfo = findTypeSource(typeName, parsed, allSchemas);
    if (sourceInfo) {
      if (!importMap.has(sourceInfo.importPath)) importMap.set(sourceInfo.importPath, new Set());
      importMap.get(sourceInfo.importPath)!.add(typeName);
    } else {
      unresolvedTypes.add(typeName);
    }
  }

  for (const [importPath, typeNames] of importMap) {
    const types = Array.from(typeNames).sort();
    imports.push(`import type { ${types.join(', ')} } from '${importPath}';`);
  }

  return { imports, unresolvedTypes };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Generator
// ─────────────────────────────────────────────────────────────────────────────

export function generateTypeScript(
  parsed: ParsedSchemaFile,
  allSchemas: Map<string, ParsedSchemaFile>
): string {
  const lines: string[] = [];
  const schemaPath = parsed.relativePath.replace(/\.schema\.odin$/, '').replace(/\\/g, '/');
  const usedTypes = new Set<string>();

  // First pass: collect all used types
  for (const [typeName, schemaType] of parsed.types) {
    if (schemaType.fields.size === 1 && schemaType.fields.has('_composition')) continue;
    const resolved = resolveType(typeName, schemaType, allSchemas);
    for (const [, { field }] of resolved.fields) {
      odinTypeToTypeScript(field.type, field.nullable, usedTypes);
    }
  }

  // Header
  const title = parsed.schema.metadata.title ?? parsed.namespaceId;
  lines.push(`/** ${title} - Generated schema types. */`);
  lines.push('');

  // External imports
  const { imports, unresolvedTypes } = generateImports(parsed, allSchemas, usedTypes);
  if (imports.length > 0) { lines.push(...imports); lines.push(''); }

  // Unresolved type aliases
  if (unresolvedTypes.size > 0) {
    for (const typeName of Array.from(unresolvedTypes).sort()) {
      lines.push(`type ${typeName} = Record<string, unknown>;`);
    }
    lines.push('');
  }

  // Interfaces
  for (const [typeName, schemaType] of parsed.types) {
    if (schemaType.fields.size === 1 && schemaType.fields.has('_composition')) continue;
    const resolved = resolveType(typeName, schemaType, allSchemas);
    lines.push(generateInterface(resolved, usedTypes));
    lines.push('');
  }

  if (lines.length <= 3) return ''; // No types generated

  return lines.join('\n');
}
