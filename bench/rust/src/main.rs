use odin_core::transform::source_parsers::parse_json;
use odin_core::Odin;
use serde::Serialize;
use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{Instant, SystemTime};

// ─── JSON output types ───────────────────────────────────────────────────────

#[derive(Serialize)]
struct BenchmarkResult {
    id: String,
    category: String,
    name: String,
    iterations: u64,
    total_ms: f64,
    ops_per_sec: f64,
    avg_ns: u64,
    median_ns: u64,
    min_ns: u64,
    max_ns: u64,
    p95_ns: u64,
}

#[derive(Serialize)]
struct BenchmarkOutput {
    sdk: String,
    timestamp: String,
    benchmarks: Vec<BenchmarkResult>,
}

// ─── Timing harness ──────────────────────────────────────────────────────────

fn measure<F: FnMut()>(mut f: F, warmup: u64, iterations: u64) -> BenchmarkResult {
    // Warmup
    for _ in 0..warmup {
        f();
    }

    // Collect per-iteration timings
    let mut timings_ns: Vec<u64> = Vec::with_capacity(iterations as usize);
    for _ in 0..iterations {
        let start = Instant::now();
        f();
        timings_ns.push(start.elapsed().as_nanos() as u64);
    }

    timings_ns.sort_unstable();

    let total_ns: u64 = timings_ns.iter().sum();
    let total_ms = total_ns as f64 / 1_000_000.0;
    let avg_ns = total_ns / iterations;
    let median_ns = timings_ns[timings_ns.len() / 2];
    let min_ns = timings_ns[0];
    let max_ns = *timings_ns.last().unwrap();
    let p95_idx = ((timings_ns.len() as f64) * 0.95) as usize;
    let p95_ns = timings_ns[p95_idx.min(timings_ns.len() - 1)];
    let ops_per_sec = if total_ms > 0.0 {
        (iterations as f64) / (total_ms / 1000.0)
    } else {
        0.0
    };

    BenchmarkResult {
        id: String::new(),
        category: String::new(),
        name: String::new(),
        iterations,
        total_ms,
        ops_per_sec,
        avg_ns,
        median_ns,
        min_ns,
        max_ns,
        p95_ns,
    }
}

// ─── Benchmark definitions ───────────────────────────────────────────────────

fn run_benchmarks(fixtures_dir: &Path, filter: Option<&str>) -> Vec<BenchmarkResult> {
    let read = |name: &str| -> String {
        let p = fixtures_dir.join(name);
        fs::read_to_string(&p).unwrap_or_else(|e| panic!("Failed to read {}: {}", p.display(), e))
    };

    let small_odin = read("small.odin");
    let medium_odin = read("medium.odin");
    let large_odin = read("large.odin");
    let diff_b_odin = read("diff-doc-b.odin");
    let small_transform_odin = read("small-transform.odin");
    let small_source_json = read("small-source.json");
    let medium_transform_odin = read("medium-transform.odin");
    let medium_source_json = read("medium-source.json");
    let schema_odin = read("schema-simple.odin");
    let schema_doc_odin = read("schema-doc.odin");
    let export_odin = read("export-doc.odin");
    let tx_string_odin = read("tx-string.odin");
    let tx_string_json = read("tx-string.json");
    let tx_numeric_odin = read("tx-numeric.odin");
    let tx_numeric_json = read("tx-numeric.json");
    let tx_datetime_odin = read("tx-datetime.odin");
    let tx_datetime_json = read("tx-datetime.json");
    let tx_financial_odin = read("tx-financial.odin");
    let tx_financial_json = read("tx-financial.json");
    let tx_collection_odin = read("tx-collection.odin");
    let tx_collection_json = read("tx-collection.json");
    let tx_logic_odin = read("tx-logic.odin");
    let tx_logic_json = read("tx-logic.json");

    // Pre-parse documents needed for non-parse benchmarks
    let small_doc = Odin::parse(&small_odin).expect("parse small");
    let medium_doc = Odin::parse(&medium_odin).expect("parse medium");
    let large_doc = Odin::parse(&large_odin).expect("parse large");
    let diff_b_doc = Odin::parse(&diff_b_odin).expect("parse diff-b");
    let export_doc = Odin::parse(&export_odin).expect("parse export");
    let schema_def = Odin::parse_schema(&schema_odin).expect("parse schema");
    let schema_doc = Odin::parse(&schema_doc_odin).expect("parse schema doc");

    let warmup = 100;

    struct BenchDef {
        id: &'static str,
        category: &'static str,
        name: &'static str,
        iterations: u64,
    }

    let defs = vec![
        BenchDef { id: "parse-small", category: "core", name: "Parse small doc (~20 fields)", iterations: 50_000 },
        BenchDef { id: "parse-medium", category: "core", name: "Parse medium doc (167 lines)", iterations: 20_000 },
        BenchDef { id: "parse-large", category: "core", name: "Parse large doc (3000+ lines)", iterations: 2_000 },
        BenchDef { id: "stringify-small", category: "core", name: "Stringify small doc", iterations: 50_000 },
        BenchDef { id: "stringify-medium", category: "core", name: "Stringify medium doc", iterations: 20_000 },
        BenchDef { id: "stringify-large", category: "core", name: "Stringify large doc", iterations: 2_000 },
        BenchDef { id: "canonicalize-medium", category: "core", name: "Canonicalize medium doc", iterations: 20_000 },
        BenchDef { id: "diff-medium", category: "core", name: "Diff two medium docs", iterations: 10_000 },
        BenchDef { id: "parse-transform", category: "transform", name: "Parse transform definition", iterations: 10_000 },
        BenchDef { id: "exec-json-json", category: "transform", name: "Execute json->json transform", iterations: 5_000 },
        BenchDef { id: "exec-json-odin", category: "transform", name: "Execute json->odin transform", iterations: 5_000 },
        BenchDef { id: "tx-string", category: "transform-verbs", name: "String verbs (16 mappings)", iterations: 5_000 },
        BenchDef { id: "tx-numeric", category: "transform-verbs", name: "Numeric + aggregation verbs (16 mappings)", iterations: 5_000 },
        BenchDef { id: "tx-datetime", category: "transform-verbs", name: "Date/time verbs (12 mappings)", iterations: 5_000 },
        BenchDef { id: "tx-financial", category: "transform-verbs", name: "Financial verbs (8 mappings)", iterations: 5_000 },
        BenchDef { id: "tx-collection", category: "transform-verbs", name: "Collection verbs (12 mappings)", iterations: 5_000 },
        BenchDef { id: "tx-logic", category: "transform-verbs", name: "Logic + lookup verbs (11 mappings)", iterations: 5_000 },
        BenchDef { id: "validate-schema", category: "validation", name: "Validate doc against schema", iterations: 10_000 },
        BenchDef { id: "export-json", category: "export", name: "toJSON on medium doc", iterations: 10_000 },
        BenchDef { id: "export-xml", category: "export", name: "toXML on medium doc", iterations: 10_000 },
        BenchDef { id: "export-csv", category: "export", name: "toCSV on tabular doc", iterations: 10_000 },
    ];

    let mut results = Vec::new();

    for def in &defs {
        if let Some(f) = filter {
            if !def.id.contains(f) {
                continue;
            }
        }

        eprint!("  {} ... ", def.id);

        let mut result = match def.id {
            "parse-small" => {
                let src = small_odin.clone();
                measure(|| { let _ = Odin::parse(&src); }, warmup, def.iterations)
            }
            "parse-medium" => {
                let src = medium_odin.clone();
                measure(|| { let _ = Odin::parse(&src); }, warmup, def.iterations)
            }
            "parse-large" => {
                let src = large_odin.clone();
                measure(|| { let _ = Odin::parse(&src); }, warmup, def.iterations)
            }
            "stringify-small" => {
                let doc = small_doc.clone();
                measure(|| { let _ = Odin::stringify(&doc, None); }, warmup, def.iterations)
            }
            "stringify-medium" => {
                let doc = medium_doc.clone();
                measure(|| { let _ = Odin::stringify(&doc, None); }, warmup, def.iterations)
            }
            "stringify-large" => {
                let doc = large_doc.clone();
                measure(|| { let _ = Odin::stringify(&doc, None); }, warmup, def.iterations)
            }
            "canonicalize-medium" => {
                let doc = medium_doc.clone();
                measure(|| { let _ = Odin::canonicalize(&doc); }, warmup, def.iterations)
            }
            "diff-medium" => {
                let a = medium_doc.clone();
                let b = diff_b_doc.clone();
                measure(|| { let _ = Odin::diff(&a, &b); }, warmup, def.iterations)
            }
            "parse-transform" => {
                let src = medium_transform_odin.clone();
                measure(|| { let _ = Odin::parse_transform(&src); }, warmup, def.iterations)
            }
            "exec-json-json" => {
                let transform = Odin::parse_transform(&small_transform_odin).expect("parse transform");
                let source = parse_json(&small_source_json).expect("parse json source");
                measure(|| { let _ = Odin::transform_with(&transform, &source); }, warmup, def.iterations)
            }
            "exec-json-odin" => {
                let transform = Odin::parse_transform(&medium_transform_odin).expect("parse transform");
                let source = parse_json(&medium_source_json).expect("parse json source");
                measure(|| { let _ = Odin::transform_with(&transform, &source); }, warmup, def.iterations)
            }
            "tx-string" => {
                let transform = Odin::parse_transform(&tx_string_odin).expect("parse tx-string");
                let source = parse_json(&tx_string_json).expect("parse json");
                measure(|| { let _ = Odin::transform_with(&transform, &source); }, warmup, def.iterations)
            }
            "tx-numeric" => {
                let transform = Odin::parse_transform(&tx_numeric_odin).expect("parse tx-numeric");
                let source = parse_json(&tx_numeric_json).expect("parse json");
                measure(|| { let _ = Odin::transform_with(&transform, &source); }, warmup, def.iterations)
            }
            "tx-datetime" => {
                let transform = Odin::parse_transform(&tx_datetime_odin).expect("parse tx-datetime");
                let source = parse_json(&tx_datetime_json).expect("parse json");
                measure(|| { let _ = Odin::transform_with(&transform, &source); }, warmup, def.iterations)
            }
            "tx-financial" => {
                let transform = Odin::parse_transform(&tx_financial_odin).expect("parse tx-financial");
                let source = parse_json(&tx_financial_json).expect("parse json");
                measure(|| { let _ = Odin::transform_with(&transform, &source); }, warmup, def.iterations)
            }
            "tx-collection" => {
                let transform = Odin::parse_transform(&tx_collection_odin).expect("parse tx-collection");
                let source = parse_json(&tx_collection_json).expect("parse json");
                measure(|| { let _ = Odin::transform_with(&transform, &source); }, warmup, def.iterations)
            }
            "tx-logic" => {
                let transform = Odin::parse_transform(&tx_logic_odin).expect("parse tx-logic");
                let source = parse_json(&tx_logic_json).expect("parse json");
                measure(|| { let _ = Odin::transform_with(&transform, &source); }, warmup, def.iterations)
            }
            "validate-schema" => {
                let doc = schema_doc.clone();
                let schema = schema_def.clone();
                measure(|| { let _ = Odin::validate(&doc, &schema, None); }, warmup, def.iterations)
            }
            "export-json" => {
                let doc = export_doc.clone();
                measure(|| { let _ = Odin::to_json(&doc, false, false); }, warmup, def.iterations)
            }
            "export-xml" => {
                let doc = export_doc.clone();
                measure(|| { let _ = Odin::to_xml(&doc, false, false); }, warmup, def.iterations)
            }
            "export-csv" => {
                let doc = export_doc.clone();
                measure(|| { let _ = Odin::to_csv(&doc, None); }, warmup, def.iterations)
            }
            _ => unreachable!(),
        };

        result.id = def.id.to_string();
        result.category = def.category.to_string();
        result.name = def.name.to_string();

        eprintln!(
            "{:.0} ops/s (avg {:.0}ns, median {:.0}ns)",
            result.ops_per_sec, result.avg_ns as f64, result.median_ns as f64
        );

        results.push(result);
    }

    results
}

// ─── Main ────────────────────────────────────────────────────────────────────

fn main() {
    let args: Vec<String> = env::args().collect();

    let mut fixtures_dir = PathBuf::from("../fixtures");
    let mut filter: Option<String> = None;

    let mut i = 1;
    while i < args.len() {
        match args[i].as_str() {
            "--fixtures-dir" => {
                i += 1;
                fixtures_dir = PathBuf::from(&args[i]);
            }
            "--filter" => {
                i += 1;
                filter = Some(args[i].clone());
            }
            _ => {
                eprintln!("Unknown argument: {}", args[i]);
                std::process::exit(1);
            }
        }
        i += 1;
    }

    eprintln!("ODIN Rust Benchmark Suite");
    eprintln!("=========================");
    eprintln!("Fixtures: {}", fixtures_dir.display());
    eprintln!();

    let benchmarks = run_benchmarks(&fixtures_dir, filter.as_deref());

    let timestamp = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap()
        .as_secs();

    let output = BenchmarkOutput {
        sdk: "rust".to_string(),
        timestamp: format!(
            "{}-{:02}-{:02}T{:02}:{:02}:{:02}Z",
            1970 + timestamp / 31_536_000,
            (timestamp % 31_536_000) / 2_592_000 + 1,
            (timestamp % 2_592_000) / 86_400 + 1,
            (timestamp % 86_400) / 3600,
            (timestamp % 3600) / 60,
            timestamp % 60
        ),
        benchmarks,
    };

    let json = serde_json::to_string_pretty(&output).expect("serialize results");
    println!("{json}");
}
