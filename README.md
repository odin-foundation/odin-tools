# ODIN Tools

Developer tools for the ODIN ecosystem — schema code generation, cross-language test validation, and build utilities.

## Schema Code Generator

Reads `.schema.odin` files and generates typed classes with native test suites for 6 languages.

### Installation

```bash
npm install
```

### Usage

```bash
npx tsx src/cli.ts --schemas <path> --output <path> [--tests <path>] [--lang <language>]
```

### Options

| Option | Description | Required | Default |
|--------|-------------|----------|---------|
| `--schemas` | Path to directory containing `.schema.odin` files | Yes | — |
| `--output` | Directory for generated source code | No | `./output` |
| `--tests` | Directory for generated test files (omit to skip test generation) | No | — |
| `--lang` | Target language (see table below) | No | `typescript` |

### Languages

| `--lang` value | Language | Generated Code | Test Framework |
|----------------|----------|---------------|----------------|
| `typescript` | TypeScript | Interfaces with JSDoc constraints | vitest |
| `csharp` | C# / .NET | Classes with `[Required]` DataAnnotation attributes | xUnit |
| `java` | Java | Classes with getters/setters, `BigDecimal` for currency | JUnit 5 |
| `python` | Python | `@dataclass` classes with type hints | pytest |
| `ruby` | Ruby | Classes with `attr_accessor`, `validate!`, `to_hash` | RSpec |
| `rust` | Rust | Structs with `#[derive(Serialize, Deserialize)]` | `#[test]` (inline) |

### Examples

Generate TypeScript interfaces with tests:

```bash
npx tsx src/cli.ts --schemas ../schemas --output ./output --tests ./tests --lang typescript
npx vitest run
```

Generate Python dataclasses with tests:

```bash
npx tsx src/cli.ts --schemas ../schemas --output ./output-py --tests ./tests-py --lang python
python -m pytest tests-py/
```

Generate C# classes (no tests):

```bash
npx tsx src/cli.ts --schemas ../schemas --output ./output --lang csharp
```

Generate Java classes with tests:

```bash
npx tsx src/cli.ts --schemas ../schemas --output ./output --tests ./tests --lang java
# Copy to Maven project structure, then: mvn test
```

Generate Ruby classes with tests:

```bash
npx tsx src/cli.ts --schemas ../schemas --output ./output-rb --tests ./tests-rb --lang ruby
rspec tests-rb/
```

Generate Rust structs (tests are appended inline to source files):

```bash
npx tsx src/cli.ts --schemas ../schemas --output ./output-rs --tests ./tests-rs --lang rust
# Set up Cargo project with serde dependency, generate mod.rs tree, then: cargo test
```

### What Gets Generated

#### Source Code

Each schema produces one file per language containing typed classes or structs for every type defined in the schema. Cross-schema references that cannot be resolved locally fall back to the language's generic type (`object`, `Object`, `Any`, `serde_json::Value`).

**TypeScript** (`insurance/certificate.ts`):
```typescript
export interface CertificateCoverageLine {
  policyNumber: string;
  effective: string;
  expiration: string;
  lineId?: string;
  sequence?: number;
  coverageType?: 'automobile_liability' | 'bodily_injury' | ...;
}
```

**Python** (`insurance/certificate.py`):
```python
@dataclass
class CertificateCoverageLine:
    policy_number: str
    effective: date
    expiration: date
    line_id: str | None = None
    sequence: int | None = None
    coverage_type: str | None = None
```

**C#** (`insurance/certificate.cs`):
```csharp
public class CertificateCoverageLine
{
    [Required]
    public string PolicyNumber { get; set; }
    [Required]
    public DateOnly Effective { get; set; }
    [Required]
    public DateOnly Expiration { get; set; }
    public string LineId { get; set; }
    public long? Sequence { get; set; }
}
```

#### Test Suites

When `--tests` is provided, native test files are generated that verify:

- Objects can be created with all required fields populated
- Optional fields default to null/None/nil when omitted
- Optional fields accept values when provided
- Enum fields accept valid string values
- Nullable fields accept null/None/nil
- Array/List/Vec fields accept empty collections
- Total field count matches the schema definition

Each test uses the target language's idiomatic test framework and can be run with the standard test runner.

### Type Mappings

| ODIN Type | TypeScript | C# | Java | Python | Ruby | Rust |
|-----------|-----------|-----|------|--------|------|------|
| `string` | `string` | `string` | `String` | `str` | `String` | `String` |
| `number` | `number` | `decimal` | `BigDecimal` | `Decimal` | `Float` | `f64` |
| `integer` | `number` | `long` | `Long` | `int` | `Integer` | `i64` |
| `currency` | `number` | `decimal` | `BigDecimal` | `Decimal` | `Float` | `f64` |
| `boolean` | `boolean` | `bool` | `Boolean` | `bool` | `Boolean` | `bool` |
| `date` | `string` | `DateOnly` | `LocalDate` | `date` | `Date` | `String` |
| `timestamp` | `string` | `DateTimeOffset` | `OffsetDateTime` | `datetime` | `Time` | `String` |

### Architecture

```
src/
  cli.ts                      CLI entry point
  codegen.ts                  Schema discovery, parsing, shared utilities
  types.ts                    Shared TypeScript interfaces
  web-adapter.ts              Adapter for website integration (SchemaDoc JSON → generators)
  generators/
    typescript.ts             TypeScript interface generation
    csharp.ts                 C# class generation
    java.ts                   Java class generation
    python.ts                 Python dataclass generation
    ruby.ts                   Ruby class generation
    rust.ts                   Rust struct generation
    tests.ts                  TypeScript test generation (vitest)
    tests-csharp.ts           C# test generation (xUnit)
    tests-java.ts             Java test generation (JUnit 5)
    tests-python.ts           Python test generation (pytest)
    tests-ruby.ts             Ruby test generation (RSpec)
    tests-rust.ts             Rust test generation (#[test])
```

The tool uses `Odin.parseSchema()` from `@odin-foundation/core` to parse `.schema.odin` files directly. Cross-schema imports and type composition are resolved automatically.

The `web-adapter.ts` module allows the [odin.foundation](https://odin.foundation) website to use the same generators for its schema code download feature, ensuring the website and CLI produce identical output.

## License

Apache License 2.0
