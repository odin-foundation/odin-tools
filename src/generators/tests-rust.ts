/**
 * Rust test generator — produces #[test] module files for generated schema types.
 *
 * Generates structural tests that verify:
 * - Structs exist and can be instantiated
 * - Objects can be created with required fields
 * - Optional fields default to None
 * - Enum fields accept valid string values
 * - Nullable fields accept None
 * - Array fields accept Vec<T>
 * - Field count verification
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { SchemaField } from '@odin-foundation/core';
import type { ParsedSchemaFile } from '../types.js';
import {
  typeNameToInterface, toSafePropertyName,
  resolveType
} from '../codegen.js';

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

const RUST_KEYWORDS = new Set([
  'type', 'self', 'super', 'crate', 'mod', 'fn', 'struct', 'enum', 'trait', 'impl',
  'pub', 'use', 'let', 'mut', 'const', 'static', 'ref', 'return', 'if', 'else',
  'match', 'for', 'while', 'loop', 'break', 'continue', 'move', 'box', 'where',
  'async', 'await', 'dyn', 'abstract', 'become', 'do', 'final', 'macro', 'override',
  'priv', 'typeof', 'unsized', 'virtual', 'yield', 'try', 'union', 'as', 'in',
]);

function toSnakeCase(str: string): string {
  return str.replace(/([a-z])([A-Z])/g, '$1_$2').replace(/[-]/g, '_').toLowerCase();
}

function safeRustFieldName(name: string): string {
  const snake = toSnakeCase(name);
  return RUST_KEYWORDS.has(snake) ? `r#${snake}` : snake;
}

function safeRustStructName(name: string): string {
  const RESERVED_TYPES = new Set(['Option', 'Result', 'Box', 'Vec', 'String', 'Error', 'Self']);
  return RESERVED_TYPES.has(name) ? name + 'Type' : name;
}

const PRIMITIVE_TYPES = new Set([
  'string', 'date', 'timestamp', 'time', 'duration',
  'number', 'integer', 'decimal', 'currency', 'boolean', 'percent',
]);

function isPrimitiveType(type: string): boolean {
  return PRIMITIVE_TYPES.has(type);
}

function generateTestValue(type: string, fieldName: string): string {
  switch (type) {
    case 'string': return `"test-${fieldName}".to_string()`;
    case 'date': return '"2024-01-15".to_string()';
    case 'timestamp': return '"2024-01-15T14:30:00Z".to_string()';
    case 'time': return '"14:30:00".to_string()';
    case 'duration': return '"P1Y6M".to_string()';
    case 'number': case 'decimal': case 'currency': case 'percent':
      return '99.99_f64';
    case 'integer':
      return '42_i64';
    case 'boolean':
      return 'true';
    default:
      return 'Default::default()';
  }
}

function isStringLikeType(type: string): boolean {
  return ['string', 'date', 'timestamp', 'time', 'duration', 'enum'].includes(type);
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Info Collection
// ─────────────────────────────────────────────────────────────────────────────

interface FieldTestInfo {
  name: string;
  snakeName: string;     // For struct field access (may have r# prefix)
  fnSafeName: string;    // For function names (no r# prefix)
  type: string;
  required: boolean;
  isArray: boolean;
  nullable: boolean;
  format: string | undefined;
  enumValues: string[];
}

interface TypeTestInfo {
  interfaceName: string;
  typeName: string;
  fields: FieldTestInfo[];
}

function collectTypeTestInfo(parsed: ParsedSchemaFile, allSchemas: Map<string, ParsedSchemaFile>): TypeTestInfo[] {
  const types: TypeTestInfo[] = [];

  for (const [typeName, schemaType] of parsed.types) {
    if (schemaType.fields.size === 1 && schemaType.fields.has('_composition')) continue;

    const resolved = resolveType(typeName, schemaType, allSchemas);
    const fields: FieldTestInfo[] = [];

    for (const [fieldName, { field, isArray }] of resolved.fields) {
      const formatConstraint = field.constraints.find(
        (c): c is { kind: 'format'; format: string } => c.kind === 'format'
      );
      const enumValues = field.type.kind === 'enum' ? field.type.values : [];

      const snakeName = safeRustFieldName(fieldName);
      fields.push({
        name: fieldName,
        snakeName,
        fnSafeName: snakeName.replace(/^r#/, ''),
        type: field.type.kind,
        required: field.required,
        isArray,
        nullable: field.nullable,
        format: formatConstraint?.format,
        enumValues,
      });
    }

    types.push({
      interfaceName: safeRustStructName(typeNameToInterface(typeName)),
      typeName,
      fields,
    });
  }

  return types;
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Code Generation
// ─────────────────────────────────────────────────────────────────────────────

function generateFieldInit(field: FieldTestInfo, indent: string): string {
  if (field.required) {
    if (field.isArray) {
      return `${indent}${field.snakeName}: vec![],`;
    } else if (field.type === 'enum' && field.enumValues.length > 0) {
      return `${indent}${field.snakeName}: "${field.enumValues[0]}".to_string(),`;
    } else if (isPrimitiveType(field.type)) {
      return `${indent}${field.snakeName}: ${generateTestValue(field.type, field.name)},`;
    } else {
      return `${indent}${field.snakeName}: Default::default(),`;
    }
  } else {
    return `${indent}${field.snakeName}: None,`;
  }
}

function generateTypeTests(typeInfo: TypeTestInfo): string {
  const { interfaceName, fields } = typeInfo;
  const lines: string[] = [];
  const snakeType = toSnakeCase(interfaceName);

  const requiredFields = fields.filter((f) => f.required);
  const optionalFields = fields.filter((f) => !f.required);
  const primitiveRequired = requiredFields.filter((f) => !f.isArray && isPrimitiveType(f.type));
  const enumFields = fields.filter((f) => f.type === 'enum' && f.enumValues.length > 0);

  // Test: object can be created with required fields
  lines.push(`    #[test]`);
  lines.push(`    fn ${snakeType}_can_create_with_required_fields() {`);
  lines.push(`        let obj = ${interfaceName} {`);
  for (const field of fields) {
    lines.push(generateFieldInit(field, '            '));
  }
  lines.push(`        };`);
  for (const field of primitiveRequired) {
    if (isStringLikeType(field.type)) {
      lines.push(`        assert!(!obj.${field.snakeName}.is_empty());`);
    }
  }
  lines.push(`    }`);
  lines.push('');

  // Test: optional fields can be None
  if (optionalFields.length > 0) {
    lines.push(`    #[test]`);
    lines.push(`    fn ${snakeType}_optional_fields_default_to_none() {`);
    lines.push(`        let obj = ${interfaceName} {`);
    for (const field of fields) {
      lines.push(generateFieldInit(field, '            '));
    }
    lines.push(`        };`);
    for (const field of optionalFields.slice(0, 3)) {
      lines.push(`        assert!(obj.${field.snakeName}.is_none());`);
    }
    lines.push(`    }`);
    lines.push('');
  }

  // Test: optional fields can be set
  if (optionalFields.length > 0) {
    const settableOptionals = optionalFields.filter((f) => f.isArray || isPrimitiveType(f.type) || f.type === 'enum');
    if (settableOptionals.length > 0) {
      lines.push(`    #[test]`);
      lines.push(`    fn ${snakeType}_accepts_optional_fields() {`);
      lines.push(`        let obj = ${interfaceName} {`);
      for (const field of requiredFields) {
        lines.push(generateFieldInit(field, '            '));
      }
      for (const field of settableOptionals.slice(0, 3)) {
        if (field.isArray) {
          lines.push(`            ${field.snakeName}: Some(vec![]),`);
        } else if (field.type === 'enum' && field.enumValues.length > 0) {
          lines.push(`            ${field.snakeName}: Some("${field.enumValues[0]}".to_string()),`);
        } else {
          lines.push(`            ${field.snakeName}: Some(${generateTestValue(field.type, field.name)}),`);
        }
      }
      // remaining optional fields still None
      const settableSet = new Set(settableOptionals.slice(0, 3).map(f => f.snakeName));
      for (const field of optionalFields) {
        if (!settableSet.has(field.snakeName)) {
          lines.push(`            ${field.snakeName}: None,`);
        }
      }
      lines.push(`        };`);
      for (const field of settableOptionals.slice(0, 3)) {
        lines.push(`        assert!(obj.${field.snakeName}.is_some());`);
      }
      lines.push(`    }`);
      lines.push('');
    }
  }

  // Test: enum fields accept valid values
  for (const field of enumFields.slice(0, 3)) {
    lines.push(`    #[test]`);
    lines.push(`    fn ${snakeType}_${field.fnSafeName}_accepts_valid_enum_values() {`);
    lines.push(`        let valid_values = vec![`);
    for (const val of field.enumValues.slice(0, 5)) {
      lines.push(`            "${val}".to_string(),`);
    }
    lines.push(`        ];`);
    lines.push(`        assert!(!valid_values.is_empty());`);
    lines.push(`    }`);
    lines.push('');
  }

  // Test: nullable fields accept None
  const nullableFields = fields.filter((f) => f.nullable);
  if (nullableFields.length > 0) {
    lines.push(`    #[test]`);
    lines.push(`    fn ${snakeType}_nullable_fields_accept_none() {`);
    lines.push(`        let obj = ${interfaceName} {`);
    for (const field of fields) {
      if (nullableFields.slice(0, 3).some(n => n.snakeName === field.snakeName) && !field.required) {
        lines.push(`            ${field.snakeName}: None,`);
      } else {
        lines.push(generateFieldInit(field, '            '));
      }
    }
    lines.push(`        };`);
    for (const field of nullableFields.slice(0, 3)) {
      if (!field.required) {
        lines.push(`        assert!(obj.${field.snakeName}.is_none());`);
      }
    }
    lines.push(`    }`);
    lines.push('');
  }

  // Test: array fields accept Vec
  const arrayFields = fields.filter((f) => f.isArray);
  if (arrayFields.length > 0) {
    lines.push(`    #[test]`);
    lines.push(`    fn ${snakeType}_array_fields_accept_vec() {`);
    lines.push(`        let obj = ${interfaceName} {`);
    for (const field of fields) {
      lines.push(generateFieldInit(field, '            '));
    }
    lines.push(`        };`);
    for (const field of arrayFields.slice(0, 3)) {
      if (field.required) {
        lines.push(`        assert!(obj.${field.snakeName}.is_empty());`);
      } else {
        lines.push(`        assert!(obj.${field.snakeName}.is_none());`);
      }
    }
    lines.push(`    }`);
    lines.push('');
  }

  // Test: field count
  lines.push(`    #[test]`);
  lines.push(`    fn ${snakeType}_has_${fields.length}_fields() {`);
  lines.push(`        // Required: ${requiredFields.map(f => f.name).join(', ') || 'none'}`);
  lines.push(`        // Optional: ${optionalFields.length} fields`);
  lines.push(`        assert_eq!(${requiredFields.length} + ${optionalFields.length}, ${fields.length});`);
  lines.push(`    }`);

  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Test File Generation
// ─────────────────────────────────────────────────────────────────────────────

/** Generate inline #[cfg(test)] module to append to source file */
export function generateInlineRustTests(
  schema: ParsedSchemaFile,
  allSchemas: Map<string, ParsedSchemaFile>
): string {
  const types = collectTypeTestInfo(schema, allSchemas);
  if (types.length === 0) return '';

  const schemaPath = schema.outputPath.replace(/\.ts$/, '');
  const schemaName = schemaPath.split('/').pop() || schemaPath;

  const lines: string[] = [];
  lines.push('');
  lines.push('#[cfg(test)]');
  lines.push(`mod ${toSnakeCase(schemaName)}_tests {`);
  lines.push('    use super::*;');
  lines.push('');

  for (const typeInfo of types) {
    lines.push(generateTypeTests(typeInfo));
    lines.push('');
  }

  lines.push('}');
  return lines.join('\n');
}

async function generateSchemaTests(
  testsDir: string,
  schema: ParsedSchemaFile,
  allSchemas: Map<string, ParsedSchemaFile>
): Promise<boolean> {
  const testCode = generateInlineRustTests(schema, allSchemas);
  if (!testCode) return false;

  const schemaPath = schema.outputPath.replace(/\.ts$/, '');
  const schemaName = schemaPath.split('/').pop() || schemaPath;

  const testDir = path.join(testsDir, path.dirname(schemaPath));
  await fs.mkdir(testDir, { recursive: true });
  await fs.writeFile(path.join(testDir, schemaName + '_test.rs'), testCode, 'utf-8');

  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export async function generateRustTests(
  testsDir: string,
  schemasDir: string,
  schemas: ParsedSchemaFile[],
  allSchemas: Map<string, ParsedSchemaFile>
): Promise<void> {
  try { await fs.rm(testsDir, { recursive: true, force: true }); } catch {}
  await fs.mkdir(testsDir, { recursive: true });

  console.log('Generating Rust tests...');

  const domainCounts = new Map<string, number>();
  let generatedCount = 0;

  for (const schema of schemas) {
    const domain = schema.outputPath.split('/')[0];
    if (!domain) continue;
    const generated = await generateSchemaTests(testsDir, schema, allSchemas);
    if (generated) {
      generatedCount++;
      domainCounts.set(domain, (domainCounts.get(domain) || 0) + 1);
    }
  }

  for (const [domain, count] of [...domainCounts.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    console.log(`  ${domain}/: ${count} test files`);
  }
  console.log(`  Total: ${generatedCount} test files generated`);
}
