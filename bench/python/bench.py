#!/usr/bin/env python3
"""ODIN Python Benchmark Suite.

Matches the standard benchmark interface used by all SDK benchmarks.
Outputs JSON results to stdout, progress to stderr.
"""

import argparse
import gc
import json
import math
import os
import sys
import time

# ─── Benchmark definitions ───────────────────────────────────────────────────

BENCH_DEFS = [
    {"id": "parse-small", "category": "core", "name": "Parse small doc (~20 fields)", "iterations": 50_000},
    {"id": "parse-medium", "category": "core", "name": "Parse medium doc (167 lines)", "iterations": 20_000},
    {"id": "parse-large", "category": "core", "name": "Parse large doc (3000+ lines)", "iterations": 2_000},
    {"id": "stringify-small", "category": "core", "name": "Stringify small doc", "iterations": 50_000},
    {"id": "stringify-medium", "category": "core", "name": "Stringify medium doc", "iterations": 20_000},
    {"id": "stringify-large", "category": "core", "name": "Stringify large doc", "iterations": 2_000},
    {"id": "canonicalize-medium", "category": "core", "name": "Canonicalize medium doc", "iterations": 20_000},
    {"id": "diff-medium", "category": "core", "name": "Diff two medium docs", "iterations": 10_000},
    {"id": "parse-transform", "category": "transform", "name": "Parse transform definition", "iterations": 10_000},
    {"id": "exec-json-json", "category": "transform", "name": "Execute json->json transform", "iterations": 5_000},
    {"id": "exec-json-odin", "category": "transform", "name": "Execute json->odin transform", "iterations": 5_000},
    {"id": "tx-string", "category": "transform-verbs", "name": "String verbs (16 mappings)", "iterations": 5_000},
    {"id": "tx-numeric", "category": "transform-verbs", "name": "Numeric verbs (16 mappings)", "iterations": 5_000},
    {"id": "tx-datetime", "category": "transform-verbs", "name": "Datetime verbs (16 mappings)", "iterations": 5_000},
    {"id": "tx-financial", "category": "transform-verbs", "name": "Financial verbs (16 mappings)", "iterations": 5_000},
    {"id": "tx-collection", "category": "transform-verbs", "name": "Collection verbs (16 mappings)", "iterations": 5_000},
    {"id": "tx-logic", "category": "transform-verbs", "name": "Logic verbs (16 mappings)", "iterations": 5_000},
    {"id": "validate-schema", "category": "validation", "name": "Validate doc against schema", "iterations": 10_000},
    {"id": "export-json", "category": "export", "name": "toJSON on medium doc", "iterations": 10_000},
    {"id": "export-xml", "category": "export", "name": "toXML on medium doc", "iterations": 10_000},
    {"id": "export-csv", "category": "export", "name": "toCSV on tabular doc", "iterations": 10_000},
]

# ─── Timing harness ──────────────────────────────────────────────────────────


def measure(fn, warmup, iterations):
    """Run fn for warmup+iterations, collecting per-iteration ns timings."""
    # Warmup
    for _ in range(warmup):
        fn()

    # GC before measured phase
    gc.collect()
    gc.disable()

    # Collect per-iteration timings in nanoseconds
    timings = [0] * iterations
    for i in range(iterations):
        start = time.perf_counter_ns()
        fn()
        timings[i] = time.perf_counter_ns() - start

    gc.enable()

    timings.sort()

    total_ns = sum(timings)
    total_ms = total_ns / 1e6
    avg_ns = round(total_ns / iterations)
    median_ns = timings[len(timings) // 2]
    min_ns = timings[0]
    max_ns = timings[-1]
    p95_idx = min(math.floor(len(timings) * 0.95), len(timings) - 1)
    p95_ns = timings[p95_idx]
    ops_per_sec = iterations / (total_ms / 1000) if total_ms > 0 else 0

    return {
        "iterations": iterations,
        "total_ms": round(total_ms * 100) / 100,
        "ops_per_sec": round(ops_per_sec * 10) / 10,
        "avg_ns": avg_ns,
        "median_ns": median_ns,
        "min_ns": min_ns,
        "max_ns": max_ns,
        "p95_ns": p95_ns,
    }


# ─── Main ────────────────────────────────────────────────────────────────────


def main():
    parser = argparse.ArgumentParser(description="ODIN Python Benchmark Suite")
    parser.add_argument("--fixtures-dir", default=os.path.join(os.path.dirname(__file__), "..", "fixtures"))
    parser.add_argument("--filter", default=None, help="Filter benchmarks by ID substring")
    args = parser.parse_args()

    fixtures_dir = args.fixtures_dir
    bench_filter = args.filter

    def read_fixture(name):
        with open(os.path.join(fixtures_dir, name), "r", encoding="utf-8") as f:
            return f.read()

    print("ODIN Python Benchmark Suite", file=sys.stderr)
    print("================================", file=sys.stderr)
    print(f"Fixtures: {fixtures_dir}", file=sys.stderr)
    print(file=sys.stderr)

    # Add SDK to path
    sdk_dir = os.path.join(os.path.dirname(__file__), "..", "..", "python")
    sys.path.insert(0, sdk_dir)

    import odin
    from odin.validation.schema_parser import parse_schema

    # Load fixtures
    small_odin = read_fixture("small.odin")
    medium_odin = read_fixture("medium.odin")
    large_odin = read_fixture("large.odin")
    diff_b_odin = read_fixture("diff-doc-b.odin")
    small_transform_odin = read_fixture("small-transform.odin")
    small_source_json = read_fixture("small-source.json")
    medium_transform_odin = read_fixture("medium-transform.odin")
    medium_source_json = read_fixture("medium-source.json")
    tx_string_odin = read_fixture("tx-string.odin")
    tx_string_json = read_fixture("tx-string.json")
    tx_numeric_odin = read_fixture("tx-numeric.odin")
    tx_numeric_json = read_fixture("tx-numeric.json")
    tx_datetime_odin = read_fixture("tx-datetime.odin")
    tx_datetime_json = read_fixture("tx-datetime.json")
    tx_financial_odin = read_fixture("tx-financial.odin")
    tx_financial_json = read_fixture("tx-financial.json")
    tx_collection_odin = read_fixture("tx-collection.odin")
    tx_collection_json = read_fixture("tx-collection.json")
    tx_logic_odin = read_fixture("tx-logic.odin")
    tx_logic_json = read_fixture("tx-logic.json")
    schema_odin = read_fixture("schema-simple.odin")
    schema_doc_odin = read_fixture("schema-doc.odin")
    export_odin = read_fixture("export-doc.odin")

    # Pre-parse documents
    small_doc = odin.parse(small_odin)
    medium_doc = odin.parse(medium_odin)
    large_doc = odin.parse(large_odin)
    diff_b_doc = odin.parse(diff_b_odin)
    export_doc = odin.parse(export_odin)

    # Pre-parse schema
    try:
        schema_def = parse_schema(schema_odin)
        schema_doc = odin.parse(schema_doc_odin)
    except Exception:
        schema_def = None
        schema_doc = None

    # Pre-parse JSON sources
    small_source = json.loads(small_source_json)
    medium_source = json.loads(medium_source_json)

    # Pre-parse transforms
    try:
        small_transform = odin.parse_transform(small_transform_odin)
    except Exception:
        small_transform = None

    try:
        medium_transform = odin.parse_transform(medium_transform_odin)
    except Exception:
        medium_transform = None

    try:
        tx_string_transform = odin.parse_transform(tx_string_odin)
    except Exception:
        tx_string_transform = None
    tx_string_source = json.loads(tx_string_json)

    try:
        tx_numeric_transform = odin.parse_transform(tx_numeric_odin)
    except Exception:
        tx_numeric_transform = None
    tx_numeric_source = json.loads(tx_numeric_json)

    try:
        tx_datetime_transform = odin.parse_transform(tx_datetime_odin)
    except Exception:
        tx_datetime_transform = None
    tx_datetime_source = json.loads(tx_datetime_json)

    try:
        tx_financial_transform = odin.parse_transform(tx_financial_odin)
    except Exception:
        tx_financial_transform = None
    tx_financial_source = json.loads(tx_financial_json)

    try:
        tx_collection_transform = odin.parse_transform(tx_collection_odin)
    except Exception:
        tx_collection_transform = None
    tx_collection_source = json.loads(tx_collection_json)

    try:
        tx_logic_transform = odin.parse_transform(tx_logic_odin)
    except Exception:
        tx_logic_transform = None
    tx_logic_source = json.loads(tx_logic_json)

    warmup = 100
    results = []

    # Build dispatch table
    benchmarks = {
        "parse-small": lambda: odin.parse(small_odin),
        "parse-medium": lambda: odin.parse(medium_odin),
        "parse-large": lambda: odin.parse(large_odin),
        "stringify-small": lambda: odin.dumps(small_doc),
        "stringify-medium": lambda: odin.dumps(medium_doc),
        "stringify-large": lambda: odin.dumps(large_doc),
        "canonicalize-medium": lambda: odin.canonicalize(medium_doc),
        "diff-medium": lambda: odin.diff(medium_doc, diff_b_doc),
        "parse-transform": lambda: odin.parse_transform(medium_transform_odin) if medium_transform is not None else None,
        "exec-json-json": lambda: odin.execute_transform(small_transform, small_source) if small_transform else None,
        "exec-json-odin": lambda: odin.execute_transform(medium_transform, medium_source) if medium_transform else None,
        "tx-string": lambda: odin.execute_transform(tx_string_transform, tx_string_source) if tx_string_transform else None,
        "tx-numeric": lambda: odin.execute_transform(tx_numeric_transform, tx_numeric_source) if tx_numeric_transform else None,
        "tx-datetime": lambda: odin.execute_transform(tx_datetime_transform, tx_datetime_source) if tx_datetime_transform else None,
        "tx-financial": lambda: odin.execute_transform(tx_financial_transform, tx_financial_source) if tx_financial_transform else None,
        "tx-collection": lambda: odin.execute_transform(tx_collection_transform, tx_collection_source) if tx_collection_transform else None,
        "tx-logic": lambda: odin.execute_transform(tx_logic_transform, tx_logic_source) if tx_logic_transform else None,
        "validate-schema": lambda: odin.validate(schema_doc, schema_def) if schema_def else None,
        "export-json": lambda: odin.to_json(export_doc),
        "export-xml": lambda: odin.to_xml(export_doc),
        "export-csv": lambda: odin.to_csv(export_doc),
    }

    for bench_def in BENCH_DEFS:
        bench_id = bench_def["id"]
        if bench_filter and bench_filter not in bench_id:
            continue

        sys.stderr.write(f"  {bench_id} ... ")
        sys.stderr.flush()

        fn = benchmarks.get(bench_id)
        if fn is None:
            sys.stderr.write("SKIP (not implemented)\n")
            continue

        # Skip benchmarks that depend on unavailable features
        skip_reasons = {
            "validate-schema": schema_def is None and "schema parser unavailable",
            "parse-transform": medium_transform is None and "transform parser unavailable",
            "exec-json-json": small_transform is None and "transform parser unavailable",
            "exec-json-odin": medium_transform is None and "transform parser unavailable",
        }
        reason = skip_reasons.get(bench_id, False)
        if reason:
            sys.stderr.write(f"SKIP ({reason})\n")
            continue

        timing = measure(fn, warmup, bench_def["iterations"])

        sys.stderr.write(
            f"{round(timing['ops_per_sec'])} ops/s "
            f"(avg {timing['avg_ns']}ns, median {timing['median_ns']}ns)\n"
        )

        results.append({
            "id": bench_id,
            "category": bench_def["category"],
            "name": bench_def["name"],
            **timing,
        })

    output = {
        "sdk": "python",
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "benchmarks": results,
    }

    print(json.dumps(output, indent=2))


if __name__ == "__main__":
    main()
