using System.Diagnostics;
using System.Text.Json;
using Odin.Core;
using Odin.Core.Transform;
using Odin.Core.Types;
using Odin.Core.Validation;

// ─── Benchmark definitions ───────────────────────────────────────────────────

var benchDefs = new (string Id, string Category, string Name, int Iterations)[]
{
    ("parse-small",        "core",       "Parse small doc (~20 fields)",     50_000),
    ("parse-medium",       "core",       "Parse medium doc (167 lines)",     20_000),
    ("parse-large",        "core",       "Parse large doc (3000+ lines)",     2_000),
    ("stringify-small",    "core",       "Stringify small doc",              50_000),
    ("stringify-medium",   "core",       "Stringify medium doc",             20_000),
    ("stringify-large",    "core",       "Stringify large doc",               2_000),
    ("canonicalize-medium","core",       "Canonicalize medium doc",          20_000),
    ("diff-medium",        "core",       "Diff two medium docs",             10_000),
    ("parse-transform",    "transform",  "Parse transform definition",       10_000),
    ("exec-json-json",     "transform",  "Execute json->json transform",      5_000),
    ("exec-json-odin",     "transform",  "Execute json->odin transform",      5_000),
    ("tx-string",          "transform-verbs", "String verbs (16 mappings)",       5_000),
    ("tx-numeric",         "transform-verbs", "Numeric + aggregation verbs (16 mappings)", 5_000),
    ("tx-datetime",        "transform-verbs", "Date/time verbs (12 mappings)",    5_000),
    ("tx-financial",       "transform-verbs", "Financial verbs (8 mappings)",     5_000),
    ("tx-collection",      "transform-verbs", "Collection verbs (12 mappings)",   5_000),
    ("tx-logic",           "transform-verbs", "Logic + lookup verbs (11 mappings)", 5_000),
    ("validate-schema",    "validation", "Validate doc against schema",      10_000),
    ("export-json",        "export",     "toJSON on medium doc",             10_000),
    ("export-xml",         "export",     "toXML on medium doc",              10_000),
    ("export-csv",         "export",     "toCSV on tabular doc",             10_000),
};

// ─── CLI ─────────────────────────────────────────────────────────────────────

string fixturesDir = Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "fixtures");
string? filter = null;

for (int i = 0; i < args.Length; i++)
{
    if (args[i] == "--fixtures-dir" && i + 1 < args.Length)
        fixturesDir = args[++i];
    else if (args[i] == "--filter" && i + 1 < args.Length)
        filter = args[++i];
    else
    {
        Console.Error.WriteLine($"Unknown argument: {args[i]}");
        return 1;
    }
}

fixturesDir = Path.GetFullPath(fixturesDir);
string ReadFixture(string name) => File.ReadAllText(Path.Combine(fixturesDir, name));

Console.Error.WriteLine("ODIN .NET Benchmark Suite");
Console.Error.WriteLine("================================");
Console.Error.WriteLine($"Fixtures: {fixturesDir}");
Console.Error.WriteLine();

// ─── Load fixtures ───────────────────────────────────────────────────────────

var smallOdin = ReadFixture("small.odin");
var mediumOdin = ReadFixture("medium.odin");
var largeOdin = ReadFixture("large.odin");
var diffBOdin = ReadFixture("diff-doc-b.odin");
var smallTransformOdin = ReadFixture("small-transform.odin");
var smallSourceJson = ReadFixture("small-source.json");
var mediumTransformOdin = ReadFixture("medium-transform.odin");
var mediumSourceJson = ReadFixture("medium-source.json");
var tx_string_odin = ReadFixture("tx-string.odin");
var tx_string_json = ReadFixture("tx-string.json");
var tx_numeric_odin = ReadFixture("tx-numeric.odin");
var tx_numeric_json = ReadFixture("tx-numeric.json");
var tx_datetime_odin = ReadFixture("tx-datetime.odin");
var tx_datetime_json = ReadFixture("tx-datetime.json");
var tx_financial_odin = ReadFixture("tx-financial.odin");
var tx_financial_json = ReadFixture("tx-financial.json");
var tx_collection_odin = ReadFixture("tx-collection.odin");
var tx_collection_json = ReadFixture("tx-collection.json");
var tx_logic_odin = ReadFixture("tx-logic.odin");
var tx_logic_json = ReadFixture("tx-logic.json");
var schemaOdin = ReadFixture("schema-simple.odin");
var schemaDocOdin = ReadFixture("schema-doc.odin");
var exportOdin = ReadFixture("export-doc.odin");

// ─── Pre-parse ───────────────────────────────────────────────────────────────

var smallDoc = Odin.Core.Odin.Parse(smallOdin);
var mediumDoc = Odin.Core.Odin.Parse(mediumOdin);
var largeDoc = Odin.Core.Odin.Parse(largeOdin);
var diffBDoc = Odin.Core.Odin.Parse(diffBOdin);
var exportDoc = Odin.Core.Odin.Parse(exportOdin);
var schemaDef = Odin.Core.Odin.ParseSchema(schemaOdin);
var schemaDoc = Odin.Core.Odin.Parse(schemaDocOdin);

// Pre-parse JSON sources into DynValue
var smallSource = JsonSourceParser.Parse(smallSourceJson);
var mediumSource = JsonSourceParser.Parse(mediumSourceJson);

// Pre-parse transforms
var smallTransform = Odin.Core.Odin.ParseTransform(smallTransformOdin);
var mediumTransform = Odin.Core.Odin.ParseTransform(mediumTransformOdin);
var txStringTransform = Odin.Core.Odin.ParseTransform(tx_string_odin);
var txNumericTransform = Odin.Core.Odin.ParseTransform(tx_numeric_odin);
var txDatetimeTransform = Odin.Core.Odin.ParseTransform(tx_datetime_odin);
var txFinancialTransform = Odin.Core.Odin.ParseTransform(tx_financial_odin);
var txCollectionTransform = Odin.Core.Odin.ParseTransform(tx_collection_odin);
var txLogicTransform = Odin.Core.Odin.ParseTransform(tx_logic_odin);

// Pre-parse JSON sources for transform verb benchmarks
var txStringSource = JsonSourceParser.Parse(tx_string_json);
var txNumericSource = JsonSourceParser.Parse(tx_numeric_json);
var txDatetimeSource = JsonSourceParser.Parse(tx_datetime_json);
var txFinancialSource = JsonSourceParser.Parse(tx_financial_json);
var txCollectionSource = JsonSourceParser.Parse(tx_collection_json);
var txLogicSource = JsonSourceParser.Parse(tx_logic_json);

// ─── Run benchmarks ──────────────────────────────────────────────────────────

const int warmup = 100;
var results = new List<object>();

foreach (var def in benchDefs)
{
    if (filter != null && !def.Id.Contains(filter)) continue;

    Console.Error.Write($"  {def.Id} ... ");

    Action benchAction = def.Id switch
    {
        "parse-small"        => () => Odin.Core.Odin.Parse(smallOdin),
        "parse-medium"       => () => Odin.Core.Odin.Parse(mediumOdin),
        "parse-large"        => () => Odin.Core.Odin.Parse(largeOdin),
        "stringify-small"    => () => Odin.Core.Odin.Stringify(smallDoc),
        "stringify-medium"   => () => Odin.Core.Odin.Stringify(mediumDoc),
        "stringify-large"    => () => Odin.Core.Odin.Stringify(largeDoc),
        "canonicalize-medium"=> () => Odin.Core.Odin.Canonicalize(mediumDoc),
        "diff-medium"        => () => Odin.Core.Odin.Diff(mediumDoc, diffBDoc),
        "parse-transform"    => () => Odin.Core.Odin.ParseTransform(mediumTransformOdin),
        "exec-json-json"     => () => Odin.Core.Odin.ExecuteTransform(smallTransform, smallSource),
        "exec-json-odin"     => () => Odin.Core.Odin.ExecuteTransform(mediumTransform, mediumSource),
        "tx-string"          => () => Odin.Core.Odin.ExecuteTransform(txStringTransform, txStringSource),
        "tx-numeric"         => () => Odin.Core.Odin.ExecuteTransform(txNumericTransform, txNumericSource),
        "tx-datetime"        => () => Odin.Core.Odin.ExecuteTransform(txDatetimeTransform, txDatetimeSource),
        "tx-financial"       => () => Odin.Core.Odin.ExecuteTransform(txFinancialTransform, txFinancialSource),
        "tx-collection"      => () => Odin.Core.Odin.ExecuteTransform(txCollectionTransform, txCollectionSource),
        "tx-logic"           => () => Odin.Core.Odin.ExecuteTransform(txLogicTransform, txLogicSource),
        "validate-schema"    => () => Odin.Core.Odin.Validate(schemaDoc, schemaDef),
        "export-json"        => () => Odin.Core.Odin.ToJson(exportDoc),
        "export-xml"         => () => Odin.Core.Odin.ToXml(exportDoc),
        "export-csv"         => () => Odin.Core.Odin.ToCsv(exportDoc),
        _ => throw new InvalidOperationException($"Unknown benchmark: {def.Id}")
    };

    var (totalMs, opsPerSec, avgNs, medianNs, minNs, maxNs, p95Ns) =
        Measure(benchAction, warmup, def.Iterations);

    Console.Error.WriteLine($"{opsPerSec:F0} ops/s (avg {avgNs}ns, median {medianNs}ns)");

    results.Add(new
    {
        id = def.Id,
        category = def.Category,
        name = def.Name,
        iterations = def.Iterations,
        total_ms = totalMs,
        ops_per_sec = opsPerSec,
        avg_ns = avgNs,
        median_ns = medianNs,
        min_ns = minNs,
        max_ns = maxNs,
        p95_ns = p95Ns,
    });
}

// ─── JSON output ─────────────────────────────────────────────────────────────

var output = new
{
    sdk = "dotnet",
    timestamp = DateTime.UtcNow.ToString("o"),
    benchmarks = results.ToArray()
};

var jsonOptions = new JsonSerializerOptions { WriteIndented = true };
Console.WriteLine(JsonSerializer.Serialize(output, jsonOptions));

return 0;

// ─── Timing harness ──────────────────────────────────────────────────────────

static (double totalMs, double opsPerSec, long avgNs, long medianNs, long minNs, long maxNs, long p95Ns)
    Measure(Action fn, int warmup, int iterations)
{
    // Warmup
    for (int i = 0; i < warmup; i++) fn();

    GC.Collect();
    GC.WaitForPendingFinalizers();
    GC.Collect();

    // Collect per-iteration timings in nanoseconds
    var timings = new long[iterations];
    for (int i = 0; i < iterations; i++)
    {
        long start = Stopwatch.GetTimestamp();
        fn();
        long elapsed = Stopwatch.GetTimestamp() - start;
        timings[i] = (long)((double)elapsed / Stopwatch.Frequency * 1_000_000_000);
    }

    Array.Sort(timings);

    long totalNs = 0;
    for (int i = 0; i < timings.Length; i++) totalNs += timings[i];
    double totalMs = totalNs / 1_000_000.0;
    long avgNs = totalNs / iterations;
    long medianNs = timings[timings.Length / 2];
    long minNs = timings[0];
    long maxNs = timings[timings.Length - 1];
    int p95Idx = Math.Min((int)(timings.Length * 0.95), timings.Length - 1);
    long p95Ns = timings[p95Idx];
    double opsPerSec = totalMs > 0 ? iterations / (totalMs / 1000.0) : 0;

    return (
        Math.Round(totalMs * 100) / 100,
        Math.Round(opsPerSec * 10) / 10,
        avgNs, medianNs, minNs, maxNs, p95Ns
    );
}
