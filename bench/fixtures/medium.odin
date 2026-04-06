{$}
odin = "1.0.0"
description = "Canonical test data covering all ODIN types and edge cases"

; ═══════════════════════════════════════════════════════════════════════════════
; PRIMITIVE TYPES
; ═══════════════════════════════════════════════════════════════════════════════

{primitives}
; String types
string_simple = "Hello World"
string_empty = ""
string_unicode = "Hello 世界 🌍 مرحبا"
string_special_chars = "Line1\nLine2\tTabbed\"Quoted\""
string_long = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."

; Integer types
integer_positive = ##42
integer_negative = ##-100
integer_zero = ##0
integer_large = ##9007199254740991
integer_large_negative = ##-9007199254740991

; Number types (floating point)
number_simple = #3.14
number_negative = #-273.15
number_zero = #0.0
number_scientific = #6.022e23
number_high_precision = #3.141592653589793238

; Currency types
currency_simple = #$99.99
currency_zero = #$0.00
currency_negative = #$-50.00
currency_high_precision = #$0.123456789012345678
currency_large = #$1000000.00

; Boolean types
boolean_true = ?true
boolean_false = ?false

; Null type
null_value = ~

; ═══════════════════════════════════════════════════════════════════════════════
; TEMPORAL TYPES
; ═══════════════════════════════════════════════════════════════════════════════

{temporal}
date_simple = 2024-12-15
date_leap_year = 2024-02-29
date_year_start = 2024-01-01
date_year_end = 2024-12-31

timestamp_utc = 2024-12-15T10:30:00Z
timestamp_offset = 2024-12-15T10:30:00+05:30
timestamp_negative_offset = 2024-12-15T10:30:00-08:00
timestamp_milliseconds = 2024-12-15T10:30:00.123Z

time_simple = T14:30:00
time_midnight = T00:00:00
time_end_of_day = T23:59:59
time_with_millis = T14:30:00.500

duration_years = P1Y
duration_months = P6M
duration_days = P30D
duration_complex = P1Y2M3D
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
; ARRAYS
; ═══════════════════════════════════════════════════════════════════════════════

{arrays}
strings[0] = "first"
strings[1] = "second"
strings[2] = "third"

integers[0] = ##1
integers[1] = ##2
integers[2] = ##3

mixed[0] = "string"
mixed[1] = ##42
mixed[2] = #$99.99
mixed[3] = ?true
mixed[4] = ~

empty_array[0] = ~

; ═══════════════════════════════════════════════════════════════════════════════
; TABULAR DATA (Array of Objects)
; ═══════════════════════════════════════════════════════════════════════════════

{products[] : id, name, price, inStock, category}
##1, "Widget A", #$29.99, ?true, "Electronics"
##2, "Gadget B", #$149.50, ?false, "Electronics"
##3, "Tool C", #$9.99, ?true, "Hardware"

{employees[] : id, name, hireDate, salary, active}
##101, "John Smith", 2020-01-15, #$75000.00, ?true
##102, "Jane Doe", 2019-06-01, #$82000.00, ?true
##103, "Bob Wilson", 2021-03-20, #$68000.00, ?false

; ═══════════════════════════════════════════════════════════════════════════════
; NESTED OBJECTS
; ═══════════════════════════════════════════════════════════════════════════════

{nested}
level1.level2.level3.value = "deeply nested"
level1.level2.sibling = ##42

{nested.person}
name = "Alice Johnson"
age = ##30

{nested.person.address}
street = "123 Main St"
city = "Springfield"
zip = "12345"
country = "USA"

{nested.person.contacts[] : type, value}
"email", "alice@example.com"
"phone", "+1-555-123-4567"

; ═══════════════════════════════════════════════════════════════════════════════
; EDGE CASES
; ═══════════════════════════════════════════════════════════════════════════════

{edge_cases}
; Extreme precision
crypto_amount = #$0.000000000000000001
pi_extended = #3.14159265358979323846264338327950288

; Special string content
json_in_string = "{\"key\": \"value\", \"array\": [1,2,3]}"
xml_in_string = "<root><child attr=\"val\">text</child></root>"
path_with_spaces = "C:\\Program Files\\My App\\config.json"
url = "https://example.com/path?query=value&other=123"

; Boundary values
max_safe_integer = ##9007199254740991
min_safe_integer = ##-9007199254740991

; Unicode edge cases
emoji_string = "🎉🚀💯🔥"
rtl_text = "שלום עולם"
chinese_text = "你好世界"
mixed_scripts = "Hello こんにちは Привет"
