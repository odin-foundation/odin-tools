/**
 * Deterministic large ODIN fixture generator (~3000 lines).
 * Uses a simple seeded PRNG for reproducibility.
 */

import { writeFileSync } from "fs";

// Simple seeded PRNG (mulberry32)
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(42);

function randInt(min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}

function randFloat(min: number, max: number, decimals = 2): string {
  return (rand() * (max - min) + min).toFixed(decimals);
}

function randChoice<T>(arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

function randString(len: number): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let s = "";
  for (let i = 0; i < len; i++) s += chars[Math.floor(rand() * chars.length)];
  return s;
}

function randDate(): string {
  const y = randInt(2000, 2025);
  const m = String(randInt(1, 12)).padStart(2, "0");
  const d = String(randInt(1, 28)).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const lines: string[] = [];
const w = (s: string) => lines.push(s);

w("{$}");
w('odin = "1.0.0"');
w('description = "Generated large benchmark fixture (~3000 lines)"');
w("");

// Generate 50 sections with ~20 fields each = ~1000 field lines + section headers + comments
const types = ["string", "integer", "number", "currency", "boolean", "date", "null"] as const;
const cities = ["New York", "London", "Tokyo", "Berlin", "Sydney", "Toronto", "Paris", "Mumbai"];
const departments = ["Engineering", "Marketing", "Sales", "HR", "Finance", "Legal", "Support"];
const statuses = ["active", "inactive", "pending", "archived"];

for (let s = 0; s < 50; s++) {
  w("");
  w(`; Section ${s}`);
  w(`{section_${s}}`);

  const name = randString(randInt(5, 15));
  w(`name = "${name}"`);
  w(`id = ##${randInt(1000, 99999)}`);
  w(`score = #${randFloat(0, 100, 4)}`);
  w(`amount = #$${randFloat(0, 10000)}`);
  w(`active = ?${rand() > 0.5 ? "true" : "false"}`);
  w(`status = "${randChoice(statuses)}"`);
  w(`city = "${randChoice(cities)}"`);
  w(`department = "${randChoice(departments)}"`);
  w(`createdAt = ${randDate()}`);
  w(`description = "${randString(randInt(20, 80))}"`);
  w(`priority = ##${randInt(1, 10)}`);
  w(`ratio = #${randFloat(0, 1, 6)}`);
  w(`budget = #$${randFloat(1000, 500000)}`);
  w(`enabled = ?${rand() > 0.3 ? "true" : "false"}`);
  w(`tag = "${randString(randInt(3, 10))}"`);
  w(`revision = ##${randInt(1, 100)}`);

  // Nested sub-section
  w("");
  w(`{section_${s}.details}`);
  w(`notes = "${randString(randInt(30, 100))}"`);
  w(`category = "${randChoice(departments)}"`);
  w(`weight = #${randFloat(0.1, 50, 3)}`);
  w(`count = ##${randInt(0, 1000)}`);
  w(`verified = ?${rand() > 0.5 ? "true" : "false"}`);
}

// Generate 10 tabular arrays with ~20 rows each = ~200 data rows
for (let t = 0; t < 10; t++) {
  w("");
  w(`; Table ${t}`);
  w(`{table_${t}[] : id, name, value, score, active, date, category}`);
  const rowCount = randInt(15, 25);
  for (let r = 0; r < rowCount; r++) {
    const id = `##${t * 100 + r + 1}`;
    const nm = `"${randString(randInt(5, 20))}"`;
    const val = `#$${randFloat(1, 9999)}`;
    const sc = `#${randFloat(0, 100, 2)}`;
    const act = `?${rand() > 0.5 ? "true" : "false"}`;
    const dt = randDate();
    const cat = `"${randChoice(departments)}"`;
    w(`${id}, ${nm}, ${val}, ${sc}, ${act}, ${dt}, ${cat}`);
  }
}

// Generate array fields
for (let a = 0; a < 20; a++) {
  w("");
  w(`{list_${a}}`);
  const arrLen = randInt(10, 30);
  for (let i = 0; i < arrLen; i++) {
    const typeChoice = randChoice(types);
    let val: string;
    switch (typeChoice) {
      case "string":
        val = `"${randString(randInt(5, 30))}"`;
        break;
      case "integer":
        val = `##${randInt(-10000, 10000)}`;
        break;
      case "number":
        val = `#${randFloat(-1000, 1000, 4)}`;
        break;
      case "currency":
        val = `#$${randFloat(0, 50000)}`;
        break;
      case "boolean":
        val = `?${rand() > 0.5 ? "true" : "false"}`;
        break;
      case "date":
        val = randDate();
        break;
      case "null":
        val = "~";
        break;
    }
    w(`items[${i}] = ${val}`);
  }
}

// Deep nesting
w("");
w("; Deep nesting");
for (let d = 0; d < 30; d++) {
  const depth = randInt(2, 5);
  const parts = Array.from({ length: depth }, (_, i) => `level${i}_${d}`);
  w(`{deep.${parts.join(".")}}`);
  w(`value = "${randString(20)}"`);
  w(`count = ##${randInt(0, 999)}`);
  w(`rate = #${randFloat(0, 1, 8)}`);
}

const content = lines.join("\n") + "\n";

// Write to stdout or file
const outputPath = process.argv[2] || "-";
if (outputPath === "-") {
  process.stdout.write(content);
} else {
  writeFileSync(outputPath, content);
  console.error(`Generated ${lines.length} lines to ${outputPath}`);
}
