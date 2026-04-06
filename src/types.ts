import type { OdinSchema, SchemaType, SchemaField } from '@odin-foundation/core';

export interface ParsedSchemaFile {
  relativePath: string;
  namespaceId: string;
  schema: OdinSchema;
  types: ReadonlyMap<string, SchemaType>;
  dependencies: Set<string>;
  outputPath: string;
  exportedTypes: Set<string>;
}

export interface ResolvedType {
  typeName: string;
  interfaceName: string;
  factoryName: string;
  factoryPropName: string;
  arrayFields: string[];
  requiredFields: string[];
  fields: Map<string, { field: SchemaField; isArray: boolean }>;
}
