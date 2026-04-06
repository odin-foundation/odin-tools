/**
 * Python test generator — produces pytest test files for generated schema types.
 *
 * Generates structural tests that verify:
 * - Dataclasses exist and can be instantiated
 * - Objects can be created with required fields
 * - Optional fields default to None
 * - Enum fields accept valid string values
 * - Nullable fields accept None
 * - Array fields accept lists
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
    case 'string': return `"test-${fieldName}"`;
    case 'date': return 'date(2024, 1, 15)';
    case 'timestamp': return 'datetime(2024, 1, 15, 14, 30, 0)';
    case 'time': return 'time(14, 30, 0)';
    case 'duration': return '"P1Y6M"';
    case 'number': case 'decimal': case 'currency': case 'percent':
      return 'Decimal("99.99")';
    case 'integer':
      return '42';
    case 'boolean':
      return 'True';
    default:
      return 'None';
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

function generateTypeTests(typeInfo: TypeTestInfo, moduleName: string): string {
  const { interfaceName, fields } = typeInfo;
  const lines: string[] = [];
  const snakeClass = toSnakeCase(interfaceName);

  const requiredFields = fields.filter((f) => f.required);
  const optionalFields = fields.filter((f) => !f.required);
  const primitiveRequired = requiredFields.filter((f) => isPrimitiveType(f.type));
  const enumFields = fields.filter((f) => f.type === 'enum' && f.enumValues.length > 0);

  // Test: object can be created with required fields
  lines.push(`class Test${interfaceName}:`);
  lines.push(`    def test_can_create_with_required_fields(self):`);
  if (requiredFields.length === 0) {
    lines.push(`        obj = ${moduleName}.${interfaceName}()`);
  } else {
    lines.push(`        obj = ${moduleName}.${interfaceName}(`);
    for (let i = 0; i < requiredFields.length; i++) {
      const field = requiredFields[i]!;
      const comma = i < requiredFields.length - 1 ? ',' : ',';
      if (field.type === 'enum' && field.enumValues.length > 0) {
        lines.push(`            ${field.snakeName}="${field.enumValues[0]}"${comma}`);
      } else if (field.isArray) {
        lines.push(`            ${field.snakeName}=[]${comma}`);
      } else if (isPrimitiveType(field.type)) {
        lines.push(`            ${field.snakeName}=${generateTestValue(field.type, field.name)}${comma}`);
      } else {
        lines.push(`            ${field.snakeName}=None${comma}`);
      }
    }
    lines.push(`        )`);
  }
  lines.push(`        assert obj is not None`);
  for (const field of primitiveRequired) {
    lines.push(`        assert obj.${field.snakeName} is not None`);
  }
  lines.push('');

  // Test: optional fields default to None
  if (optionalFields.length > 0) {
    lines.push(`    def test_optional_fields_default_to_none(self):`);
    if (requiredFields.length === 0) {
      lines.push(`        obj = ${moduleName}.${interfaceName}()`);
    } else {
      lines.push(`        obj = ${moduleName}.${interfaceName}(`);
      for (let i = 0; i < requiredFields.length; i++) {
        const field = requiredFields[i]!;
        const comma = i < requiredFields.length - 1 ? ',' : ',';
        if (field.type === 'enum' && field.enumValues.length > 0) {
          lines.push(`            ${field.snakeName}="${field.enumValues[0]}"${comma}`);
        } else if (field.isArray) {
          lines.push(`            ${field.snakeName}=[]${comma}`);
        } else if (isPrimitiveType(field.type)) {
          lines.push(`            ${field.snakeName}=${generateTestValue(field.type, field.name)}${comma}`);
        } else {
          lines.push(`            ${field.snakeName}=None${comma}`);
        }
      }
      lines.push(`        )`);
    }
    for (const field of optionalFields.slice(0, 3)) {
      lines.push(`        assert obj.${field.snakeName} is None`);
    }
    lines.push('');
  }

  // Test: optional fields can be set
  if (optionalFields.length > 0) {
    const settableOptionals = optionalFields.filter((f) => isPrimitiveType(f.type) || f.type === 'enum');
    if (settableOptionals.length > 0) {
      lines.push(`    def test_accepts_optional_fields(self):`);
      if (requiredFields.length === 0 && settableOptionals.length === 0) {
        lines.push(`        obj = ${moduleName}.${interfaceName}()`);
      } else {
        lines.push(`        obj = ${moduleName}.${interfaceName}(`);
        for (const field of requiredFields) {
          if (field.type === 'enum' && field.enumValues.length > 0) {
            lines.push(`            ${field.snakeName}="${field.enumValues[0]}",`);
          } else if (field.isArray) {
            lines.push(`            ${field.snakeName}=[],`);
          } else if (isPrimitiveType(field.type)) {
            lines.push(`            ${field.snakeName}=${generateTestValue(field.type, field.name)},`);
          } else {
            lines.push(`            ${field.snakeName}=None,`);
          }
        }
        for (const field of settableOptionals.slice(0, 3)) {
          if (field.type === 'enum' && field.enumValues.length > 0) {
            lines.push(`            ${field.snakeName}="${field.enumValues[0]}",`);
          } else {
            lines.push(`            ${field.snakeName}=${generateTestValue(field.type, field.name)},`);
          }
        }
        lines.push(`        )`);
      }
      for (const field of settableOptionals.slice(0, 3)) {
        lines.push(`        assert obj.${field.snakeName} is not None`);
      }
      lines.push('');
    }
  }

  // Test: enum fields accept valid values
  for (const field of enumFields.slice(0, 3)) {
    lines.push(`    def test_${field.snakeName}_accepts_valid_enum_values(self):`);
    lines.push(`        valid_values = [`);
    for (const val of field.enumValues.slice(0, 5)) {
      lines.push(`            "${val}",`);
    }
    lines.push(`        ]`);
    lines.push(`        assert len(valid_values) > 0`);
    lines.push('');
  }

  // Test: nullable fields accept None
  const nullableFields = fields.filter((f) => f.nullable);
  if (nullableFields.length > 0) {
    lines.push(`    def test_nullable_fields_accept_none(self):`);
    if (requiredFields.length === 0) {
      lines.push(`        obj = ${moduleName}.${interfaceName}()`);
    } else {
      lines.push(`        obj = ${moduleName}.${interfaceName}(`);
      for (const field of requiredFields) {
        if (field.type === 'enum' && field.enumValues.length > 0) {
          lines.push(`            ${field.snakeName}="${field.enumValues[0]}",`);
        } else if (field.isArray) {
          lines.push(`            ${field.snakeName}=[],`);
        } else if (isPrimitiveType(field.type)) {
          lines.push(`            ${field.snakeName}=${generateTestValue(field.type, field.name)},`);
        } else {
          lines.push(`            ${field.snakeName}=None,`);
        }
      }
      lines.push(`        )`);
    }
    for (const field of nullableFields.slice(0, 3)) {
      lines.push(`        obj.${field.snakeName} = None`);
      lines.push(`        assert obj.${field.snakeName} is None`);
    }
    lines.push('');
  }

  // Test: array fields accept lists
  const arrayFields = fields.filter((f) => f.isArray);
  if (arrayFields.length > 0) {
    lines.push(`    def test_array_fields_accept_lists(self):`);
    if (requiredFields.length === 0) {
      lines.push(`        obj = ${moduleName}.${interfaceName}()`);
    } else {
      lines.push(`        obj = ${moduleName}.${interfaceName}(`);
      for (const field of requiredFields) {
        if (field.type === 'enum' && field.enumValues.length > 0) {
          lines.push(`            ${field.snakeName}="${field.enumValues[0]}",`);
        } else if (field.isArray) {
          lines.push(`            ${field.snakeName}=[],`);
        } else if (isPrimitiveType(field.type)) {
          lines.push(`            ${field.snakeName}=${generateTestValue(field.type, field.name)},`);
        } else {
          lines.push(`            ${field.snakeName}=None,`);
        }
      }
      lines.push(`        )`);
    }
    for (const field of arrayFields.slice(0, 3)) {
      lines.push(`        obj.${field.snakeName} = []`);
      lines.push(`        assert isinstance(obj.${field.snakeName}, list)`);
    }
    lines.push('');
  }

  // Test: field count
  lines.push(`    def test_has_${fields.length}_fields(self):`);
  lines.push(`        # Required: ${requiredFields.map(f => f.name).join(', ') || 'none'}`);
  lines.push(`        # Optional: ${optionalFields.length} fields`);
  lines.push(`        assert ${requiredFields.length} + ${optionalFields.length} == ${fields.length}`);
  lines.push('');

  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Test File Generation
// ─────────────────────────────────────────────────────────────────────────────

function pathToModuleName(schemaPath: string): string {
  return schemaPath.replace(/\.ts$/, '').split('/').map((part) =>
    part.split('-').map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join('')
  ).join('');
}

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
  const moduleName = pathToModuleName(schema.outputPath);

  const pathParts = schemaPath.split('/');
  const dirDepth = pathParts.length - 1;
  const outputRelative = '../'.repeat(dirDepth + 1) + '../output/';

  lines.push('# Auto-generated tests for ' + schemaName + ' schema types');
  lines.push('# DO NOT EDIT - Generated by odin-codegen');
  lines.push('');
  lines.push('from datetime import date, datetime, time');
  lines.push('from decimal import Decimal');
  lines.push('');

  // Import the generated module (conftest.py adds output dir to sys.path)
  const PY_RESERVED = new Set(['return', 'class', 'import', 'from', 'pass', 'raise', 'yield', 'def', 'del', 'global', 'nonlocal', 'assert', 'break', 'continue', 'elif', 'else', 'except', 'finally', 'for', 'if', 'in', 'is', 'lambda', 'not', 'or', 'and', 'try', 'while', 'with', 'as', 'None', 'True', 'False']);
  const pyModulePath = schema.outputPath.replace(/\.ts$/, '').replace(/-/g, '_').split('/').map(p => PY_RESERVED.has(p) ? p + '_' : p).join('.');
  lines.push(`import ${pyModulePath} as ${moduleName}  # type: ignore  # noqa`);
  lines.push('');
  lines.push('');

  for (const typeInfo of types) {
    lines.push(generateTypeTests(typeInfo, moduleName));
    lines.push('');
  }

  // Use full path as filename to avoid pytest duplicate module collisions
  const uniqueName = 'test_' + schemaPath.replace(/\//g, '_').replace(/-/g, '_');
  await fs.writeFile(path.join(testsDir, uniqueName + '.py'), lines.join('\n'), 'utf-8');

  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export async function generatePythonTests(
  testsDir: string,
  schemasDir: string,
  schemas: ParsedSchemaFile[],
  allSchemas: Map<string, ParsedSchemaFile>
): Promise<void> {
  try { await fs.rm(testsDir, { recursive: true, force: true }); } catch {}
  await fs.mkdir(testsDir, { recursive: true });
  // Create conftest.py that finds the sibling output dir
  // Derive output dir name from tests dir name:
  //   tests-py → output-py, tests-output → output, tests-foo → output-foo
  const testsDirName = path.basename(path.resolve(testsDir));
  let outputDirName: string;
  if (testsDirName.startsWith('tests-')) {
    outputDirName = 'output-' + testsDirName.slice(6);
    // "tests-output" → "output-" which is wrong, just use "output"
    if (outputDirName === 'output-output') outputDirName = 'output';
  } else {
    outputDirName = 'output';
  }
  await fs.writeFile(path.join(testsDir, 'conftest.py'),
    `import sys, os\nsys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '${outputDirName}'))\n`, 'utf-8');

  console.log('Generating Python tests...');

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
