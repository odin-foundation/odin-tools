{$}
odin = "1.0.0"
transform = "1.0.0"
direction = "json->json"
target.format = "json"

{}
monthlyPmt = %pmt @.loanAmount @.annualRate @.termMonths
futureValue = %fv @.investmentPV @.growthRate @.years
presentValue = %pv @.monthlyPayment @.annualRate @.termMonths
compounded = %round %compound @.investmentPV @.growthRate @.years ##2
discounted = %round %discount @.investmentPV @.growthRate @.years ##2
fmtPremium = %formatCurrency @.premium
fmtPayment = %formatCurrency @.monthlyPayment
