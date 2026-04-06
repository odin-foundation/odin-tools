# ODIN SDK Benchmark Suite

Cross-language performance benchmarks for all ODIN SDK implementations.

## Results

Benchmarks run on the same machine to ensure fair comparison. Operations per second (higher is better).

### Core Operations

| Benchmark | Rust | Java | .NET | TypeScript | Python | Ruby |
|---|---|---|---|---|---|---|
| parse-small | 55.2K | 52.1K | 59.4K | 18.3K | 1.8K | 1.8K |
| parse-medium | 7.4K | 6.4K | 5.1K | 2.8K | 328 | 309 |
| parse-large | 286 | 298 | 89 | 139 | 18 | 13 |
| stringify-small | 770.2K | 221.8K | 170.3K | 45.5K | 6.7K | 4.6K |
| stringify-medium | 161.2K | 35.0K | 78.3K | 5.2K | 940 | 700 |
| stringify-large | 7.0K | 2.1K | 2.0K | 206 | 43 | 30 |
| canonicalize-medium | 19.1K | 2.1K | 12.5K | 4.8K | 1.3K | 425 |
| diff-medium | 37.2K | 49.3K | 26.8K | 25.7K | 4.9K | 2.4K |

### Transform Engine

| Benchmark | Rust | Java | .NET | TypeScript | Python | Ruby |
|---|---|---|---|---|---|---|
| parse-transform | 2.6K | 4.3K | 6.0K | 1.9K | 170 | 176 |
| exec-json-json | 94.9K | 33.2K | 31.6K | 25.8K | 4.5K | 3.5K |
| exec-json-odin | 2.4K | 4.3K | 4.1K | 1.3K | 425 | 304 |

### Transform Verbs

| Benchmark | Rust | Java | .NET | TypeScript | Python | Ruby |
|---|---|---|---|---|---|---|
| tx-string | 17.2K | 18.5K | 27.2K | 16.7K | 2.6K | 2.6K |
| tx-numeric | 18.3K | 26.1K | 21.4K | 19.7K | 2.3K | 2.0K |
| tx-datetime | 26.9K | 5.6K | 33.8K | 1.9K | 2.6K | 1.8K |
| tx-financial | 36.8K | 42.2K | 48.7K | 32.3K | 3.6K | 3.0K |
| tx-collection | 8.9K | 24.5K | 35.6K | 9.2K | 2.1K | 1.9K |
| tx-logic | 17.6K | 32.9K | 47.1K | 22.4K | 3.2K | 3.2K |

### Validation

| Benchmark | Rust | Java | .NET | TypeScript | Python | Ruby |
|---|---|---|---|---|---|---|
| validate-schema | 177.8K | 109.2K | 158.6K | 97.8K | 24.1K | 32.7K |

### Export

| Benchmark | Rust | Java | .NET | TypeScript | Python | Ruby |
|---|---|---|---|---|---|---|
| export-json | 29.5K | 17.5K | 29.0K | 17.7K | 2.8K | 4.9K |
| export-xml | 30.8K | 19.5K | 37.9K | 10.3K | 1.9K | 5.3K |
| export-csv | 37.6K | 25.8K | 24.6K | 21.7K | 7.3K | 11.1K |

### Summary (Geometric Mean)

| Comparison | Factor | Benchmarks |
|---|---|---|
| Rust / TypeScript | 2.8x | 21 |
| .NET / TypeScript | 2.5x | 21 |
| Java / TypeScript | 2.0x | 21 |
| Rust / .NET | 1.1x | 21 |

### Fixture Sizes

| Fixture | Lines | Size | Description |
|---|---|---|---|
| small | 29 | 518 B | ~20 fields, simple document |
| medium | 164 | 7 KB | All ODIN types and edge cases |
| large | 2,081 | 54 KB | ~3,000 fields, generated stress test |

## Running

Prerequisites: Node 20+, Rust, .NET 8, Java 21, Python 3.12, Ruby 3.3

```bash
cd tools/bench
./runner.sh
```

The runner builds all SDKs, runs benchmarks for each language, and outputs a comparison table. Results are saved to `results/` (gitignored).

## Structure

```
bench/
  runner.sh          # Orchestrates all benchmarks
  compare.ts         # Generates comparison table from results
  fixtures/          # Shared test documents (small, medium, large)
  typescript/        # TypeScript harness
  rust/              # Rust harness
  dotnet/            # .NET harness
  java/              # Java harness
  python/            # Python harness
  ruby/              # Ruby harness
```
