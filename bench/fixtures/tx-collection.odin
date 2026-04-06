{$}
odin = "1.0.0"
transform = "1.0.0"
direction = "json->json"
target.format = "json"

{}
activeCov = %filter @.coverages "status" "=" "active"
sorted = %sort @.names
uniqueTags = %distinct @.tags
flattened = %flatten @.matrix
reversed = %reverse @.tags
firstName = %first @.names
lastName = %last @.names
scoreCount = %count @.scores
totalScore = %sum @.scores
avgScore = %round %avg @.scores ##1
topScore = %max @.scores
lowScore = %min @.scores
