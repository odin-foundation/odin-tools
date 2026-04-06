{$}
odin = "1.0.0"
transform = "1.0.0"
direction = "json->json"
target.format = "json"

{}
subtotal = %multiply @.price @.quantity
tax = %round %multiply %multiply @.price @.quantity @.taxRate ##2
discountAmt = %round %multiply %multiply @.price @.quantity @.discount ##2
total = %round %subtract %multiply @.price @.quantity %multiply %multiply @.price @.quantity @.discount ##2
absWeight = %abs @.weight
negPrice = %negate @.price
rounded = %round @.price ##2
ceiling = %ceil @.price
floored = %floor @.price
remainder = %mod @.quantity ##7
sum = %sum @.items
count = %count @.items
avg = %avg @.items
min = %min @.items
max = %max @.items
median = %median @.items
