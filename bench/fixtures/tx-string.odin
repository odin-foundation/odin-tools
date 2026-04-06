{$}
odin = "1.0.0"
transform = "1.0.0"
direction = "json->json"
target.format = "json"

{}
fullName = %concat %titleCase @.firstName " " %titleCase @.lastName
emailLower = %lower @.email
phoneFmt = %mask @.phone "(###) ###-####"
addressClean = %trim @.address
cityTitle = %titleCase @.city
stateUpper = %upper @.state
nameLen = %length @.firstName
slug = %slugify @.notes
camel = %camelCase @.city
kebab = %kebabCase @.city
padded = %padLeft @.state ##5 "0"
replaced = %replace @.notes "fox" "cat"
truncated = %truncate @.notes ##20
upper = %upper @.firstName
lower = %lower @.state
