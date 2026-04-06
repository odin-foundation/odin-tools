{$}
odin = "1.0.0"
transform = "1.0.0"
direction = "json->odin"
target.format = "odin"
description = "Transform all JSON types to ODIN with proper type prefixes"

; Primitive Types
{primitives}
string_simple = @.primitives.string_simple
string_empty = @.primitives.string_empty
string_unicode = @.primitives.string_unicode
string_special_chars = @.primitives.string_special_chars
string_long = @.primitives.string_long

integer_positive = @.primitives.integer_positive :type integer
integer_negative = @.primitives.integer_negative :type integer
integer_zero = @.primitives.integer_zero :type integer
integer_large = @.primitives.integer_large :type integer
integer_large_negative = @.primitives.integer_large_negative :type integer

number_simple = @.primitives.number_simple :type number
number_negative = @.primitives.number_negative :type number
number_zero = @.primitives.number_zero :type number
number_scientific = @.primitives.number_scientific :type number
number_high_precision = @.primitives.number_high_precision :type number

currency_simple = @.primitives.currency_simple :type currency
currency_zero = @.primitives.currency_zero :type currency
currency_negative = @.primitives.currency_negative :type currency
currency_high_precision = @.primitives.currency_high_precision :type currency :decimals 18
currency_large = @.primitives.currency_large :type currency
currency_usd = @.primitives.currency_usd :type currency :currencyCode "USD"
currency_eur = @.primitives.currency_eur :type currency :currencyCode "EUR"

percent_rate = @.primitives.percent_rate :type percent
percent_discount = @.primitives.percent_discount :type percent
percent_tax = @.primitives.percent_tax :type percent

boolean_true = @.primitives.boolean_true :type boolean
boolean_false = @.primitives.boolean_false :type boolean
null_value = @.primitives.null_value

; Temporal Types
{temporal}
date_simple = @.temporal.date_simple :date
date_leap_year = @.temporal.date_leap_year :date
date_year_start = @.temporal.date_year_start :date
date_year_end = @.temporal.date_year_end :date

timestamp_utc = @.temporal.timestamp_utc :timestamp
timestamp_offset = @.temporal.timestamp_offset :timestamp
timestamp_negative_offset = @.temporal.timestamp_negative_offset :timestamp
timestamp_milliseconds = @.temporal.timestamp_milliseconds :timestamp

time_simple = @.temporal.time_simple :time
time_midnight = @.temporal.time_midnight :time
time_end_of_day = @.temporal.time_end_of_day :time
time_with_millis = @.temporal.time_with_millis :time

duration_years = @.temporal.duration_years :duration
duration_months = @.temporal.duration_months :duration
duration_days = @.temporal.duration_days :duration
duration_complex = @.temporal.duration_complex :duration
duration_time = @.temporal.duration_time :duration
duration_full = @.temporal.duration_full :duration

; Special Types
{special}
reference_simple = @.special.reference_target :type reference
reference_nested = @.special.reference_nested :type reference
reference_array = @.special.reference_array :type reference
binary_simple = @.special.binary_simple :type binary
binary_with_algorithm = @.special.binary_with_algorithm :type binary

; Arrays
{arrays.strings[]}
_loop = "arrays.strings"
_ = @

{arrays.integers[]}
_loop = "arrays.integers"
_ = @ :type integer

{arrays.mixed[]}
_loop = "arrays.mixed"
_ = %tryCoerce @

{arrays.empty_array[]}
_loop = "arrays.empty_array"
_ = @

{arrays.smart_mixed[]}
_loop = "arrays.smart_mixed"
_ = %tryCoerce @

; Tabular Data
{products[]}
_loop = "products"
id = @.id :type integer
name = @.name
price = @.price :type currency
inStock = @.inStock :type boolean
category = @.category

{employees[]}
_loop = "employees"
id = @.id :type integer
name = @.name
hireDate = @.hireDate :date
salary = @.salary :type currency
active = @.active :type boolean

; Nested Objects
{nested}
level1.level2.level3.value = @.nested.level1.level2.level3.value
level1.level2.sibling = @.nested.level1.level2.sibling :type integer

{nested.person}
name = @.nested.person.name
age = @.nested.person.age :type integer

{nested.person.contacts[]}
_loop = "nested.person.contacts"
type = @.type
value = @.value

{nested.person.address}
street = @.nested.person.address.street
city = @.nested.person.address.city
zip = @.nested.person.address.zip
country = @.nested.person.address.country

; Edge Cases
{edge_cases}
crypto_amount = @.edge_cases.crypto_amount :type currency :decimals 18
pi_extended = @.edge_cases.pi_extended :type number
json_in_string = @.edge_cases.json_in_string
xml_in_string = @.edge_cases.xml_in_string
path_with_spaces = @.edge_cases.path_with_spaces
url = @.edge_cases.url
max_safe_integer = @.edge_cases.max_safe_integer :type integer
min_safe_integer = @.edge_cases.min_safe_integer :type integer
emoji_string = @.edge_cases.emoji_string
rtl_text = @.edge_cases.rtl_text
chinese_text = @.edge_cases.chinese_text
mixed_scripts = @.edge_cases.mixed_scripts
