{$}
odin = "1.0.0"
description = "Modified all-types for diff benchmarking (~30% changed)"

; ═══════════════════════════════════════════════════════════════════════════════
; PRIMITIVE TYPES
; ═══════════════════════════════════════════════════════════════════════════════

{primitives}
; String types — changed
string_simple = "Hello Universe"
string_empty = ""
string_unicode = "Hello 世界 🌍 مرحبا"
string_special_chars = "Line1\nLine2\tTabbed\"Quoted\""
string_long = "Updated lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum ante ipsum primis in faucibus."
string_extra = "newly added field"

; Integer types — changed
integer_positive = ##43
integer_negative = ##-100
integer_zero = ##0
integer_large = ##9007199254740991
integer_large_negative = ##-9007199254740990

; Number types — changed
number_simple = #3.14159
number_negative = #-273.15
number_zero = #0.0
number_scientific = #6.022e23
number_high_precision = #3.141592653589793238

; Currency types — changed
currency_simple = #$109.99
currency_zero = #$0.00
currency_negative = #$-50.00
currency_high_precision = #$0.123456789012345678
currency_large = #$2000000.00

; Boolean types — changed
boolean_true = ?false
boolean_false = ?false

; Null type
null_value = ~

; ═══════════════════════════════════════════════════════════════════════════════
; TEMPORAL TYPES
; ═══════════════════════════════════════════════════════════════════════════════

{temporal}
date_simple = 2025-01-20
date_leap_year = 2024-02-29
date_year_start = 2025-01-01
date_year_end = 2024-12-31

timestamp_utc = 2025-01-20T15:45:00Z
timestamp_offset = 2024-12-15T10:30:00+05:30
timestamp_negative_offset = 2024-12-15T10:30:00-08:00
timestamp_milliseconds = 2025-01-20T15:45:00.456Z

time_simple = T14:30:00
time_midnight = T00:00:00
time_end_of_day = T23:59:59
time_with_millis = T14:30:00.500

duration_years = P2Y
duration_months = P6M
duration_days = P30D
duration_complex = P2Y3M4D
duration_time = PT2H30M
duration_full = P1Y2M3DT4H5M6S

; ═══════════════════════════════════════════════════════════════════════════════
; SPECIAL TYPES
; ═══════════════════════════════════════════════════════════════════════════════

{special}
reference_simple = @primitives.string_simple
reference_nested = @temporal.timestamp_utc
reference_array = @arrays.strings[0]

binary_simple = ^SGVsbG8gV29ybGQ=
binary_with_algorithm = ^sha256:2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824

; ═══════════════════════════════════════════════════════════════════════════════
; ARRAYS — changed
; ═══════════════════════════════════════════════════════════════════════════════

{arrays}
strings[0] = "first"
strings[1] = "second"
strings[2] = "third"
strings[3] = "fourth"

integers[0] = ##10
integers[1] = ##20
integers[2] = ##30

mixed[0] = "string"
mixed[1] = ##42
mixed[2] = #$99.99
mixed[3] = ?true
mixed[4] = ~

empty_array[0] = ~

; ═══════════════════════════════════════════════════════════════════════════════
; TABULAR DATA — changed
; ═══════════════════════════════════════════════════════════════════════════════

{products[] : id, name, price, inStock, category}
##1, "Widget A Pro", #$34.99, ?true, "Electronics"
##2, "Gadget B", #$149.50, ?true, "Electronics"
##3, "Tool C", #$9.99, ?true, "Hardware"
##4, "Accessory D", #$19.99, ?true, "Accessories"

{employees[] : id, name, hireDate, salary, active}
##101, "John Smith", 2020-01-15, #$80000.00, ?true
##102, "Jane Doe", 2019-06-01, #$85000.00, ?true
##103, "Bob Wilson", 2021-03-20, #$70000.00, ?true

; ═══════════════════════════════════════════════════════════════════════════════
; NESTED OBJECTS
; ═══════════════════════════════════════════════════════════════════════════════

{nested}
level1.level2.level3.value = "deeply nested updated"
level1.level2.sibling = ##99

{nested.person}
name = "Alice Johnson-Smith"
age = ##31

{nested.person.address}
street = "456 Elm St"
city = "Springfield"
zip = "12345"
country = "USA"

{nested.person.contacts[] : type, value}
"email", "alice.smith@example.com"
"phone", "+1-555-123-4567"
"fax", "+1-555-999-0000"

; ═══════════════════════════════════════════════════════════════════════════════
; EDGE CASES
; ═══════════════════════════════════════════════════════════════════════════════

{edge_cases}
crypto_amount = #$0.000000000000000001
pi_extended = #3.14159265358979323846264338327950288
json_in_string = "{\"key\": \"updated\", \"array\": [1,2,3,4]}"
xml_in_string = "<root><child attr=\"val\">updated text</child></root>"
path_with_spaces = "C:\\Program Files\\My App\\config.json"
url = "https://example.com/path?query=value&other=456"
max_safe_integer = ##9007199254740991
min_safe_integer = ##-9007199254740991
emoji_string = "🎉🚀💯🔥✨"
rtl_text = "שלום עולם"
chinese_text = "你好世界"
mixed_scripts = "Hello こんにちは Привет مرحبا"
