ok(if mySpecialVariable? then false else true)

mySpecialVariable = false

ok(if mySpecialVariable? then true else false)


# Existential assignment.
a = 5
a = null
a ?= 10
b ?= 10

ok a is 10 and b is 10


# The existential operator.
z = null
x = z ? "EX"

ok z is null and x is "EX"


# Only evaluate once.
counter = 0
getNextNode = ->
  throw "up" if counter
  counter++

ok(if getNextNode()? then true else false)


# Existence chains, soaking up undefined properties:
obj = {
  prop: "hello"
}

ok obj?.prop is "hello"

ok obj?['prop'] is "hello"

ok obj.prop?.length is 5

ok obj?['prop']?['length'] is 5

ok obj?.prop?.non?.existent?.property is null

ok obj?['non']?['existent'].property is null


# Soaks and caches method calls as well.
arr = ["--", "----"]

ok arr.pop()?.length is 4
ok arr.pop()?.length is 2
ok arr.pop()?.length is null
ok arr[0]?.length is null
ok arr.pop()?.length?.non?.existent()?.property is null


# Soaks method calls safely.
value = undefined
result = value?.toString().toLowerCase()

ok result is null

value = 10
result = value?.toString().toLowerCase()

ok result is '10'


# Soaks constructor invocations.
a = 0
class Foo
  constructor: -> a += 1
  bar: "bat"

ok (new Foo())?.bar is 'bat'
ok a is 1


# Safely existence test on soaks.
result = not value?.property?
ok result


# Safely calls values off of non-existent variables.
result = nothing?.value
ok result is null


# Assign to the result of an exsitential operation with a minus.
x = null ? - 1
ok x is - 1


# Things that compile to ternaries should force parentheses, like operators do.
duration = if options?.animated then 150 else 0
ok duration is 0
