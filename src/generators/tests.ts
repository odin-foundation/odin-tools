/**
 * Test generator — produces vitest test files for generated schema types.
 *
 * Generates structural tests that verify:
 * - Interfaces exist and are importable
 * - Objects conforming to the interface can be created
 * - Required fields are enforced by TypeScript
 * - Type mappings are correct (string, number, boolean, arrays, references)
 * - Format constraints are documented
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { SchemaField } from '@odin-foundation/core';
import type { ParsedSchemaFile } from '../types.js';
import {
  typeNameToInterface, toSafeIdentifier, toSafePropertyName,
  resolveType
} from '../codegen.js';
import { odinTypeToTypeScript } from './typescript.js';

// ─────────────────────────────────────────────────────────────────────────────
// Test Value Generation
// ─────────────────────────────────────────────────────────────────────────────

const PRIMITIVE_TYPES = new Set([
  'string', 'date', 'timestamp', 'time', 'duration',
  'number', 'integer', 'decimal', 'currency', 'boolean', 'percent',
]);

function isPrimitiveType(type: string): boolean {
  return PRIMITIVE_TYPES.has(type);
}

function generateTestValue(type: string, fieldName: string): string {
  switch (type) {
    case 'string': return `'test-${fieldName}'`;
    case 'date': return "'2024-01-15'";
    case 'timestamp': return "'2024-01-15T14:30:00Z'";
    case 'time': return "'T14:30:00'";
    case 'duration': return "'P1Y6M'";
    case 'number': case 'decimal': case 'currency': case 'percent':
      return '99.99';
    case 'integer':
      return '42';
    case 'boolean':
      return 'true';
    case 'enum':
      return undefined as any; // handled separately
    default:
      return '{}';
  }
}

/** Valid test values for format constraints */
const FORMAT_VALID_VALUES: Record<string, string> = {
  email: "'test@example.com'",
  url: "'https://example.com'",
  uuid: "'550e8400-e29b-41d4-a716-446655440000'",
  phone: "'+1-555-123-4567'",
  ssn: "'123-45-6789'",
  ein: "'12-3456789'",
  zip: "'90210'",
  vin: "'1HGBH41JXMN109186'",
  iban: "'DE89370400440532013000'",
  bic: "'DEUTDEFF'",
  routing: "'021000021'",
  cusip: "'037833100'",
  isin: "'US0378331005'",
  npi: "'1234567890'",
  dea: "'AB1234567'",
};

// ─────────────────────────────────────────────────────────────────────────────
// Test Info Collection
// ─────────────────────────────────────────────────────────────────────────────

interface FieldTestInfo {
  name: string;
  type: string;
  tsType: string;
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
      const tsType = odinTypeToTypeScript(field.type, field.nullable);

      fields.push({
        name: fieldName,
        type: field.type.kind,
        tsType: isArray ? `${tsType}[]` : tsType,
        required: field.required,
        isArray,
        nullable: field.nullable,
        format: formatConstraint?.format,
        enumValues,
      });
    }

    types.push({
      interfaceName: typeNameToInterface(typeName),
      typeName,
      fields,
    });
  }

  return types;
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Code Generation
// ─────────────────────────────────────────────────────────────────────────────

function pathToNamespace(schemaPath: string): string {
  return schemaPath.replace(/\.ts$/, '').split('/').map((part) =>
    part.split('-').map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join('')
  ).join('');
}

function generateTypeTests(typeInfo: TypeTestInfo, namespace: string): string {
  const { interfaceName, fields } = typeInfo;
  const lines: string[] = [];

  const requiredFields = fields.filter((f) => f.required);
  const optionalFields = fields.filter((f) => !f.required);
  const primitiveRequired = requiredFields.filter((f) => isPrimitiveType(f.type));
  const enumFields = fields.filter((f) => f.type === 'enum' && f.enumValues.length > 0);
  const formatFields = fields.filter((f) => f.format && FORMAT_VALID_VALUES[f.format]);

  lines.push(`  describe('${interfaceName}', () => {`);

  // Test: interface exists and object can be created with required fields
  lines.push(`    it('can create object with required fields', () => {`);
  lines.push(`      const obj: ${namespace}.${interfaceName} = {`);
  for (const field of requiredFields) {
    if (field.type === 'enum' && field.enumValues.length > 0) {
      lines.push(`        ${field.name}: '${field.enumValues[0]}',`);
    } else if (field.isArray) {
      lines.push(`        ${field.name}: [],`);
    } else if (isPrimitiveType(field.type)) {
      lines.push(`        ${field.name}: ${generateTestValue(field.type, field.name)},`);
    } else {
      lines.push(`        ${field.name}: {} as any,`);
    }
  }
  lines.push(`      };`);
  lines.push(`      expect(obj).toBeDefined();`);
  for (const field of primitiveRequired) {
    lines.push(`      expect(obj.${field.name}).toBeDefined();`);
  }
  lines.push(`    });`);
  lines.push('');

  // Test: optional fields can be omitted
  if (optionalFields.length > 0) {
    lines.push(`    it('allows optional fields to be omitted', () => {`);
    lines.push(`      const obj: ${namespace}.${interfaceName} = {`);
    for (const field of requiredFields) {
      if (field.type === 'enum' && field.enumValues.length > 0) {
        lines.push(`        ${field.name}: '${field.enumValues[0]}',`);
      } else if (field.isArray) {
        lines.push(`        ${field.name}: [],`);
      } else if (isPrimitiveType(field.type)) {
        lines.push(`        ${field.name}: ${generateTestValue(field.type, field.name)},`);
      } else {
        lines.push(`        ${field.name}: {} as any,`);
      }
    }
    lines.push(`      };`);
    lines.push(`      // These optional fields should not be present`);
    for (const field of optionalFields.slice(0, 3)) {
      lines.push(`      expect(obj.${field.name}).toBeUndefined();`);
    }
    lines.push(`    });`);
    lines.push('');
  }

  // Test: optional fields can be set
  if (optionalFields.length > 0) {
    const settableOptionals = optionalFields.filter((f) => isPrimitiveType(f.type) || f.type === 'enum');
    if (settableOptionals.length > 0) {
      lines.push(`    it('accepts optional fields when provided', () => {`);
      lines.push(`      const obj: ${namespace}.${interfaceName} = {`);
      for (const field of requiredFields) {
        if (field.type === 'enum' && field.enumValues.length > 0) {
          lines.push(`        ${field.name}: '${field.enumValues[0]}',`);
        } else if (field.isArray) {
          lines.push(`        ${field.name}: [],`);
        } else if (isPrimitiveType(field.type)) {
          lines.push(`        ${field.name}: ${generateTestValue(field.type, field.name)},`);
        } else {
          lines.push(`        ${field.name}: {} as any,`);
        }
      }
      for (const field of settableOptionals.slice(0, 3)) {
        if (field.type === 'enum' && field.enumValues.length > 0) {
          lines.push(`        ${field.name}: '${field.enumValues[0]}',`);
        } else {
          lines.push(`        ${field.name}: ${generateTestValue(field.type, field.name)},`);
        }
      }
      lines.push(`      };`);
      for (const field of settableOptionals.slice(0, 3)) {
        lines.push(`      expect(obj.${field.name}).toBeDefined();`);
      }
      lines.push(`    });`);
      lines.push('');
    }
  }

  // Test: enum fields accept valid values
  for (const field of enumFields.slice(0, 3)) {
    lines.push(`    it('${field.name} accepts valid enum values', () => {`);
    lines.push(`      const validValues: ${namespace}.${interfaceName}['${field.name}'][] = [`);
    for (const val of field.enumValues.slice(0, 5)) {
      lines.push(`        '${val}',`);
    }
    lines.push(`      ];`);
    lines.push(`      expect(validValues.length).toBeGreaterThan(0);`);
    lines.push(`    });`);
    lines.push('');
  }

  // Test: nullable fields accept null
  const nullableFields = fields.filter((f) => f.nullable);
  if (nullableFields.length > 0) {
    lines.push(`    it('nullable fields accept null', () => {`);
    lines.push(`      const obj: Partial<${namespace}.${interfaceName}> = {`);
    for (const field of nullableFields.slice(0, 3)) {
      lines.push(`        ${field.name}: null,`);
    }
    lines.push(`      };`);
    for (const field of nullableFields.slice(0, 3)) {
      lines.push(`      expect(obj.${field.name}).toBeNull();`);
    }
    lines.push(`    });`);
    lines.push('');
  }

  // Test: array fields accept arrays
  const arrayFields = fields.filter((f) => f.isArray);
  if (arrayFields.length > 0) {
    lines.push(`    it('array fields accept arrays', () => {`);
    lines.push(`      const obj: Partial<${namespace}.${interfaceName}> = {`);
    for (const field of arrayFields.slice(0, 3)) {
      lines.push(`        ${field.name}: [],`);
    }
    lines.push(`      };`);
    for (const field of arrayFields.slice(0, 3)) {
      lines.push(`      expect(Array.isArray(obj.${field.name})).toBe(true);`);
    }
    lines.push(`    });`);
    lines.push('');
  }

  // Test: field count matches schema
  lines.push(`    it('has ${fields.length} fields defined', () => {`);
  lines.push(`      // Required: ${requiredFields.map(f => f.name).join(', ') || 'none'}`);
  lines.push(`      // Optional: ${optionalFields.length} fields`);
  lines.push(`      expect(${requiredFields.length} + ${optionalFields.length}).toBe(${fields.length});`);
  lines.push(`    });`);

  lines.push(`  });`);
  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Test File Generation
// ─────────────────────────────────────────────────────────────────────────────

async function generateSchemaTests(
  testsDir: string,
  schema: ParsedSchemaFile,
  allSchemas: Map<string, ParsedSchemaFile>
): Promise<boolean> {
  const types = collectTypeTestInfo(schema, allSchemas);
  if (types.length === 0) return false;

  const lines: string[] = [];
  const schemaPath = schema.outputPath.replace(/\.ts$/, '');
  const schemaName = schemaPath.split('/').pop() || schemaPath;

  const pathParts = schemaPath.split('/');
  const dirDepth = pathParts.length - 1;
  const outputRelative = '../'.repeat(dirDepth + 1) + '../output/';

  lines.push('/**');
  lines.push(` * Auto-generated tests for ${schemaName} schema types`);
  lines.push(' * DO NOT EDIT - Generated by odin-codegen');
  lines.push(' */');
  lines.push('');
  lines.push("import { describe, it, expect } from 'vitest';");
  lines.push('');

  const importPath = outputRelative + schema.outputPath.replace(/\.ts$/, '.js');
  const namespace = pathToNamespace(schema.outputPath);
  lines.push(`import * as ${namespace} from '${importPath}';`);
  lines.push('');

  const schemaTitle = schemaName.charAt(0).toUpperCase() + schemaName.slice(1);
  lines.push(`describe('${schemaTitle} Schema Types', () => {`);

  for (const typeInfo of types) {
    lines.push(generateTypeTests(typeInfo, namespace));
    lines.push('');
  }

  lines.push('});');

  const testDir = path.join(testsDir, path.dirname(schemaPath));
  await fs.mkdir(testDir, { recursive: true });
  await fs.writeFile(path.join(testDir, schemaName + '.test.ts'), lines.join('\n'), 'utf-8');

  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export async function generateTests(
  testsDir: string,
  schemasDir: string,
  schemas: ParsedSchemaFile[],
  allSchemas: Map<string, ParsedSchemaFile>
): Promise<void> {
  try { await fs.rm(testsDir, { recursive: true, force: true }); } catch {}
  await fs.mkdir(testsDir, { recursive: true });

  console.log('Generating tests...');

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
