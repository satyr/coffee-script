# Basic array comprehensions.
nums =    n * n for n in [1, 2, 3] when n % 2 isnt 0
results = n * 2 for n in nums

ok results.join(',') is '2,18'


# Basic object comprehensions.
obj   = {one: 1, two: 2, three: 3}
names = prop + '!' for prop of obj
odds  = prop + '!' for prop, value of obj when value % 2 isnt 0

ok names.join(' ') is "one! two! three!"
ok odds.join(' ')  is "one! three!"


# Basic range comprehensions.
nums = i * 3 for i in 1 to 3
negs = x for x in [-20 to -5*2]
eq nums.concat(negs.slice 0, 3).join(' '), '3 6 9 -20 -19 -18'


# With range comprehensions, you can loop in steps.
eq (x for x in 0 to 10 by 5).join(' '), '0 5 10'
eq (x for x in 100 to 0 by -10).join(' '), '100 90 80 70 60 50 40 30 20 10 0'
eq [10-5 to -2+3 by 1-2].join(' '), '5 4 3 2 1'


# Multiline array comprehension with filter.
evens = for num in [1, 2, 3, 4, 5, 6] when num % 2 is 0
           num *= -1
           num -= 2
           num * -1

ok evens.join(', ') is '4, 6, 8'


# The in operator still works, standalone.
ok 2 of evens


# Ensure that the closure wrapper preserves local variables.
obj = {}

for method in ['one', 'two', 'three']
  obj[method] = ->
    "I'm " + method

ok obj.one()   is "I'm one"
ok obj.two()   is "I'm two"
ok obj.three() is "I'm three"


# Ensure that local variables are closed over for range comprehensions.
funcs = for i in [1 to 3]
  -> -i

ok (func() for func in funcs).join(' ') is '-1 -2 -3'


# Even when referenced in the filter.
list = ['one', 'two', 'three']

methods = for num, i in list when num isnt 'two' and i isnt 1
  -> num + ' ' + i

ok methods.length is 2
ok methods[0]() is 'one 0'
ok methods[1]() is 'three 2'


# Naked ranges are expanded into arrays.
eq CoffeeScript.compile('[1 to 5 by 2]', noWrap: on), '[1, 3, 5];'


# Nested comprehensions.
multiLiner =
  for x in 3 to 5
    for y in 3 to 5
      [x, y]

singleLiner =
  [x, y] for y in [3 to 5] for x in [3 to 5]

ok multiLiner.length is singleLiner.length
ok 5 is multiLiner[2][2][1]
ok 5 is singleLiner[2][2][1]


# Comprehensions within parentheses.
result = null
store = (obj) -> result = obj
store (x * 2 for x in [3, 2, 1])

ok result.join(' ') is '6 4 2'


# Closure-wrapped comprehensions that refer to the "arguments" object.
expr = ->
  result = item * item for item in arguments

ok expr(2, 4, 8).join(' ') is '4 16 64'


# Fast object comprehensions over all properties, including prototypal ones.
class Cat
  constructor: -> @name = 'Whiskers'
  breed: 'tabby'
  hair:  'cream'

whiskers = new Cat
own = value for key, value of whiskers
all = value for all key, value of whiskers

ok own.join(' ') is 'Whiskers'
ok all.sort().join(' ') is 'Whiskers cream tabby'


# Comprehensions safely redeclare parameters if they're not present in closest
# scope.
rule = (x) -> x

learn = ->
  rule for rule in [1, 2, 3]

ok learn().join(' ') is '1 2 3'

ok rule(101) is 101
