{$}
odin = "1.0.0"
type = "schema"

{Person}
name = "string :required :min 1 :max 100"
age = "integer :required :min 0 :max 150"
email = "string :format email"
phone = "string"
active = "boolean :default true"
salary = "currency :min 0"
startDate = "date"

{Person.address}
street = "string :required"
city = "string :required"
state = "string :min 2 :max 2"
zip = "string :pattern \"^\\d{5}$\""
country = "string :default \"USA\""

{Person.tags}
_ = "string[]"

{Department}
name = "string :required :min 1"
code = "string :required :min 2 :max 10"
headCount = "integer :min 0"
