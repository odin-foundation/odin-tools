#!/usr/bin/env ruby
# frozen_string_literal: true

# ODIN Ruby Benchmark Suite
#
# Matches the standard benchmark interface used by all SDK benchmarks.
# Outputs JSON results to stdout, progress to stderr.

require "json"
require "optparse"
require "time"

# Add the SDK to the load path
$LOAD_PATH.unshift(File.expand_path("../../ruby/lib", __dir__))
require "odin"

# ─── Benchmark Definitions ────────────────────────────────────────────────────

BENCH_DEFS = [
  { id: "parse-small",         category: "core",       name: "Parse small doc (~20 fields)",   iterations: 50_000 },
  { id: "parse-medium",        category: "core",       name: "Parse medium doc (167 lines)",   iterations: 20_000 },
  { id: "parse-large",         category: "core",       name: "Parse large doc (3000+ lines)",  iterations: 2_000 },
  { id: "stringify-small",     category: "core",       name: "Stringify small doc",            iterations: 50_000 },
  { id: "stringify-medium",    category: "core",       name: "Stringify medium doc",           iterations: 20_000 },
  { id: "stringify-large",     category: "core",       name: "Stringify large doc",            iterations: 2_000 },
  { id: "canonicalize-medium", category: "core",       name: "Canonicalize medium doc",        iterations: 20_000 },
  { id: "diff-medium",         category: "core",       name: "Diff two medium docs",           iterations: 10_000 },
  { id: "parse-transform",     category: "transform",  name: "Parse transform definition",     iterations: 10_000 },
  { id: "exec-json-json",      category: "transform",  name: "Execute json->json transform",   iterations: 5_000 },
  { id: "exec-json-odin",      category: "transform",  name: "Execute json->odin transform",   iterations: 5_000 },
  { id: "tx-string",           category: "transform-verbs", name: "String verbs (16 mappings)",     iterations: 5_000 },
  { id: "tx-numeric",          category: "transform-verbs", name: "Numeric verbs (16 mappings)",    iterations: 5_000 },
  { id: "tx-datetime",         category: "transform-verbs", name: "DateTime verbs (16 mappings)",   iterations: 5_000 },
  { id: "tx-financial",        category: "transform-verbs", name: "Financial verbs (16 mappings)",  iterations: 5_000 },
  { id: "tx-collection",       category: "transform-verbs", name: "Collection verbs (16 mappings)", iterations: 5_000 },
  { id: "tx-logic",            category: "transform-verbs", name: "Logic verbs (16 mappings)",      iterations: 5_000 },
  { id: "validate-schema",     category: "validation", name: "Validate doc against schema",    iterations: 10_000 },
  { id: "export-json",         category: "export",     name: "toJSON on medium doc",           iterations: 10_000 },
  { id: "export-xml",          category: "export",     name: "toXML on medium doc",            iterations: 10_000 },
  { id: "export-csv",          category: "export",     name: "toCSV on tabular doc",           iterations: 10_000 },
].freeze

WARMUP_ITERATIONS = 100

# ─── Timing Harness ───────────────────────────────────────────────────────────

def measure(fn, warmup, iterations)
  # Warmup
  warmup.times { fn.call }

  # GC before measured phase
  GC.start
  GC.disable

  # Collect per-iteration timings in nanoseconds
  timings = Array.new(iterations)
  iterations.times do |i|
    start = Process.clock_gettime(Process::CLOCK_MONOTONIC, :nanosecond)
    fn.call
    timings[i] = Process.clock_gettime(Process::CLOCK_MONOTONIC, :nanosecond) - start
  end

  GC.enable

  timings.sort!

  total_ns = timings.sum
  total_ms = total_ns / 1_000_000.0
  avg_ns = (total_ns.to_f / iterations).round
  median_ns = timings[timings.length / 2]
  min_ns = timings[0]
  max_ns = timings[-1]
  p95_idx = [(timings.length * 0.95).floor, timings.length - 1].min
  p95_ns = timings[p95_idx]
  ops_per_sec = total_ms > 0 ? (iterations / (total_ms / 1000.0) * 10).round / 10.0 : 0.0

  {
    iterations: iterations,
    total_ms: (total_ms * 100).round / 100.0,
    ops_per_sec: ops_per_sec,
    avg_ns: avg_ns,
    median_ns: median_ns,
    min_ns: min_ns,
    max_ns: max_ns,
    p95_ns: p95_ns,
  }
end

# ─── Fixture Loading ──────────────────────────────────────────────────────────

def read_fixture(fixtures_dir, name)
  File.read(File.join(fixtures_dir, name), encoding: "utf-8")
end

# ─── Main ─────────────────────────────────────────────────────────────────────

options = { fixtures_dir: nil, filter: nil }
OptionParser.new do |opts|
  opts.banner = "Usage: bench.rb [options]"
  opts.on("--fixtures-dir DIR", "Path to fixtures directory") { |v| options[:fixtures_dir] = v }
  opts.on("--filter PATTERN", "Filter benchmarks by pattern") { |v| options[:filter] = v }
end.parse!

fixtures_dir = options[:fixtures_dir] || File.expand_path("../fixtures", __dir__)

$stderr.puts "ODIN Ruby Benchmark Suite"
$stderr.puts "================================"
$stderr.puts "Fixtures: #{fixtures_dir}"
$stderr.puts

# Load fixtures
small_odin = read_fixture(fixtures_dir, "small.odin")
medium_odin = read_fixture(fixtures_dir, "medium.odin")
large_odin = read_fixture(fixtures_dir, "large.odin")
diff_b_odin = read_fixture(fixtures_dir, "diff-doc-b.odin")
small_transform_odin = read_fixture(fixtures_dir, "small-transform.odin")
small_source_json = read_fixture(fixtures_dir, "small-source.json")
medium_transform_odin = read_fixture(fixtures_dir, "medium-transform.odin")
medium_source_json = read_fixture(fixtures_dir, "medium-source.json")
tx_string_odin = read_fixture(fixtures_dir, "tx-string.odin")
tx_string_json = read_fixture(fixtures_dir, "tx-string.json")
tx_numeric_odin = read_fixture(fixtures_dir, "tx-numeric.odin")
tx_numeric_json = read_fixture(fixtures_dir, "tx-numeric.json")
tx_datetime_odin = read_fixture(fixtures_dir, "tx-datetime.odin")
tx_datetime_json = read_fixture(fixtures_dir, "tx-datetime.json")
tx_financial_odin = read_fixture(fixtures_dir, "tx-financial.odin")
tx_financial_json = read_fixture(fixtures_dir, "tx-financial.json")
tx_collection_odin = read_fixture(fixtures_dir, "tx-collection.odin")
tx_collection_json = read_fixture(fixtures_dir, "tx-collection.json")
tx_logic_odin = read_fixture(fixtures_dir, "tx-logic.odin")
tx_logic_json = read_fixture(fixtures_dir, "tx-logic.json")
schema_odin = read_fixture(fixtures_dir, "schema-simple.odin")
schema_doc_odin = read_fixture(fixtures_dir, "schema-doc.odin")
export_odin = read_fixture(fixtures_dir, "export-doc.odin")

# Pre-parse documents
small_doc = Odin.parse(small_odin)
medium_doc = Odin.parse(medium_odin)
large_doc = Odin.parse(large_odin)
diff_b_doc = Odin.parse(diff_b_odin)
export_doc = Odin.parse(export_odin)

# Pre-parse schema
schema_def = begin
  Odin.parse_schema(schema_odin)
rescue StandardError
  nil
end
schema_doc = begin
  Odin.parse(schema_doc_odin)
rescue StandardError
  nil
end

# Pre-parse JSON sources
small_source = JSON.parse(small_source_json)
medium_source = JSON.parse(medium_source_json)

# Pre-parse transforms
small_transform = begin
  Odin.parse_transform(small_transform_odin)
rescue StandardError
  nil
end

medium_transform = begin
  Odin.parse_transform(medium_transform_odin)
rescue StandardError
  nil
end

tx_string_transform = begin
  Odin.parse_transform(tx_string_odin)
rescue StandardError
  nil
end
tx_string_source = JSON.parse(tx_string_json)

tx_numeric_transform = begin
  Odin.parse_transform(tx_numeric_odin)
rescue StandardError
  nil
end
tx_numeric_source = JSON.parse(tx_numeric_json)

tx_datetime_transform = begin
  Odin.parse_transform(tx_datetime_odin)
rescue StandardError
  nil
end
tx_datetime_source = JSON.parse(tx_datetime_json)

tx_financial_transform = begin
  Odin.parse_transform(tx_financial_odin)
rescue StandardError
  nil
end
tx_financial_source = JSON.parse(tx_financial_json)

tx_collection_transform = begin
  Odin.parse_transform(tx_collection_odin)
rescue StandardError
  nil
end
tx_collection_source = JSON.parse(tx_collection_json)

tx_logic_transform = begin
  Odin.parse_transform(tx_logic_odin)
rescue StandardError
  nil
end
tx_logic_source = JSON.parse(tx_logic_json)

# Build dispatch table
bench_fns = {
  "parse-small"         => -> { Odin.parse(small_odin) },
  "parse-medium"        => -> { Odin.parse(medium_odin) },
  "parse-large"         => -> { Odin.parse(large_odin) },
  "stringify-small"     => -> { Odin.stringify(small_doc) },
  "stringify-medium"    => -> { Odin.stringify(medium_doc) },
  "stringify-large"     => -> { Odin.stringify(large_doc) },
  "canonicalize-medium" => -> { Odin.canonicalize(medium_doc) },
  "diff-medium"         => -> { Odin.diff(medium_doc, diff_b_doc) },
  "parse-transform"     => medium_transform ? -> { Odin.parse_transform(medium_transform_odin) } : nil,
  "exec-json-json"      => small_transform ? -> { Odin.execute_transform(small_transform, small_source) } : nil,
  "exec-json-odin"      => medium_transform ? -> { Odin.execute_transform(medium_transform, medium_source) } : nil,
  "tx-string"           => tx_string_transform ? -> { Odin.execute_transform(tx_string_transform, tx_string_source) } : nil,
  "tx-numeric"          => tx_numeric_transform ? -> { Odin.execute_transform(tx_numeric_transform, tx_numeric_source) } : nil,
  "tx-datetime"         => tx_datetime_transform ? -> { Odin.execute_transform(tx_datetime_transform, tx_datetime_source) } : nil,
  "tx-financial"        => tx_financial_transform ? -> { Odin.execute_transform(tx_financial_transform, tx_financial_source) } : nil,
  "tx-collection"       => tx_collection_transform ? -> { Odin.execute_transform(tx_collection_transform, tx_collection_source) } : nil,
  "tx-logic"            => tx_logic_transform ? -> { Odin.execute_transform(tx_logic_transform, tx_logic_source) } : nil,
  "validate-schema"     => schema_def && schema_doc ? -> { Odin.validate(schema_doc, schema_def) } : nil,
  "export-json"         => -> { Odin::Export.to_json(export_doc) },
  "export-xml"          => -> { Odin::Export.to_xml(export_doc) },
  "export-csv"          => -> { Odin::Export.to_csv(export_doc) },
}

# Filter benchmarks
defs_to_run = BENCH_DEFS.dup
if options[:filter]
  pattern = Regexp.new(options[:filter], Regexp::IGNORECASE)
  defs_to_run.select! { |b| b[:id] =~ pattern || b[:name] =~ pattern }
end

results = []
defs_to_run.each do |bench_def|
  bench_id = bench_def[:id]
  $stderr.write "  #{bench_id} ... "

  fn = bench_fns[bench_id]
  unless fn
    $stderr.puts "SKIP (not implemented)"
    next
  end

  timing = measure(fn, WARMUP_ITERATIONS, bench_def[:iterations])

  $stderr.puts "#{timing[:ops_per_sec].round} ops/s (avg #{timing[:avg_ns]}ns, median #{timing[:median_ns]}ns)"

  results << {
    id: bench_id,
    category: bench_def[:category],
    name: bench_def[:name],
  }.merge(timing)
end

output = {
  sdk: "ruby",
  timestamp: Time.now.utc.strftime("%Y-%m-%dT%H:%M:%SZ"),
  benchmarks: results,
}

puts JSON.pretty_generate(output)
