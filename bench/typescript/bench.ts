import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { Odin } from "@odin-foundation/core";

// ─── Types ───────────────────────────────────────────────────────────────────

interface BenchmarkResult {
  id: string;
  category: string;
  name: string;
  iterations: number;
  total_ms: number;
  ops_per_sec: number;
  avg_ns: number;
  median_ns: number;
  min_ns: number;
  max_ns: number;
  p95_ns: number;
}

interface BenchmarkOutput {
  sdk: string;
  timestamp: string;
  benchmarks: BenchmarkResult[];
}

// ─── Timing harness ──────────────────────────────────────────────────────────

function measure(
  fn_: () => void,
  warmup: number,
  iterations: number
): Omit<BenchmarkResult, "id" | "category" | "name"> {
  // Warmup
  for (let i = 0; i < warmup; i++) fn_();

  // Try to GC before measured phase
  if (typeof globalThis.gc === "function") globalThis.gc();

  // Collect per-iteration timings (nanoseconds via performance.now * 1e6)
  const timings: number[] = new Array(iterations);
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    fn_();
    timings[i] = (performance.now() - start) * 1e6; // ms -> ns
  }

  timings.sort((a, b) => a - b);

  const total_ns = timings.reduce((s, t) => s + t, 0);
  const total_ms = total_ns / 1e6;
  const avg_ns = Math.round(total_ns / iterations);
  const median_ns = Math.round(timings[Math.floor(timings.length / 2)]);
  const min_ns = Math.round(timings[0]);
  const max_ns = Math.round(timings[timings.length - 1]);
  const p95_idx = Math.min(
    Math.floor(timings.length * 0.95),
    timings.length - 1
  );
  const p95_ns = Math.round(timings[p95_idx]);
  const ops_per_sec = total_ms > 0 ? iterations / (total_ms / 1000) : 0;

  return {
    iterations,
    total_ms: Math.round(total_ms * 100) / 100,
    ops_per_sec: Math.round(ops_per_sec * 10) / 10,
    avg_ns,
    median_ns,
    min_ns,
    max_ns,
    p95_ns,
  };
}

// ─── Benchmark definitions ───────────────────────────────────────────────────

interface BenchDef {
  id: string;
  category: string;
  name: string;
  iterations: number;
}

const BENCH_DEFS: BenchDef[] = [
  {
    id: "parse-small",
    category: "core",
    name: "Parse small doc (~20 fields)",
    iterations: 50_000,
  },
  {
    id: "parse-medium",
    category: "core",
    name: "Parse medium doc (167 lines)",
    iterations: 20_000,
  },
  {
    id: "parse-large",
    category: "core",
    name: "Parse large doc (3000+ lines)",
    iterations: 2_000,
  },
  {
    id: "stringify-small",
    category: "core",
    name: "Stringify small doc",
    iterations: 50_000,
  },
  {
    id: "stringify-medium",
    category: "core",
    name: "Stringify medium doc",
    iterations: 20_000,
  },
  {
    id: "stringify-large",
    category: "core",
    name: "Stringify large doc",
    iterations: 2_000,
  },
  {
    id: "canonicalize-medium",
    category: "core",
    name: "Canonicalize medium doc",
    iterations: 20_000,
  },
  {
    id: "diff-medium",
    category: "core",
    name: "Diff two medium docs",
    iterations: 10_000,
  },
  {
    id: "parse-transform",
    category: "transform",
    name: "Parse transform definition",
    iterations: 10_000,
  },
  {
    id: "exec-json-json",
    category: "transform",
    name: "Execute json->json transform",
    iterations: 5_000,
  },
  {
    id: "exec-json-odin",
    category: "transform",
    name: "Execute json->odin transform",
    iterations: 5_000,
  },
  {
    id: "tx-string",
    category: "transform-verbs",
    name: "String verbs (16 mappings)",
    iterations: 5_000,
  },
  {
    id: "tx-numeric",
    category: "transform-verbs",
    name: "Numeric + aggregation verbs (16 mappings)",
    iterations: 5_000,
  },
  {
    id: "tx-datetime",
    category: "transform-verbs",
    name: "Date/time verbs (12 mappings)",
    iterations: 5_000,
  },
  {
    id: "tx-financial",
    category: "transform-verbs",
    name: "Financial verbs (8 mappings)",
    iterations: 5_000,
  },
  {
    id: "tx-collection",
    category: "transform-verbs",
    name: "Collection verbs (12 mappings)",
    iterations: 5_000,
  },
  {
    id: "tx-logic",
    category: "transform-verbs",
    name: "Logic + lookup verbs (11 mappings)",
    iterations: 5_000,
  },
  {
    id: "validate-schema",
    category: "validation",
    name: "Validate doc against schema",
    iterations: 10_000,
  },
  {
    id: "export-json",
    category: "export",
    name: "toJSON on medium doc",
    iterations: 10_000,
  },
  {
    id: "export-xml",
    category: "export",
    name: "toXML on medium doc",
    iterations: 10_000,
  },
  {
    id: "export-csv",
    category: "export",
    name: "toCSV on tabular doc",
    iterations: 10_000,
  },
];

// ─── Main ────────────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  let fixturesDir = join(import.meta.dirname ?? ".", "../fixtures");
  let filter: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--fixtures-dir") fixturesDir = args[++i];
    else if (args[i] === "--filter") filter = args[++i];
    else {
      console.error(`Unknown argument: ${args[i]}`);
      process.exit(1);
    }
  }

  const read = (name: string) => readFileSync(join(fixturesDir, name), "utf-8");

  console.error("ODIN TypeScript Benchmark Suite");
  console.error("================================");
  console.error(`Fixtures: ${fixturesDir}`);
  console.error();

  // Load fixtures
  const smallOdin = read("small.odin");
  const mediumOdin = read("medium.odin");
  const largeOdin = read("large.odin");
  const diffBOdin = read("diff-doc-b.odin");
  const smallTransformOdin = read("small-transform.odin");
  const smallSourceJson = read("small-source.json");
  const mediumTransformOdin = read("medium-transform.odin");
  const mediumSourceJson = read("medium-source.json");
  const schemaOdin = read("schema-simple.odin");
  const schemaDocOdin = read("schema-doc.odin");
  const exportOdin = read("export-doc.odin");
  const txStringOdin = read("tx-string.odin");
  const txStringJson = read("tx-string.json");
  const txNumericOdin = read("tx-numeric.odin");
  const txNumericJson = read("tx-numeric.json");
  const txDatetimeOdin = read("tx-datetime.odin");
  const txDatetimeJson = read("tx-datetime.json");
  const txFinancialOdin = read("tx-financial.odin");
  const txFinancialJson = read("tx-financial.json");
  const txCollectionOdin = read("tx-collection.odin");
  const txCollectionJson = read("tx-collection.json");
  const txLogicOdin = read("tx-logic.odin");
  const txLogicJson = read("tx-logic.json");

  // Pre-parse documents
  const smallDoc = Odin.parse(smallOdin);
  const mediumDoc = Odin.parse(mediumOdin);
  const largeDoc = Odin.parse(largeOdin);
  const diffBDoc = Odin.parse(diffBOdin);
  const exportDoc = Odin.parse(exportOdin);
  const schemaDef = Odin.parseSchema(schemaOdin);
  const schemaDoc = Odin.parse(schemaDocOdin);

  // Pre-parse JSON sources
  const smallSource = JSON.parse(smallSourceJson);
  const mediumSource = JSON.parse(mediumSourceJson);

  // Pre-parse transforms
  const smallTransform = Odin.parseTransform(smallTransformOdin);
  const mediumTransform = Odin.parseTransform(mediumTransformOdin);
  const txStringTransform = Odin.parseTransform(txStringOdin);
  const txNumericTransform = Odin.parseTransform(txNumericOdin);
  const txDatetimeTransform = Odin.parseTransform(txDatetimeOdin);
  const txFinancialTransform = Odin.parseTransform(txFinancialOdin);
  const txCollectionTransform = Odin.parseTransform(txCollectionOdin);
  const txLogicTransform = Odin.parseTransform(txLogicOdin);

  // Pre-parse JSON sources for verb benchmarks
  const txStringSource = JSON.parse(txStringJson);
  const txNumericSource = JSON.parse(txNumericJson);
  const txDatetimeSource = JSON.parse(txDatetimeJson);
  const txFinancialSource = JSON.parse(txFinancialJson);
  const txCollectionSource = JSON.parse(txCollectionJson);
  const txLogicSource = JSON.parse(txLogicJson);

  const warmup = 100;
  const results: BenchmarkResult[] = [];

  for (const def of BENCH_DEFS) {
    if (filter && !def.id.includes(filter)) continue;

    process.stderr.write(`  ${def.id} ... `);

    let timing: Omit<BenchmarkResult, "id" | "category" | "name">;

    switch (def.id) {
      case "parse-small":
        timing = measure(() => Odin.parse(smallOdin), warmup, def.iterations);
        break;
      case "parse-medium":
        timing = measure(() => Odin.parse(mediumOdin), warmup, def.iterations);
        break;
      case "parse-large":
        timing = measure(() => Odin.parse(largeOdin), warmup, def.iterations);
        break;
      case "stringify-small":
        timing = measure(
          () => Odin.stringify(smallDoc),
          warmup,
          def.iterations
        );
        break;
      case "stringify-medium":
        timing = measure(
          () => Odin.stringify(mediumDoc),
          warmup,
          def.iterations
        );
        break;
      case "stringify-large":
        timing = measure(
          () => Odin.stringify(largeDoc),
          warmup,
          def.iterations
        );
        break;
      case "canonicalize-medium":
        timing = measure(
          () => Odin.canonicalize(mediumDoc),
          warmup,
          def.iterations
        );
        break;
      case "diff-medium":
        timing = measure(
          () => Odin.diff(mediumDoc, diffBDoc),
          warmup,
          def.iterations
        );
        break;
      case "parse-transform":
        timing = measure(
          () => Odin.parseTransform(mediumTransformOdin),
          warmup,
          def.iterations
        );
        break;
      case "exec-json-json":
        timing = measure(
          () => Odin.transform(smallTransform, smallSource),
          warmup,
          def.iterations
        );
        break;
      case "exec-json-odin":
        timing = measure(
          () => Odin.transform(mediumTransform, mediumSource),
          warmup,
          def.iterations
        );
        break;
      case "tx-string":
        timing = measure(
          () => Odin.transform(txStringTransform, txStringSource),
          warmup,
          def.iterations
        );
        break;
      case "tx-numeric":
        timing = measure(
          () => Odin.transform(txNumericTransform, txNumericSource),
          warmup,
          def.iterations
        );
        break;
      case "tx-datetime":
        timing = measure(
          () => Odin.transform(txDatetimeTransform, txDatetimeSource),
          warmup,
          def.iterations
        );
        break;
      case "tx-financial":
        timing = measure(
          () => Odin.transform(txFinancialTransform, txFinancialSource),
          warmup,
          def.iterations
        );
        break;
      case "tx-collection":
        timing = measure(
          () => Odin.transform(txCollectionTransform, txCollectionSource),
          warmup,
          def.iterations
        );
        break;
      case "tx-logic":
        timing = measure(
          () => Odin.transform(txLogicTransform, txLogicSource),
          warmup,
          def.iterations
        );
        break;
      case "validate-schema":
        timing = measure(
          () => Odin.validate(schemaDoc, schemaDef),
          warmup,
          def.iterations
        );
        break;
      case "export-json":
        timing = measure(
          () => Odin.toJSON(exportDoc),
          warmup,
          def.iterations
        );
        break;
      case "export-xml":
        timing = measure(
          () => Odin.toXML(exportDoc),
          warmup,
          def.iterations
        );
        break;
      case "export-csv":
        timing = measure(
          () => Odin.toCSV(exportDoc),
          warmup,
          def.iterations
        );
        break;
      default:
        throw new Error(`Unknown benchmark: ${def.id}`);
    }

    console.error(
      `${Math.round(timing.ops_per_sec)} ops/s (avg ${timing.avg_ns}ns, median ${timing.median_ns}ns)`
    );

    results.push({
      id: def.id,
      category: def.category,
      name: def.name,
      ...timing,
    });
  }

  const output: BenchmarkOutput = {
    sdk: "typescript",
    timestamp: new Date().toISOString(),
    benchmarks: results,
  };

  console.log(JSON.stringify(output, null, 2));
}

main();
