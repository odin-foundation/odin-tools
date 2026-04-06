{$}
odin = "1.0.0"
transform = "1.0.0"
direction = "json->json"
target.format = "json"

{$table.RATES[vehicleType, factor]}
"sedan", #1.0
"truck", #1.35
"suv", #1.2
"van", #1.15

{}
isEligible = %and %gt @.age ##18 %gt @.creditScore ##650
riskTier = %ifElse %gt @.creditScore ##750 "preferred" %ifElse %gt @.creditScore ##650 "standard" "substandard"
rateFactor = %lookup "RATES.factor" @.vehicleType
displayName = %coalesce @.nickname @.middleName @.state
hasMiddle = %not %ifNull @.middleName ?true
isTexas = %eq @.state "TX"
seniorDiscount = %ifElse %gt @.age ##55 ?true ?false
experienceBonus = %ifElse %gt @.yearsLicensed ##10 "experienced" "standard"
cleanRecord = %not @.hasAccidents
incomeStr = %coerceString @.income
ageNum = %coerceNumber @.age
