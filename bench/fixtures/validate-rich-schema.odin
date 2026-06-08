{$}
odin = "1.0.0"
schema = "1.0.0"

{order}
id = "string :required :min 1 :max 40"
email = :format email
website = :format url
trackingId = :format uuid
ssn = :format ssn
vin = :format vin
phone = :format phone
zip = :format zip
serverIp = :format ipv4
serverIp6 = :format ipv6
card = :format creditcard
orderDate = :format date-iso
insurerNaic = :format naic
ein = :format fein
currency = :format currency-code
shipCountry = :format country-alpha2
billCountry = :format country-alpha3
shipState = :format state-us
subtotal = !#$
tax = !#$
shipping = !#$
total = !#$
quantity = "integer :required :min 1 :max 10000"
unitPrice = "currency :required :min 0"
discount = "currency :min 0 :max 100"
status = "string :required"
:invariant total = subtotal + tax + shipping
:invariant tax >= 0
:invariant shipping >= 0
:invariant quantity >= 1

{order.customer}
name = "string :required :min 1 :max 100"
contactEmail = :format email
homePhone = :format phone
loyaltyId = :format uuid
age = "integer :min 18 :max 120"
:invariant age >= 18
