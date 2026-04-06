#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FIXTURES_DIR="$SCRIPT_DIR/fixtures"
RESULTS_DIR="$SCRIPT_DIR/results"

mkdir -p "$RESULTS_DIR"

echo "================================"
echo "ODIN SDK Benchmark Suite"
echo "================================"
echo

# ─── Phase 1: Generate large fixture ─────────────────────────────────────────

if [ ! -f "$FIXTURES_DIR/large.odin" ]; then
  echo "[1/10] Generating large fixture..."
  npx tsx "$FIXTURES_DIR/generate-large.ts" "$FIXTURES_DIR/large.odin"
else
  echo "[1/10] Large fixture exists, skipping generation"
fi

echo

# ─── Phase 2: Build TypeScript SDK ───────────────────────────────────────────

echo "[2/10] Building TypeScript SDK..."
(cd "$SCRIPT_DIR/../../sdk/typescript" && npm run build 2>&1 | tail -1)

echo "[2/10] Installing TypeScript bench dependencies..."
(cd "$SCRIPT_DIR/typescript" && npm install --silent 2>&1 | tail -1)

echo

# ─── Phase 3: Build Rust benchmark binary ────────────────────────────────────

echo "[3/10] Building Rust benchmark binary (release)..."
(cd "$SCRIPT_DIR/rust" && cargo build --release 2>&1 | tail -3)

echo

# ─── Phase 4: Build .NET benchmark binary ────────────────────────────────────

echo "[4/10] Building .NET benchmark binary (release)..."
(cd "$SCRIPT_DIR/dotnet" && dotnet build -c Release 2>&1 | tail -3)

echo

# ─── Phase 5: Build Java SDK + benchmark ─────────────────────────────────────

echo "[5/10] Building Java SDK + benchmark..."
(cd "$SCRIPT_DIR/../../sdk/java" && mvn clean install -q -DskipTests 2>&1 | tail -3)
(cd "$SCRIPT_DIR/java" && mvn clean package -q 2>&1 | tail -3)

echo

# ─── Phase 5b: Install Python SDK ────────────────────────────────────────────

echo "[5/10] Installing Python SDK..."
(cd "$SCRIPT_DIR/../../sdk/python" && pip install -e . --quiet 2>&1 | tail -1)

echo

# ─── Phase 6: Run benchmarks ─────────────────────────────────────────────────

echo "[6/10] Running Rust benchmarks..."
"$SCRIPT_DIR/rust/target/release/odin-bench" \
  --fixtures-dir "$FIXTURES_DIR" \
  > "$RESULTS_DIR/rust-results.json"
echo "  -> $RESULTS_DIR/rust-results.json"

echo

echo "[6/10] Running TypeScript benchmarks..."
npx --prefix "$SCRIPT_DIR/typescript" tsx "$SCRIPT_DIR/typescript/bench.ts" \
  --fixtures-dir "$FIXTURES_DIR" \
  > "$RESULTS_DIR/ts-results.json"
echo "  -> $RESULTS_DIR/ts-results.json"

echo

echo "[6/10] Running .NET benchmarks..."
dotnet run -c Release --no-build --project "$SCRIPT_DIR/dotnet" -- \
  --fixtures-dir "$FIXTURES_DIR" \
  > "$RESULTS_DIR/dotnet-results.json"
echo "  -> $RESULTS_DIR/dotnet-results.json"

echo

echo "[7/10] Running Java benchmarks..."
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" || "$OSTYPE" == "win32" ]]; then
  CPSEP=";"
  JAVA_SCRIPT_DIR="$(cygpath -m "$SCRIPT_DIR")"
  JAVA_FIXTURES_DIR="$(cygpath -m "$FIXTURES_DIR")"
else
  CPSEP=":"
  JAVA_SCRIPT_DIR="$SCRIPT_DIR"
  JAVA_FIXTURES_DIR="$FIXTURES_DIR"
fi
JAVA_CP="$JAVA_SCRIPT_DIR/java/target/odin-bench-0.1.0.jar"
for jar in "$SCRIPT_DIR"/java/target/lib/*.jar; do
  JAVA_CP="$JAVA_CP${CPSEP}$(cygpath -m "$jar" 2>/dev/null || echo "$jar")"
done
java -cp "$JAVA_CP" \
  BenchmarkRunner \
  --fixtures-dir "$JAVA_FIXTURES_DIR" \
  > "$RESULTS_DIR/java-results.json"
echo "  -> $RESULTS_DIR/java-results.json"

echo

echo "[8/10] Running Python benchmarks..."
python "$SCRIPT_DIR/python/bench.py" \
  --fixtures-dir "$FIXTURES_DIR" \
  > "$RESULTS_DIR/python-results.json"
echo "  -> $RESULTS_DIR/python-results.json"

echo

# ─── Phase 9: Run Ruby benchmarks ────────────────────────────────────────

echo "[9/10] Running Ruby benchmarks..."
ruby "$SCRIPT_DIR/ruby/bench.rb" \
  --fixtures-dir "$FIXTURES_DIR" \
  > "$RESULTS_DIR/ruby-results.json"
echo "  -> $RESULTS_DIR/ruby-results.json"

echo
# ─── Phase 10: Compare ────────────────────────────────────────────────────────

echo "[10/10] Comparison:"
npx tsx "$SCRIPT_DIR/compare.ts" "$RESULTS_DIR"
