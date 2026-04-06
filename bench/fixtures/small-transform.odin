{$}
odin = "1.0.0"
transform = "1.0.0"
direction = "json->json"
target.format = "json"
description = "Small benchmark transform (~10 mappings)"

{output}
appName = @.config.name
appVersion = @.config.version
isDebug = @.config.debug
retries = @.config.maxRetries
timeoutMs = @.config.timeout
dbHost = @.config.database.host
dbPort = @.config.database.port
dbName = @.config.database.name
cacheEnabled = @.config.cache.enabled
cacheTtl = @.config.cache.ttl
