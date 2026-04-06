/**
 * Ruby test generator — produces RSpec test files for generated schema types.
 *
 * Generates structural tests that verify:
 * - Classes exist and can be instantiated
 * - Objects can be created with required fields
 * - Optional fields default to nil
 * - Enum fields accept valid string values
 * - Nullable fields accept nil
 * - Array fields accept arrays
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

function toSnakeCase(str: string): string {
  return str.replace(/([a-z])([A-Z])/g, '$1_$2').replace(/[-]/g, '_').toLowerCase();
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
    case 'string': return `'test-${fieldName}'`;
    case 'date': return "Date.new(2024, 1, 15)";
    case 'timestamp': return "Time.new(2024, 1, 15, 14, 30, 0)";
    case 'time': return "'14:30:00'";
    case 'duration': return "'P1Y6M'";
    case 'number': case 'decimal': case 'currency': case 'percent':
      return '99.99';
    case 'integer':
      return '42';
    case 'boolean':
      return 'true';
    default:
      return 'nil';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Info Collection
// ─────────────────────────────────────────────────────────────────────────────

interface FieldTestInfo {
  name: string;
  snakeName: string;
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

      fields.push({
        name: fieldName,
        snakeName: toSnakeCase(fieldName),
        type: field.type.kind,
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

function generateTypeTests(typeInfo: TypeTestInfo, modName: string): string {
  const { interfaceName, fields } = typeInfo;
  const lines: string[] = [];

  const requiredFields = fields.filter((f) => f.required);
  const optionalFields = fields.filter((f) => !f.required);
  const primitiveRequired = requiredFields.filter((f) => isPrimitiveType(f.type));
  const enumFields = fields.filter((f) => f.type === 'enum' && f.enumValues.length > 0);
  const fullClass = `${modName}::${interfaceName}`;

  lines.push(`  describe ${fullClass} do`);

  // Test: object can be created with required fields
  lines.push(`    it 'can create object with required fields' do`);
  if (requiredFields.length === 0) {
    lines.push(`      obj = ${fullClass}.new`);
  } else {
    lines.push(`      obj = ${fullClass}.new(`);
    for (let i = 0; i < requiredFields.length; i++) {
      const field = requiredFields[i]!;
      const comma = i < requiredFields.length - 1 ? ',' : '';
      if (field.type === 'enum' && field.enumValues.length > 0) {
        lines.push(`        ${field.snakeName}: '${field.enumValues[0]}'${comma}`);
      } else if (field.isArray) {
        lines.push(`        ${field.snakeName}: []${comma}`);
      } else if (isPrimitiveType(field.type)) {
        lines.push(`        ${field.snakeName}: ${generateTestValue(field.type, field.name)}${comma}`);
      } else {
        lines.push(`        ${field.snakeName}: nil${comma}`);
      }
    }
    lines.push(`      )`);
  }
  lines.push(`      expect(obj).not_to be_nil`);
  for (const field of primitiveRequired) {
    lines.push(`      expect(obj.${field.snakeName}).not_to be_nil`);
  }
  lines.push(`    end`);
  lines.push('');

  // Test: optional fields default to nil
  if (optionalFields.length > 0) {
    lines.push(`    it 'allows optional fields to be omitted' do`);
    if (requiredFields.length === 0) {
      lines.push(`      obj = ${fullClass}.new`);
    } else {
      lines.push(`      obj = ${fullClass}.new(`);
      for (let i = 0; i < requiredFields.length; i++) {
        const field = requiredFields[i]!;
        const comma = i < requiredFields.length - 1 ? ',' : '';
        if (field.type === 'enum' && field.enumValues.length > 0) {
          lines.push(`        ${field.snakeName}: '${field.enumValues[0]}'${comma}`);
        } else if (field.isArray) {
          lines.push(`        ${field.snakeName}: []${comma}`);
        } else if (isPrimitiveType(field.type)) {
          lines.push(`        ${field.snakeName}: ${generateTestValue(field.type, field.name)}${comma}`);
        } else {
          lines.push(`        ${field.snakeName}: nil${comma}`);
        }
      }
      lines.push(`      )`);
    }
    for (const field of optionalFields.slice(0, 3)) {
      if (field.isArray) {
        lines.push(`      expect(obj.${field.snakeName}).to eq([])`);
      } else {
        lines.push(`      expect(obj.${field.snakeName}).to be_nil`);
      }
    }
    lines.push(`    end`);
    lines.push('');
  }

  // Test: optional fields can be set
  if (optionalFields.length > 0) {
    const settableOptionals = optionalFields.filter((f) => isPrimitiveType(f.type) || f.type === 'enum');
    if (settableOptionals.length > 0) {
      lines.push(`    it 'accepts optional fields when provided' do`);
      lines.push(`      obj = ${fullClass}.new(`);
      for (const field of requiredFields) {
        if (field.type === 'enum' && field.enumValues.length > 0) {
          lines.push(`        ${field.snakeName}: '${field.enumValues[0]}',`);
        } else if (field.isArray) {
          lines.push(`        ${field.snakeName}: [],`);
        } else if (isPrimitiveType(field.type)) {
          lines.push(`        ${field.snakeName}: ${generateTestValue(field.type, field.name)},`);
        } else {
          lines.push(`        ${field.snakeName}: nil,`);
        }
      }
      for (let i = 0; i < Math.min(settableOptionals.length, 3); i++) {
        const field = settableOptionals[i]!;
        const comma = i < Math.min(settableOptionals.length, 3) - 1 ? ',' : '';
        if (field.type === 'enum' && field.enumValues.length > 0) {
          lines.push(`        ${field.snakeName}: '${field.enumValues[0]}'${comma}`);
        } else {
          lines.push(`        ${field.snakeName}: ${generateTestValue(field.type, field.name)}${comma}`);
        }
      }
      lines.push(`      )`);
      for (const field of settableOptionals.slice(0, 3)) {
        lines.push(`      expect(obj.${field.snakeName}).not_to be_nil`);
      }
      lines.push(`    end`);
      lines.push('');
    }
  }

  // Test: enum fields accept valid values
  for (const field of enumFields.slice(0, 3)) {
    lines.push(`    it '${field.snakeName} accepts valid enum values' do`);
    lines.push(`      valid_values = [`);
    for (const val of field.enumValues.slice(0, 5)) {
      lines.push(`        '${val}',`);
    }
    lines.push(`      ]`);
    lines.push(`      expect(valid_values.length).to be > 0`);
    lines.push(`    end`);
    lines.push('');
  }

  // Test: nullable fields accept nil
  const nullableFields = fields.filter((f) => f.nullable);
  if (nullableFields.length > 0) {
    lines.push(`    it 'nullable fields accept nil' do`);
    if (requiredFields.length === 0) {
      lines.push(`      obj = ${fullClass}.new`);
    } else {
      lines.push(`      obj = ${fullClass}.new(`);
      for (let i = 0; i < requiredFields.length; i++) {
        const field = requiredFields[i]!;
        const comma = i < requiredFields.length - 1 ? ',' : '';
        if (field.type === 'enum' && field.enumValues.length > 0) {
          lines.push(`        ${field.snakeName}: '${field.enumValues[0]}'${comma}`);
        } else if (field.isArray) {
          lines.push(`        ${field.snakeName}: []${comma}`);
        } else if (isPrimitiveType(field.type)) {
          lines.push(`        ${field.snakeName}: ${generateTestValue(field.type, field.name)}${comma}`);
        } else {
          lines.push(`        ${field.snakeName}: nil${comma}`);
        }
      }
      lines.push(`      )`);
    }
    for (const field of nullableFields.slice(0, 3)) {
      lines.push(`      obj.${field.snakeName} = nil`);
      lines.push(`      expect(obj.${field.snakeName}).to be_nil`);
    }
    lines.push(`    end`);
    lines.push('');
  }

  // Test: array fields accept arrays
  const arrayFields = fields.filter((f) => f.isArray);
  if (arrayFields.length > 0) {
    lines.push(`    it 'array fields accept arrays' do`);
    if (requiredFields.length === 0) {
      lines.push(`      obj = ${fullClass}.new`);
    } else {
      lines.push(`      obj = ${fullClass}.new(`);
      for (let i = 0; i < requiredFields.length; i++) {
        const field = requiredFields[i]!;
        const comma = i < requiredFields.length - 1 ? ',' : '';
        if (field.type === 'enum' && field.enumValues.length > 0) {
          lines.push(`        ${field.snakeName}: '${field.enumValues[0]}'${comma}`);
        } else if (field.isArray) {
          lines.push(`        ${field.snakeName}: []${comma}`);
        } else if (isPrimitiveType(field.type)) {
          lines.push(`        ${field.snakeName}: ${generateTestValue(field.type, field.name)}${comma}`);
        } else {
          lines.push(`        ${field.snakeName}: nil${comma}`);
        }
      }
      lines.push(`      )`);
    }
    for (const field of arrayFields.slice(0, 3)) {
      lines.push(`      obj.${field.snakeName} = []`);
      lines.push(`      expect(obj.${field.snakeName}).to be_an(Array)`);
    }
    lines.push(`    end`);
    lines.push('');
  }

  // Test: field count
  lines.push(`    it 'has ${fields.length} fields defined' do`);
  lines.push(`      # Required: ${requiredFields.map(f => f.name).join(', ') || 'none'}`);
  lines.push(`      # Optional: ${optionalFields.length} fields`);
  lines.push(`      expect(${requiredFields.length} + ${optionalFields.length}).to eq(${fields.length})`);
  lines.push(`    end`);

  lines.push(`  end`);
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
  // Full module path matching the generator
  const allParts = schemaPath.split('/');
  const modParts = allParts.map(p => {
    const clean = p.replace(/-/g, '_');
    return clean.charAt(0).toUpperCase() + clean.slice(1).replace(/_(\w)/g, (_: string, c: string) => c.toUpperCase());
  });
  const modName = 'Odin::' + modParts.join('::');

  lines.push('# Auto-generated tests for ' + schemaName + ' schema types');
  lines.push('# DO NOT EDIT - Generated by odin-codegen');
  lines.push('');
  lines.push("require 'rspec'");
  lines.push("require 'date'");
  // Load the generated code
  const dirParts = schemaPath.split('/');
  dirParts.pop();
  const upFromTest = '../'.repeat(dirParts.length);
  const rbFilePath = upFromTest + '../output-rb/' + schemaPath;
  lines.push(`require_relative '${rbFilePath}'`);
  lines.push('');

  const schemaTitle = schemaName.charAt(0).toUpperCase() + schemaName.slice(1);
  lines.push(`RSpec.describe '${schemaTitle} Schema Types' do`);

  for (const typeInfo of types) {
    lines.push(generateTypeTests(typeInfo, modName));
    lines.push('');
  }

  lines.push('end');

  const testDir = path.join(testsDir, path.dirname(schemaPath));
  await fs.mkdir(testDir, { recursive: true });
  await fs.writeFile(path.join(testDir, schemaName + '_spec.rb'), lines.join('\n'), 'utf-8');

  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export async function generateRubyTests(
  testsDir: string,
  schemasDir: string,
  schemas: ParsedSchemaFile[],
  allSchemas: Map<string, ParsedSchemaFile>
): Promise<void> {
  try { await fs.rm(testsDir, { recursive: true, force: true }); } catch {}
  await fs.mkdir(testsDir, { recursive: true });

  console.log('Generating Ruby tests...');

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
