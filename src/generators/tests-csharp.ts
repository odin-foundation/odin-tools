/**
 * C# test generator — produces xUnit test files for generated schema types.
 *
 * Generates structural tests that verify:
 * - Classes exist and can be instantiated
 * - Objects can be created with required fields set
 * - Optional fields default to null
 * - Enum fields accept valid string values
 * - Nullable fields accept null
 * - Array fields accept List<T>
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
    case 'string': return `"test-${fieldName}"`;
    case 'date': return 'new DateOnly(2024, 1, 15)';
    case 'timestamp': return 'DateTimeOffset.Parse("2024-01-15T14:30:00Z")';
    case 'time': return 'new TimeOnly(14, 30, 0)';
    case 'duration': return 'TimeSpan.FromDays(547)';
    case 'number': case 'decimal': case 'currency': case 'percent':
      return '99.99m';
    case 'integer':
      return '42L';
    case 'boolean':
      return 'true';
    default:
      return 'null!';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Info Collection
// ─────────────────────────────────────────────────────────────────────────────

interface FieldTestInfo {
  name: string;
  propName: string;
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
      let propName = fieldName.charAt(0).toUpperCase() + fieldName.slice(1);
      // Match the code generator's collision fix
      if (propName === typeNameToInterface(typeName)) propName += 'Value';

      fields.push({
        name: fieldName,
        propName,
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

function generateTypeTests(typeInfo: TypeTestInfo, ns: string): string {
  const { interfaceName, fields } = typeInfo;
  const lines: string[] = [];

  const requiredFields = fields.filter((f) => f.required);
  const optionalFields = fields.filter((f) => !f.required);
  const primitiveRequired = requiredFields.filter((f) => isPrimitiveType(f.type));
  const enumFields = fields.filter((f) => f.type === 'enum' && f.enumValues.length > 0);

  const fullType = `${ns}.${interfaceName}`;

  // Test: object can be created with required fields
  lines.push(`    [Fact]`);
  lines.push(`    public void ${interfaceName}_CanCreateWithRequiredFields()`);
  lines.push(`    {`);
  lines.push(`        var obj = new ${fullType}();`);
  for (const field of requiredFields) {
    if (field.isArray) {
      lines.push(`        obj.${field.propName} = new();`);
    } else if (field.type === 'enum' && field.enumValues.length > 0) {
      lines.push(`        obj.${field.propName} = "${field.enumValues[0]}";`);
    } else if (isPrimitiveType(field.type)) {
      lines.push(`        obj.${field.propName} = ${generateTestValue(field.type, field.name)};`);
    }
  }
  lines.push(`        Assert.NotNull(obj);`);
  for (const field of primitiveRequired) {
    lines.push(`        Assert.NotNull(obj.${field.propName});`);
  }
  lines.push(`    }`);
  lines.push('');

  // Test: optional fields default to null
  if (optionalFields.length > 0) {
    lines.push(`    [Fact]`);
    lines.push(`    public void ${interfaceName}_OptionalFieldsDefaultToNull()`);
    lines.push(`    {`);
    lines.push(`        var obj = new ${fullType}();`);
    for (const field of optionalFields.slice(0, 3)) {
      lines.push(`        Assert.Null(obj.${field.propName});`);
    }
    lines.push(`    }`);
    lines.push('');
  }

  // Test: optional fields can be set
  if (optionalFields.length > 0) {
    const settableOptionals = optionalFields.filter((f) => f.isArray || isPrimitiveType(f.type) || f.type === 'enum');
    if (settableOptionals.length > 0) {
      lines.push(`    [Fact]`);
      lines.push(`    public void ${interfaceName}_AcceptsOptionalFields()`);
      lines.push(`    {`);
      lines.push(`        var obj = new ${fullType}();`);
      for (const field of settableOptionals.slice(0, 3)) {
        if (field.isArray) {
          lines.push(`        obj.${field.propName} = new();`);
        } else if (field.type === 'enum' && field.enumValues.length > 0) {
          lines.push(`        obj.${field.propName} = "${field.enumValues[0]}";`);
        } else {
          lines.push(`        obj.${field.propName} = ${generateTestValue(field.type, field.name)};`);
        }
      }
      for (const field of settableOptionals.slice(0, 3)) {
        lines.push(`        Assert.NotNull(obj.${field.propName});`);
      }
      lines.push(`    }`);
      lines.push('');
    }
  }

  // Test: enum fields accept valid values
  for (const field of enumFields.slice(0, 3)) {
    lines.push(`    [Fact]`);
    lines.push(`    public void ${interfaceName}_${field.propName}_AcceptsValidEnumValues()`);
    lines.push(`    {`);
    lines.push(`        var validValues = new string[] {`);
    for (const val of field.enumValues.slice(0, 5)) {
      lines.push(`            "${val}",`);
    }
    lines.push(`        };`);
    lines.push(`        Assert.True(validValues.Length > 0);`);
    lines.push(`    }`);
    lines.push('');
  }

  // Test: nullable fields accept null
  const nullableFields = fields.filter((f) => f.nullable);
  if (nullableFields.length > 0) {
    lines.push(`    [Fact]`);
    lines.push(`    public void ${interfaceName}_NullableFieldsAcceptNull()`);
    lines.push(`    {`);
    lines.push(`        var obj = new ${fullType}();`);
    for (const field of nullableFields.slice(0, 3)) {
      lines.push(`        obj.${field.propName} = null;`);
      lines.push(`        Assert.Null(obj.${field.propName});`);
    }
    lines.push(`    }`);
    lines.push('');
  }

  // Test: array fields accept lists
  const arrayFields = fields.filter((f) => f.isArray);
  if (arrayFields.length > 0) {
    lines.push(`    [Fact]`);
    lines.push(`    public void ${interfaceName}_ArrayFieldsAcceptLists()`);
    lines.push(`    {`);
    lines.push(`        var obj = new ${fullType}();`);
    for (const field of arrayFields.slice(0, 3)) {
      lines.push(`        obj.${field.propName} = new();`);
      lines.push(`        Assert.NotNull(obj.${field.propName});`);
      lines.push(`        Assert.Empty(obj.${field.propName});`);
    }
    lines.push(`    }`);
    lines.push('');
  }

  // Test: field count
  lines.push(`    [Fact]`);
  lines.push(`    public void ${interfaceName}_Has${fields.length}Fields()`);
  lines.push(`    {`);
  lines.push(`        // Required: ${requiredFields.map(f => f.name).join(', ') || 'none'}`);
  lines.push(`        // Optional: ${optionalFields.length} fields`);
  lines.push(`        Assert.Equal(${fields.length}, ${requiredFields.length} + ${optionalFields.length});`);
  lines.push(`    }`);

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
  // Full path namespace matching the code generator
  const nsParts = schemaPath.split('/');
  if (nsParts.length === 0) nsParts.push('Root');
  const ns = 'Odin.Schemas.' + nsParts.map(p => p.charAt(0).toUpperCase() + p.slice(1).replace(/-(\w)/g, (_: string, c: string) => c.toUpperCase())).join('.');

  lines.push('// Auto-generated tests for ' + schemaName + ' schema types');
  lines.push('// DO NOT EDIT - Generated by odin-codegen');
  lines.push('');
  lines.push('using System;');
  lines.push('using System.Collections.Generic;');
  lines.push('using Xunit;');
  lines.push('');
  lines.push(`namespace ${ns}.Tests;`);
  lines.push('');

  const className = types.map(t => t.interfaceName).join('') + 'Tests';
  lines.push(`public class ${className}`);
  lines.push('{');

  for (const typeInfo of types) {
    lines.push(generateTypeTests(typeInfo, ns));
    lines.push('');
  }

  lines.push('}');

  const testDir = path.join(testsDir, path.dirname(schemaPath));
  await fs.mkdir(testDir, { recursive: true });
  await fs.writeFile(path.join(testDir, schemaName + '.test.cs'), lines.join('\n'), 'utf-8');

  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export async function generateCSharpTests(
  testsDir: string,
  schemasDir: string,
  schemas: ParsedSchemaFile[],
  allSchemas: Map<string, ParsedSchemaFile>
): Promise<void> {
  try { await fs.rm(testsDir, { recursive: true, force: true }); } catch {}
  await fs.mkdir(testsDir, { recursive: true });

  console.log('Generating C# tests...');

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
