{$}
odin = "1.0.0"
description = "Small benchmark fixture (~20 fields)"

{config}
name = "Benchmark App"
version = "2.1.0"
debug = ?false
maxRetries = ##3
timeout = #1500.5
basePath = "/api/v2"

{config.database}
host = "db.example.com"
port = ##5432
name = "bench_db"
poolSize = ##10
ssl = ?true
connectionTimeout = #30000.0

{config.cache}
enabled = ?true
ttl = ##3600
maxSize = ##1000

{metadata}
createdAt = 2024-06-15T10:30:00Z
updatedAt = 2024-12-01T08:00:00Z
author = "bench-suite"
