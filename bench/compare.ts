import { readFileSync, existsSync } from "fs";
import { join } from "path";

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

// ─── Formatting helpers ──────────────────────────────────────────────────────

function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toFixed(1);
}

function pad(s: string, len: number, align: "left" | "right" = "left"): string {
  if (align === "right") return s.padStart(len);
  return s.padEnd(len);
}

function fmtSpeedup(a: number, b: number): string {
  const ratio = a / b;
  if (ratio >= 1) return `${ratio.toFixed(1)}x`;
  return `1/${(1 / ratio).toFixed(1)}x`;
}

function loadResults(dir: string, filename: string): BenchmarkOutput | null {
  const path = join(dir, filename);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    console.error(`Warning: Cannot parse ${filename}`);
    return null;
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

function main() {
  const resultsDir = process.argv[2] || join(import.meta.dirname ?? ".", "results");

  const rustData = loadResults(resultsDir, "rust-results.json");
  const tsData = loadResults(resultsDir, "ts-results.json");
  const dotnetData = loadResults(resultsDir, "dotnet-results.json");
  const javaData = loadResults(resultsDir, "java-results.json");

  if (!rustData && !tsData && !dotnetData && !javaData) {
    console.error("Error: No result files found in", resultsDir);
    process.exit(1);
  }

  const allData = [rustData, tsData, dotnetData, javaData].filter(Boolean) as BenchmarkOutput[];
  const hasDotnet = dotnetData != null;
  const hasRust = rustData != null;
  const hasTs = tsData != null;
  const hasJava = javaData != null;

  const rustMap = rustData ? new Map(rustData.benchmarks.map((b) => [b.id, b])) : new Map();
  const tsMap = tsData ? new Map(tsData.benchmarks.map((b) => [b.id, b])) : new Map();
  const dotnetMap = dotnetData ? new Map(dotnetData.benchmarks.map((b) => [b.id, b])) : new Map();
  const javaMap = javaData ? new Map(javaData.benchmarks.map((b) => [b.id, b])) : new Map();

  // Collect all benchmark IDs by category (from first available dataset)
  const categories = new Map<string, string[]>();
  for (const data of allData) {
    for (const b of data.benchmarks) {
      if (!categories.has(b.category)) categories.set(b.category, []);
      const ids = categories.get(b.category)!;
      if (!ids.includes(b.id)) ids.push(b.id);
    }
  }

  // Column widths
  const COL_NAME = 22;
  const COL_OPS = 16;
  const COL_SPEED = 12;

  // Build dynamic column list
  const sdkCols: { label: string; map: Map<string, BenchmarkResult> }[] = [];
  if (hasRust) sdkCols.push({ label: "Rust (ops/s)", map: rustMap });
  if (hasJava) sdkCols.push({ label: "Java (ops/s)", map: javaMap });
  if (hasDotnet) sdkCols.push({ label: ".NET (ops/s)", map: dotnetMap });
  if (hasTs) sdkCols.push({ label: "TS (ops/s)", map: tsMap });

  // Build speedup column pairs
  const speedupCols: { label: string; aMap: Map<string, BenchmarkResult>; bMap: Map<string, BenchmarkResult> }[] = [];
  if (hasRust && hasTs) speedupCols.push({ label: "Rust/TS", aMap: rustMap, bMap: tsMap });
  if (hasRust && hasDotnet) speedupCols.push({ label: "Rust/.NET", aMap: rustMap, bMap: dotnetMap });
  if (hasJava && hasTs) speedupCols.push({ label: "Java/TS", aMap: javaMap, bMap: tsMap });
  if (hasJava && hasDotnet) speedupCols.push({ label: "Java/.NET", aMap: javaMap, bMap: dotnetMap });
  if (hasDotnet && hasTs) speedupCols.push({ label: ".NET/TS", aMap: dotnetMap, bMap: tsMap });

  const totalWidth = COL_NAME + 2 + sdkCols.length * (COL_OPS + 3) + speedupCols.length * (COL_SPEED + 3);

  console.log();
  console.log("ODIN SDK Benchmark Comparison");
  console.log("=".repeat(totalWidth));

  const timestamps: string[] = [];
  if (rustData) timestamps.push(`Rust: ${rustData.timestamp}`);
  if (javaData) timestamps.push(`Java: ${javaData.timestamp}`);
  if (dotnetData) timestamps.push(`.NET: ${dotnetData.timestamp}`);
  if (tsData) timestamps.push(`TS: ${tsData.timestamp}`);
  console.log(timestamps.join("   "));
  console.log();

  // Track speedups for geometric means
  const speedupSets = speedupCols.map(() => [] as number[]);

  for (const [category, ids] of categories) {
    console.log(`Category: ${category.charAt(0).toUpperCase() + category.slice(1)}`);

    // Header row
    let hdr = `| ${pad("Benchmark", COL_NAME)} `;
    let sep = `|${"-".repeat(COL_NAME + 2)}`;
    for (const col of sdkCols) {
      hdr += `| ${pad(col.label, COL_OPS, "right")} `;
      sep += `|${"-".repeat(COL_OPS + 2)}`;
    }
    for (const col of speedupCols) {
      hdr += `| ${pad(col.label, COL_SPEED, "right")} `;
      sep += `|${"-".repeat(COL_SPEED + 2)}`;
    }
    hdr += "|";
    sep += "|";

    console.log(sep);
    console.log(hdr);
    console.log(sep);

    for (const id of ids) {
      let row = `| ${pad(id, COL_NAME)} `;

      for (const col of sdkCols) {
        const b = col.map.get(id);
        row += `| ${pad(b ? fmtNum(b.ops_per_sec) : "N/A", COL_OPS, "right")} `;
      }

      for (let si = 0; si < speedupCols.length; si++) {
        const sc = speedupCols[si];
        const a = sc.aMap.get(id);
        const b = sc.bMap.get(id);
        if (a && b) {
          const speedup = a.ops_per_sec / b.ops_per_sec;
          speedupSets[si].push(speedup);
          row += `| ${pad(fmtSpeedup(a.ops_per_sec, b.ops_per_sec), COL_SPEED, "right")} `;
        } else {
          row += `| ${pad("N/A", COL_SPEED, "right")} `;
        }
      }

      row += "|";
      console.log(row);
    }

    console.log(sep);
    console.log();
  }

  // Geometric means
  console.log("Summary:");
  for (let si = 0; si < speedupCols.length; si++) {
    const speeds = speedupSets[si];
    if (speeds.length === 0) continue;
    const logSum = speeds.reduce((s, x) => s + Math.log(x), 0);
    const geoMean = Math.exp(logSum / speeds.length);
    console.log(
      `  ${speedupCols[si].label}: Geometric mean ${geoMean.toFixed(1)}x (${speeds.length} benchmarks, range ${Math.min(...speeds).toFixed(1)}x - ${Math.max(...speeds).toFixed(1)}x)`
    );
  }

  console.log();
}

main();
