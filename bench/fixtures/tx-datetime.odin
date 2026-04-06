{$}
odin = "1.0.0"
transform = "1.0.0"
direction = "json->json"
target.format = "json"

{}
fmtSlash = %formatDate @.effectiveDate "MM/dd/yyyy"
fmtCompact = %formatDate @.effectiveDate "yyyyMMdd"
daysBetween = %dateDiff @.effectiveDate @.expirationDate "days"
monthsBetween = %dateDiff @.effectiveDate @.expirationDate "months"
plus30 = %addDays @.effectiveDate ##30
plus6mo = %addMonths @.effectiveDate ##6
plus1yr = %addYears @.effectiveDate ##1
dayOfWeek = %dayOfWeek @.effectiveDate
fmtTimestamp = %formatTimestamp @.timestamp "yyyy-MM-dd HH:mm"
fmtDuration = %formatDuration @.durationMs
nextBiz = %nextBusinessDay @.effectiveDate
bizPlus10 = %businessDays @.effectiveDate ##10
