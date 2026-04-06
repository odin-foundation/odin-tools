{$}
odin = "1.0.0"
{}
{company}
name = "ACME Corporation"
founded = "2010-05-15"
active = true
employeeCount = ##150
annualRevenue = #$2500000.00:USD
taxRate = #%0.21
discountRate = #%0.10
{contact}
email = "info@acme.com"
phone = "+1-555-123-4567"
website = "https://acme.com"
{address}
street = "123 Main Street"
city = "Springfield"
state = "IL"
zip = "62701"
country = "USA"
{employees[] : id, name, department, salary, hireDate, active}
##101, "John Smith", "Engineering", #$85000.00, "2020-01-15", true
##102, "Jane Doe", "Marketing", #$72000.00, "2019-06-01", true
##103, "Bob Wilson", "Engineering", #$92000.00, "2018-03-20", true
##104, "Alice Brown", "HR", #$68000.00, "2021-09-01", false
{products[] : sku, name, price, quantity, available}
"SKU-001", "Widget Pro", #$29.99, ##100, true
"SKU-002", "Gadget Plus", #$149.50, ##25, true
"SKU-003", "Tool Master", #$9.99, ##0, false
