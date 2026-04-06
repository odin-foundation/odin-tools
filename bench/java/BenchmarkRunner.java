import foundation.odin.Odin;
import foundation.odin.diff.Differ;
import foundation.odin.export.*;
import foundation.odin.serialization.Canonicalize;
import foundation.odin.transform.JsonSourceParser;
import foundation.odin.transform.TransformEngine;
import foundation.odin.transform.TransformParser;
import foundation.odin.types.*;
import foundation.odin.types.OdinTransformTypes.OdinTransform;
import foundation.odin.validation.SchemaParser;
import foundation.odin.validation.ValidationEngine;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.time.Instant;
import java.util.*;

public class BenchmarkRunner {

    record BenchResult(String id, String category, String name,
                       int iterations, double totalMs, double opsPerSec,
                       long avgNs, long medianNs, long minNs, long maxNs, long p95Ns) {}

    private static String fixturesDir;
    private static final List<BenchResult> results = new ArrayList<>();

    public static void main(String[] args) throws Exception {
        fixturesDir = "../fixtures";
        for (int i = 0; i < args.length; i++) {
            if ("--fixtures-dir".equals(args[i]) && i + 1 < args.length) {
                fixturesDir = args[i + 1];
            }
        }

        System.err.println("ODIN Java Benchmark Suite");
        System.err.println("================================");
        System.err.println("Fixtures: " + fixturesDir);
        System.err.println();

        // Load fixtures
        String smallOdin = readFixture("small.odin");
        String mediumOdin = readFixture("medium.odin");
        String largeOdin = readFixture("large.odin");
        String diffBOdin = readFixture("diff-doc-b.odin");
        String smallTransformOdin = readFixture("small-transform.odin");
        String smallSourceJson = readFixture("small-source.json");
        String mediumTransformOdin = readFixture("medium-transform.odin");
        String mediumSourceJson = readFixture("medium-source.json");
        String txStringOdin = readFixture("tx-string.odin"), txStringJson = readFixture("tx-string.json");
        String txNumericOdin = readFixture("tx-numeric.odin"), txNumericJson = readFixture("tx-numeric.json");
        String txDatetimeOdin = readFixture("tx-datetime.odin"), txDatetimeJson = readFixture("tx-datetime.json");
        String txFinancialOdin = readFixture("tx-financial.odin"), txFinancialJson = readFixture("tx-financial.json");
        String txCollectionOdin = readFixture("tx-collection.odin"), txCollectionJson = readFixture("tx-collection.json");
        String txLogicOdin = readFixture("tx-logic.odin"), txLogicJson = readFixture("tx-logic.json");
        String schemaOdin = readFixture("schema-simple.odin");
        String schemaDocOdin = readFixture("schema-doc.odin");
        String exportOdin = readFixture("export-doc.odin");

        // Pre-parse documents
        OdinDocument smallDoc = Odin.parse(smallOdin);
        OdinDocument mediumDoc = Odin.parse(mediumOdin);
        OdinDocument largeDoc = Odin.parse(largeOdin);
        OdinDocument diffBDoc = Odin.parse(diffBOdin);
        OdinDocument exportDoc = Odin.parse(exportOdin);
        var schemaDef = SchemaParser.parse(schemaOdin);
        OdinDocument schemaDoc = Odin.parse(schemaDocOdin);

        // Pre-parse JSON sources
        DynValue smallSource = JsonSourceParser.parse(smallSourceJson);
        DynValue mediumSource = JsonSourceParser.parse(mediumSourceJson);

        // Pre-parse transforms
        OdinTransform smallTransform = TransformParser.parse(smallTransformOdin);
        OdinTransform mediumTransform = TransformParser.parse(mediumTransformOdin);
        OdinTransform txStringTransform = TransformParser.parse(txStringOdin);
        DynValue txStringSource = JsonSourceParser.parse(txStringJson);
        OdinTransform txNumericTransform = TransformParser.parse(txNumericOdin);
        DynValue txNumericSource = JsonSourceParser.parse(txNumericJson);
        OdinTransform txDatetimeTransform = TransformParser.parse(txDatetimeOdin);
        DynValue txDatetimeSource = JsonSourceParser.parse(txDatetimeJson);
        OdinTransform txFinancialTransform = TransformParser.parse(txFinancialOdin);
        DynValue txFinancialSource = JsonSourceParser.parse(txFinancialJson);
        OdinTransform txCollectionTransform = TransformParser.parse(txCollectionOdin);
        DynValue txCollectionSource = JsonSourceParser.parse(txCollectionJson);
        OdinTransform txLogicTransform = TransformParser.parse(txLogicOdin);
        DynValue txLogicSource = JsonSourceParser.parse(txLogicJson);

        // Warm up JIT
        for (int i = 0; i < 1000; i++) Odin.parse(smallOdin);

        // ── Core ──
        run("parse-small", "core", "Parse small doc (~20 fields)", 50_000,
                () -> Odin.parse(smallOdin));

        run("parse-medium", "core", "Parse medium doc (167 lines)", 20_000,
                () -> Odin.parse(mediumOdin));

        run("parse-large", "core", "Parse large doc (3000+ lines)", 2_000,
                () -> Odin.parse(largeOdin));

        run("stringify-small", "core", "Stringify small doc", 50_000,
                () -> Odin.serialize(smallDoc));

        run("stringify-medium", "core", "Stringify medium doc", 20_000,
                () -> Odin.serialize(mediumDoc));

        run("stringify-large", "core", "Stringify large doc", 2_000,
                () -> Odin.serialize(largeDoc));

        run("canonicalize-medium", "core", "Canonicalize medium doc", 20_000,
                () -> Odin.canonicalize(mediumDoc));

        run("diff-medium", "core", "Diff two medium docs", 10_000,
                () -> Odin.diff(mediumDoc, diffBDoc));

        // ── Transform ──
        run("parse-transform", "transform", "Parse transform definition", 10_000,
                () -> TransformParser.parse(mediumTransformOdin));

        run("exec-json-json", "transform", "Execute json->json transform", 5_000,
                () -> TransformEngine.execute(smallTransform, smallSource));

        run("exec-json-odin", "transform", "Execute json->odin transform", 5_000,
                () -> TransformEngine.execute(mediumTransform, mediumSource));

        run("tx-string", "transform-verbs", "String verbs (16 mappings)", 5_000,
                () -> TransformEngine.execute(txStringTransform, txStringSource));

        run("tx-numeric", "transform-verbs", "Numeric verbs (14 mappings)", 5_000,
                () -> TransformEngine.execute(txNumericTransform, txNumericSource));

        run("tx-datetime", "transform-verbs", "DateTime verbs (12 mappings)", 5_000,
                () -> TransformEngine.execute(txDatetimeTransform, txDatetimeSource));

        run("tx-financial", "transform-verbs", "Financial verbs (10 mappings)", 5_000,
                () -> TransformEngine.execute(txFinancialTransform, txFinancialSource));

        run("tx-collection", "transform-verbs", "Collection verbs (12 mappings)", 5_000,
                () -> TransformEngine.execute(txCollectionTransform, txCollectionSource));

        run("tx-logic", "transform-verbs", "Logic verbs (10 mappings)", 5_000,
                () -> TransformEngine.execute(txLogicTransform, txLogicSource));

        // ── Validation ──
        run("validate-schema", "validation", "Validate doc against schema", 10_000,
                () -> ValidationEngine.validate(schemaDoc, schemaDef, null));

        // ── Export ──
        run("export-json", "export", "toJSON on medium doc", 10_000,
                () -> Odin.toJson(exportDoc));

        run("export-xml", "export", "toXML on medium doc", 10_000,
                () -> Odin.toXml(exportDoc));

        run("export-csv", "export", "toCSV on tabular doc", 10_000,
                () -> CsvExport.toCsv(exportDoc));

        // Output
        printJsonResults();
    }

    // ─── Runner ──────────────────────────────────────────────────────────────

    @FunctionalInterface
    interface BenchOp {
        void run() throws Exception;
    }

    private static void run(String id, String category, String name, int iterations, BenchOp op) throws Exception {
        System.err.print("  " + id + " ... ");

        // Warmup
        int warmup = Math.min(iterations / 10, 1000);
        for (int i = 0; i < warmup; i++) {
            op.run();
        }
        System.gc();

        long[] timings = new long[iterations];
        for (int i = 0; i < iterations; i++) {
            long t0 = System.nanoTime();
            op.run();
            timings[i] = System.nanoTime() - t0;
        }

        Arrays.sort(timings);

        long totalNs = 0;
        for (long t : timings) totalNs += t;

        double totalMs = totalNs / 1_000_000.0;
        long avgNs = totalNs / iterations;
        long medianNs = timings[iterations / 2];
        long minNs = timings[0];
        long maxNs = timings[iterations - 1];
        long p95Ns = timings[Math.min((int) (iterations * 0.95), iterations - 1)];
        double opsPerSec = totalMs > 0 ? iterations / (totalMs / 1000.0) : 0;

        results.add(new BenchResult(id, category, name, iterations, totalMs,
                opsPerSec, avgNs, medianNs, minNs, maxNs, p95Ns));

        System.err.printf("%,.0f ops/s (avg %,dns, median %,dns)%n", opsPerSec, avgNs, medianNs);
    }

    // ─── Output ──────────────────────────────────────────────────────────────

    private static void printJsonResults() {
        var sb = new StringBuilder();
        sb.append("{\n");
        sb.append("  \"sdk\": \"java\",\n");
        sb.append("  \"timestamp\": \"").append(Instant.now()).append("\",\n");
        sb.append("  \"benchmarks\": [\n");
        for (int i = 0; i < results.size(); i++) {
            var r = results.get(i);
            sb.append("    {\n");
            sb.append("      \"id\": \"").append(r.id).append("\",\n");
            sb.append("      \"category\": \"").append(r.category).append("\",\n");
            sb.append("      \"name\": \"").append(r.name).append("\",\n");
            sb.append("      \"iterations\": ").append(r.iterations).append(",\n");
            sb.append(String.format("      \"total_ms\": %.4f,%n", r.totalMs));
            sb.append(String.format("      \"ops_per_sec\": %.4f,%n", r.opsPerSec));
            sb.append("      \"avg_ns\": ").append(r.avgNs).append(",\n");
            sb.append("      \"median_ns\": ").append(r.medianNs).append(",\n");
            sb.append("      \"min_ns\": ").append(r.minNs).append(",\n");
            sb.append("      \"max_ns\": ").append(r.maxNs).append(",\n");
            sb.append("      \"p95_ns\": ").append(r.p95Ns).append("\n");
            sb.append("    }");
            if (i < results.size() - 1) sb.append(",");
            sb.append("\n");
        }
        sb.append("  ]\n");
        sb.append("}\n");
        System.out.print(sb);
    }

    private static String readFixture(String name) throws IOException {
        return Files.readString(Path.of(fixturesDir, name), StandardCharsets.UTF_8);
    }
}
