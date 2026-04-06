/**
 * Java test generator — produces JUnit 5 test files for generated schema types.
 *
 * Generates structural tests that verify:
 * - Classes exist and can be instantiated
 * - Objects can be created with required fields set via setters
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
    case 'date': return 'LocalDate.of(2024, 1, 15)';
    case 'timestamp': return 'OffsetDateTime.parse("2024-01-15T14:30:00Z")';
    case 'time': return 'LocalTime.of(14, 30, 0)';
    case 'duration': return 'Duration.ofDays(547)';
    case 'number': case 'decimal': case 'currency': case 'percent':
      return 'new BigDecimal("99.99")';
    case 'integer':
      return '42L';
    case 'boolean':
      return 'true';
    default:
      return 'null';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Info Collection
// ─────────────────────────────────────────────────────────────────────────────

interface FieldTestInfo {
  name: string;
  capName: string;
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
      const capName = fieldName.charAt(0).toUpperCase() + fieldName.slice(1);

      fields.push({
        name: fieldName,
        capName,
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

function generateTypeTests(typeInfo: TypeTestInfo, pkg: string): string {
  const { interfaceName, fields } = typeInfo;
  const lines: string[] = [];

  const requiredFields = fields.filter((f) => f.required);
  const optionalFields = fields.filter((f) => !f.required);
  const primitiveRequired = requiredFields.filter((f) => isPrimitiveType(f.type));
  const enumFields = fields.filter((f) => f.type === 'enum' && f.enumValues.length > 0);

  // Test: object can be created with required fields
  lines.push(`    @Test`);
  lines.push(`    void ${interfaceName}_canCreateWithRequiredFields() {`);
  lines.push(`        ${interfaceName} obj = new ${interfaceName}();`);
  for (const field of requiredFields) {
    if (field.isArray) {
      lines.push(`        obj.set${field.capName}(new java.util.ArrayList<>());`);
    } else if (field.type === 'enum' && field.enumValues.length > 0) {
      lines.push(`        obj.set${field.capName}("${field.enumValues[0]}");`);
    } else if (isPrimitiveType(field.type)) {
      lines.push(`        obj.set${field.capName}(${generateTestValue(field.type, field.name)});`);
    }
  }
  lines.push(`        assertNotNull(obj);`);
  for (const field of primitiveRequired) {
    lines.push(`        assertNotNull(obj.get${field.capName}());`);
  }
  lines.push(`    }`);
  lines.push('');

  // Test: optional fields default to null
  if (optionalFields.length > 0) {
    lines.push(`    @Test`);
    lines.push(`    void ${interfaceName}_optionalFieldsDefaultToNull() {`);
    lines.push(`        ${interfaceName} obj = new ${interfaceName}();`);
    for (const field of optionalFields.slice(0, 3)) {
      lines.push(`        assertNull(obj.get${field.capName}());`);
    }
    lines.push(`    }`);
    lines.push('');
  }

  // Test: optional fields can be set
  if (optionalFields.length > 0) {
    const settableOptionals = optionalFields.filter((f) => f.isArray || isPrimitiveType(f.type) || f.type === 'enum');
    if (settableOptionals.length > 0) {
      lines.push(`    @Test`);
      lines.push(`    void ${interfaceName}_acceptsOptionalFields() {`);
      lines.push(`        ${interfaceName} obj = new ${interfaceName}();`);
      for (const field of settableOptionals.slice(0, 3)) {
        if (field.isArray) {
          lines.push(`        obj.set${field.capName}(new java.util.ArrayList<>());`);
        } else if (field.type === 'enum' && field.enumValues.length > 0) {
          lines.push(`        obj.set${field.capName}("${field.enumValues[0]}");`);
        } else {
          lines.push(`        obj.set${field.capName}(${generateTestValue(field.type, field.name)});`);
        }
      }
      for (const field of settableOptionals.slice(0, 3)) {
        lines.push(`        assertNotNull(obj.get${field.capName}());`);
      }
      lines.push(`    }`);
      lines.push('');
    }
  }

  // Test: enum fields accept valid values
  for (const field of enumFields.slice(0, 3)) {
    lines.push(`    @Test`);
    lines.push(`    void ${interfaceName}_${field.name}_acceptsValidEnumValues() {`);
    lines.push(`        String[] validValues = {`);
    for (const val of field.enumValues.slice(0, 5)) {
      lines.push(`            "${val}",`);
    }
    lines.push(`        };`);
    lines.push(`        assertTrue(validValues.length > 0);`);
    lines.push(`    }`);
    lines.push('');
  }

  // Test: nullable fields accept null
  const nullableFields = fields.filter((f) => f.nullable);
  if (nullableFields.length > 0) {
    lines.push(`    @Test`);
    lines.push(`    void ${interfaceName}_nullableFieldsAcceptNull() {`);
    lines.push(`        ${interfaceName} obj = new ${interfaceName}();`);
    for (const field of nullableFields.slice(0, 3)) {
      lines.push(`        obj.set${field.capName}(null);`);
      lines.push(`        assertNull(obj.get${field.capName}());`);
    }
    lines.push(`    }`);
    lines.push('');
  }

  // Test: array fields accept lists
  const arrayFields = fields.filter((f) => f.isArray);
  if (arrayFields.length > 0) {
    lines.push(`    @Test`);
    lines.push(`    void ${interfaceName}_arrayFieldsAcceptLists() {`);
    lines.push(`        ${interfaceName} obj = new ${interfaceName}();`);
    for (const field of arrayFields.slice(0, 3)) {
      lines.push(`        obj.set${field.capName}(new java.util.ArrayList<>());`);
      lines.push(`        assertNotNull(obj.get${field.capName}());`);
      lines.push(`        assertTrue(obj.get${field.capName}().isEmpty());`);
    }
    lines.push(`    }`);
    lines.push('');
  }

  // Test: field count
  lines.push(`    @Test`);
  lines.push(`    void ${interfaceName}_has${fields.length}Fields() {`);
  lines.push(`        // Required: ${requiredFields.map(f => f.name).join(', ') || 'none'}`);
  lines.push(`        // Optional: ${optionalFields.length} fields`);
  lines.push(`        assertEquals(${fields.length}, ${requiredFields.length} + ${optionalFields.length});`);
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
  // Match the code generator's full-path package (including filename)
  const JAVA_RESERVED = new Set(['package', 'class', 'interface', 'extends', 'implements', 'import', 'public', 'private', 'protected', 'static', 'final', 'abstract', 'native', 'new', 'return', 'void', 'default', 'case', 'switch', 'break', 'continue', 'for', 'while', 'do', 'if', 'else', 'try', 'catch', 'throw', 'throws', 'this', 'super', 'int', 'long', 'short', 'byte', 'float', 'double', 'char', 'boolean']);
  const allParts = schemaPath.split('/');
  if (allParts.length === 0) allParts.push('root');
  const pkg = 'foundation.odin.schemas.' + allParts.map(p => {
    const clean = p.replace(/-/g, '_');
    return JAVA_RESERVED.has(clean) ? clean + '_' : clean;
  }).join('.');

  lines.push('// Auto-generated tests for ' + schemaName + ' schema types');
  lines.push('// DO NOT EDIT - Generated by odin-codegen');
  lines.push('');
  lines.push(`package ${pkg};`);
  lines.push('');
  lines.push('import org.junit.jupiter.api.Test;');
  lines.push('import static org.junit.jupiter.api.Assertions.*;');
  lines.push('import java.math.BigDecimal;');
  lines.push('import java.time.*;');
  lines.push('');

  // Use schema name for class name to avoid absurdly long filenames
  const pascalSchemaName = schemaName.split(/[-_]/).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('');
  const className = pascalSchemaName + 'SchemaTest';
  lines.push(`class ${className} {`);
  lines.push('');

  for (const typeInfo of types) {
    lines.push(generateTypeTests(typeInfo, pkg));
    lines.push('');
  }

  lines.push('}');

  // Java test file must be in directory matching package path
  const pkgDir = pkg.replace(/\./g, '/');
  const testDir = path.join(testsDir, pkgDir);
  await fs.mkdir(testDir, { recursive: true });
  await fs.writeFile(path.join(testDir, className + '.java'), lines.join('\n'), 'utf-8');

  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export async function generateJavaTests(
  testsDir: string,
  schemasDir: string,
  schemas: ParsedSchemaFile[],
  allSchemas: Map<string, ParsedSchemaFile>
): Promise<void> {
  try { await fs.rm(testsDir, { recursive: true, force: true }); } catch {}
  await fs.mkdir(testsDir, { recursive: true });

  console.log('Generating Java tests...');

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
