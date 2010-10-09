# `nodes.coffee` contains all of the node classes for the syntax tree. Most
# nodes are created as the result of actions in the [grammar](grammar.html),
# but some are created by other nodes as a method of code generation. To convert
# the syntax tree into a string of JavaScript code, call `compile()` on the root.

{Scope} = require './scope'

# Import the helpers we plan to use.
{compact, flatten, merge, del, include, indexOf, starts, ends, last} = require './helpers'

# Constant functions for nodes that don't need customization.
YES  = -> yes
NO   = -> no
THIS = -> this

#### Base

# The **Base** is the abstract base class for all nodes in the syntax tree.
# Each subclass implements the `compileNode` method, which performs the
# code generation for that node. To compile a node to JavaScript,
# call `compile` on it, which wraps `compileNode` in some generic extra smarts,
# to know when the generated code needs to be wrapped up in a closure.
# An options hash is passed and cloned throughout, containing information about
# the environment from higher in the tree (such as if a returned value is
# being requested by the surrounding function), information about the current
# scope, and indentation level.
exports.Base = class Base

  constructor: ->
    @tags = {}

  # Common logic for determining whether to wrap this node in a closure before
  # compiling it, or to compile directly. We need to wrap if this node is a
  # *statement*, and it's not a *pureStatement*, and we're not at
  # the top level of a block (which would be unnecessary), and we haven't
  # already been asked to return the result (because statements know how to
  # return results).
  #
  # If a Node is *topSensitive*, that means that it needs to compile differently
  # depending on whether it's being used as part of a larger expression, or is a
  # top-level statement within the function body.
  compile: (o) ->
    @options = if o then merge o else {}
    @tab     = o.indent
    top     = if @topSensitive() then @options.top else del @options, 'top'
    closure = @isStatement(o) and not @isPureStatement() and not top and
              not @options.asStatement and this not instanceof Comment and
              not @containsPureStatement()
    code = if closure then @compileClosure(@options) else @compileNode(@options)
    code

  # Statements converted into expressions via closure-wrapping share a scope
  # object with their parent closure, to preserve the expected lexical scope.
  compileClosure: (o) ->
    @tab = o.indent
    o.sharedScope = o.scope
    Closure.wrap(this).compile o

  # If the code generation wishes to use the result of a complex expression
  # in multiple places, ensure that the expression is only ever evaluated once,
  # by assigning it to a temporary variable.
  compileReference: (o, options) ->
    pair = unless @isComplex()
      [this, this]
    else
      reference = new Literal o.scope.freeVariable (options?.name) or 'ref'
      compiled  = new Assign reference, this
      [compiled, reference]
    (pair[i] = node.compile o) for node, i in pair if options?.precompile
    pair

  # Convenience method to grab the current indentation level, plus tabbing in.
  idt: (tabs) ->
    idt = @tab or ''
    num = (tabs or 0) + 1
    idt += TAB while num -= 1
    idt

  # Construct a node that returns the current node's result.
  # Note that this is overridden for smarter behavior for
  # many statement nodes (eg If, For)...
  makeReturn: ->
    new Return this

  # Does this node, or any of its children, contain a node of a certain kind?
  # Recursively traverses down the *children* of the nodes, yielding to a block
  # and returning true when the block finds a match. `contains` does not cross
  # scope boundaries.
  contains: (block) ->
    contains = false
    @traverseChildren false, (node) ->
      if block(node)
        contains = true
        return false
    contains

  # Is this node of a certain type, or does it contain the type?
  containsType: (type) ->
    this instanceof type or @contains (node) -> node instanceof type

  # Convenience for the most common use of contains. Does the node contain
  # a pure statement?
  containsPureStatement: ->
    @isPureStatement() or @contains (node) -> node.isPureStatement()

  # Perform an in-order traversal of the AST. Crosses scope boundaries.
  traverse: (block) -> @traverseChildren true, block

  # `toString` representation of the node, for inspecting the parse tree.
  # This is what `coffee --nodes` prints out.
  toString: (idt, override) ->
    idt or= ''
    children = (child.toString idt + TAB for child in @collectChildren()).join('')
    klass = override or @constructor.name + if @soakNode or @exist then '?' else ''
    '\n' + idt + klass + children

  eachChild: (func) ->
    return unless @children
    for attr in @children when this[attr]
      for child in flatten [this[attr]]
        return if func(child) is false

  collectChildren: ->
    nodes = []
    @eachChild (node) -> nodes.push node
    nodes

  traverseChildren: (crossScope, func) ->
    @eachChild (child) ->
      return false if func(child) is false
      if child instanceof Base and
         (crossScope or child not instanceof Code)
        child.traverseChildren crossScope, func

  # Default implementations of the common node properties and methods. Nodes
  # will override these with custom logic, if needed.
  children: []

  unwrap          : THIS
  isStatement     : NO
  isPureStatement : NO
  isComplex       : YES
  topSensitive    : NO

#### Expressions

# The expressions body is the list of expressions that forms the body of an
# indented block of code -- the implementation of a function, a clause in an
# `if`, `switch`, or `try`, and so on...
exports.Expressions = class Expressions extends Base

  children:     ['expressions']
  isStatement:  YES

  constructor: (nodes) ->
    super()
    @expressions = compact flatten nodes or []

  # Tack an expression on to the end of this expression list.
  push: (node) ->
    @expressions.push(node)
    this

  # Add an expression at the beginning of this expression list.
  unshift: (node) ->
    @expressions.unshift(node)
    this

  # If this Expressions consists of just a single node, unwrap it by pulling
  # it back out.
  unwrap: ->
    if @expressions.length is 1 then @expressions[0] else this

  # Is this an empty block of code?
  empty: ->
    @expressions.length is 0

  # An Expressions node does not return its entire body, rather it
  # ensures that the final expression is returned.
  makeReturn: ->
    end = @expressions[idx = @expressions.length - 1]
    end = @expressions[idx -= 1] if end instanceof Comment
    if end and end not instanceof Return
      @expressions[idx] = end.makeReturn()
    this

  # An **Expressions** is the only node that can serve as the root.
  compile: (o) ->
    o or= {}
    if o.scope then super(o) else @compileRoot(o)

  compileNode: (o) ->
    (@compileExpression(node, merge(o)) for node in @expressions).join("\n")

  # If we happen to be the top-level **Expressions**, wrap everything in
  # a safety closure, unless requested not to.
  # It would be better not to generate them in the first place, but for now,
  # clean up obvious double-parentheses.
  compileRoot: (o) ->
    o.indent  = @tab = if o.noWrap then '' else TAB
    o.scope   = new Scope(null, this, null)
    code      = @compileWithDeclarations(o)
    code      = code.replace(TRAILING_WHITESPACE, '')
    if o.noWrap then code else "(function() {\n#{code}\n}).call(this);\n"

  # Compile the expressions body for the contents of a function, with
  # declarations of all inner variables pushed up to the top.
  compileWithDeclarations: (o) ->
    code = @compileNode(o)
    code = """
      #{@tab}var #{ o.scope.compiledAssignments().replace /\n/g, '$&' + @tab };
      #{code}
    """ if o.scope.hasAssignments this
    code = """
      #{@tab}var #{ o.scope.compiledDeclarations() };
      #{code}
    """ if not o.globals and o.scope.hasDeclarations this
    code

  # Compiles a single expression within the expressions body. If we need to
  # return the result, and it's an expression, simply return it. If it's a
  # statement, ask the statement to do so.
  compileExpression: (node, o) ->
    @tab = o.indent
    compiledNode = node.compile merge o, top: true
    if node.isStatement(o) then compiledNode else "#{@idt()}#{compiledNode};"

# Wrap up the given nodes as an **Expressions**, unless it already happens
# to be one.
Expressions.wrap = (nodes) ->
  return nodes[0] if nodes.length is 1 and nodes[0] instanceof Expressions
  new Expressions(nodes)

#### Literal

# Literals are static values that can be passed through directly into
# JavaScript without translation, such as: strings, numbers,
# `true`, `false`, `null`...
exports.Literal = class Literal extends Base

  constructor: (@value) ->
    super()

  makeReturn: ->
    if @isStatement() then this else super()

  # Break and continue must be treated as pure statements -- they lose their
  # meaning when wrapped in a closure.
  isStatement: ->
    @value in ['break', 'continue', 'debugger']
  isPureStatement: Literal::isStatement

  isComplex: NO

  isReserved: ->
    !!@value.reserved

  compileNode: (o) ->
    idt = if @isStatement(o) then @idt() else ''
    end = if @isStatement(o) then ';' else ''
    val = if @isReserved()   then "\"#{@value}\"" else @value
    idt + val + end

  toString: -> ' "' + @value + '"'

#### Return

# A `return` is a *pureStatement* -- wrapping it in a closure wouldn't
# make sense.
exports.Return = class Return extends Base

  isStatement:      YES
  isPureStatement:  YES
  children:         ['expression']

  constructor: (@expression) ->
    super()

  makeReturn: THIS

  compile: (o) ->
    expr = @expression?.makeReturn()
    return expr.compile o if expr and (expr not instanceof Return)
    super o

  compileNode: (o) ->
    expr = ''
    if @expression
      o.asStatement = true if @expression.isStatement(o)
      expr = ' ' + @expression.compile(o)
    "#{@tab}return#{expr};"

#### Value

# A value, variable or literal or parenthesized, indexed or dotted into,
# or vanilla.
exports.Value = class Value extends Base

  children: ['base', 'properties']

  # A **Value** has a base and a list of property accesses.
  constructor: (@base, @properties, tag) ->
    super()
    @properties or= []
    @tags[tag] = yes if tag

  # Add a property access to the list.
  push: (prop) ->
    @properties.push(prop)
    this

  hasProperties: ->
    !!@properties.length

  # Some boolean checks for the benefit of other nodes.

  isArray: ->
    @base instanceof ArrayLiteral and not @properties.length

  isObject: ->
    @base instanceof ObjectLiteral and not @properties.length

  isComplex: ->
    @base.isComplex() or @hasProperties()

  makeReturn: ->
    if @properties.length then super() else @base.makeReturn()


  # The value can be unwrapped as its inner node, if there are no attached
  # properties.
  unwrap: ->
    if @properties.length then this else @base

  # Values are considered to be statements if their base is a statement.
  isStatement: (o) ->
    @base.isStatement(o) and not @properties.length

  isNumber: ->
    @base instanceof Literal and NUMBER.test @base.value

  # A reference has base part (`this` value) and name part.
  # We cache them separately for compiling complex expressions.
  # `a()[b()] ?= c` -> `(_base = a())[_name = b()] ? _base[_name] = c`
  cacheReference: (o) ->
    name = last @properties
    if not @base.isComplex() and @properties.length < 2 and
       not name?.isComplex()
      return [this, this]  # `a` `a.b`
    base = new Value @base, @properties.slice 0, -1
    if base.isComplex()  # `a().b`
      bref = new Literal o.scope.freeVariable 'base'
      base = new Value new Parens new Assign bref, base
    return [base, bref] unless name  # `a()`
    if name.isComplex()  # `a[b()]`
      nref = new Literal o.scope.freeVariable 'name'
      name = new Index new Assign nref, name.index
      nref = new Index nref
    [base.push(name), new Value(bref or base.base, [nref or name])]

  # Override compile to unwrap the value when possible.
  compile: (o) ->
    if not o.top or @properties.length then super(o) else @base.compile(o)

  # We compile a value to JavaScript by compiling and joining each property.
  # Things get much more insteresting if the chain of properties has *soak*
  # operators `?.` interspersed. Then we have to take care not to accidentally
  # evaluate a anything twice when building the soak chain.
  compileNode: (o) ->
    return ex.compile o if ex = @unfoldSoak o
    props = @properties
    @base.parenthetical = yes if @parenthetical and not props.length
    code = @base.compile o
    if props[0] instanceof Accessor and @isNumber() or
       o.top and @base instanceof ObjectLiteral
      code = "(#{code})"
    (code += prop.compile o) for prop in props
    return code

  # Unfold a soak into an `If`: `a?.b` -> `a.b if a?`
  unfoldSoak: (o) ->
    if @base.soakNode
      Array::push.apply @base.body.properties, @properties
      return @base
    for prop, i in @properties when prop.soakNode
      prop.soakNode = off
      fst = new Value @base, @properties.slice 0, i
      snd = new Value @base, @properties.slice i
      if fst.isComplex()
        ref = new Literal o.scope.freeVariable 'ref'
        fst = new Parens new Assign ref, fst
        snd.base = ref
      ifn = new If new Existence(fst), snd, operation: yes
      ifn.soakNode = on
      return ifn
    null

  # Unfold a node's child if soak, then tuck the node under created `If`
  @unfoldSoak: (o, parent, name) ->
    node = parent[name]
    if node instanceof If and node.soakNode
      ifnode = node
    else if node instanceof Value
      ifnode = node.unfoldSoak o
    return unless ifnode
    parent[name] = ifnode.body
    ifnode.body = new Value parent
    ifnode

#### Comment

# CoffeeScript passes through block comments as JavaScript block comments
# at the same position.
exports.Comment = class Comment extends Base

  isStatement: YES

  constructor: (@comment) ->
    super()

  makeReturn: THIS

  compileNode: (o) ->
    @tab + '/*' + @comment.replace(/\n/g, '\n' + @tab) + '*/'

#### Call

# Node for a function invocation. Takes care of converting `super()` calls into
# calls against the prototype's function of the same name.
exports.Call = class Call extends Base

  children: ['variable', 'args']

  constructor: (variable, @args, @exist) ->
    super()
    @isNew    = false
    @isSuper  = variable is 'super'
    @variable = if @isSuper then null else variable
    @args     or= []

  compileSplatArguments: (o) ->
    Splat.compileSplattedArray @args, o

  # Tag this invocation as creating a new instance.
  newInstance: ->
    @isNew = true
    this

  prefix: ->
    if @isNew then 'new ' else ''

  # Grab the reference to the superclass' implementation of the current method.
  superReference: (o) ->
    {method} = o.scope
    throw Error "cannot call super outside of a function" unless method
    {name} = method
    throw Error "cannot call super on an anonymous function." unless name
    if method.klass
      "#{method.klass}.__super__.#{name}"
    else
      "#{name}.__super__.constructor"

  # Soaked chained invocations unfold into if/else ternary structures.
  unfoldSoak: (o) ->
    call = this
    list = []
    loop
      if call.variable instanceof Call
        list.push call
        call = call.variable
        continue
      break unless call.variable instanceof Value
      list.push call
      break unless (call = call.variable.base) instanceof Call
    for call in list.reverse()
      if node
        if call.variable instanceof Call
          call.variable = node
        else
          call.variable.base = node
      node = Value.unfoldSoak o, call, 'variable'
    node

  # Compile a vanilla function call.
  compileNode: (o) ->
    return node.compile o if node = @unfoldSoak o
    if @exist
      if val = @variable
        val = new Value val unless val instanceof Value
        [left, rite] = val.cacheReference o
        rite = new Call rite, @args
      else
        left = new Literal @superReference o
        rite = new Call new Value(left), @args
        rite.isNew = @isNew
      left = "typeof #{ left.compile o } !== \"function\""
      rite = rite.compile o
      return "(#{left} ? undefined : #{rite})"
    for arg in @args when arg instanceof Splat
      return @compileSplat o
    args = ((arg.parenthetical = on) and arg.compile o for arg in @args).join ', '
    if @isSuper
      @compileSuper args, o
    else
      "#{@prefix()}#{@variable.compile o}(#{args})"

  # `super()` is converted into a call against the superclass's implementation
  # of the current function.
  compileSuper: (args, o) ->
    "#{@superReference(o)}.call(this#{ if args.length then ', ' else '' }#{args})"

  # If you call a function with a splat, it's converted into a JavaScript
  # `.apply()` call to allow an array of arguments to be passed.
  # If it's a constructor, then things get real tricky. We have to inject an
  # inner constructor in order to be able to pass the varargs.
  compileSplat: (o) ->
    splatargs = @compileSplatArguments o
    return "#{ @superReference o }.apply(this, #{splatargs})" if @isSuper
    unless @isNew
      base = new Value base unless (base = @variable) instanceof Value
      if (name = base.properties.pop()) and base.isComplex()
        ref = o.scope.freeVariable 'this'
        fun = "(#{ref} = #{ base.compile o })#{ name.compile o }"
      else
        fun = ref = base.compile o
        fun += name.compile o if name
      return "#{fun}.apply(#{ref}, #{splatargs})"
    call = 'call(this)'
    argvar = (node) -> node instanceof Literal and node.value is 'arguments'
    for arg in @args when arg.contains argvar
      call = 'apply(this, arguments)'
      break
    ctor   = o.scope.freeVariable 'ctor'
    ref    = o.scope.freeVariable 'ref'
    result = o.scope.freeVariable 'result'
    """
    (function() {
    #{idt = @idt 1}var ctor = function() {};
    #{idt}#{utility 'extends'}(ctor, #{ctor} = #{ @variable.compile o });
    #{idt}return typeof (#{result} = #{ctor}.apply(#{ref} = new ctor, #{splatargs})) === "object" ? #{result} : #{ref};
    #{@tab}}).#{call}
    """

#### Extends

# Node to extend an object's prototype with an ancestor object.
# After `goog.inherits` from the
# [Closure Library](http://closure-library.googlecode.com/svn/docs/closureGoogBase.js.html).
exports.Extends = class Extends extends Base

  children: ['child', 'parent']

  constructor: (@child, @parent) ->
    super()

  # Hooks one constructor into another's prototype chain.
  compileNode: (o) ->
    ref =  new Value new Literal utility 'extends'
    (new Call ref, [@child, @parent]).compile o

#### Accessor

# A `.` accessor into a property of a value, or the `::` shorthand for
# an accessor into the object's prototype.
exports.Accessor = class Accessor extends Base

  children: ['name']

  constructor: (@name, tag) ->
    super()
    @prototype = if tag is 'prototype' then '.prototype' else ''
    @soakNode = tag is 'soak'

  compileNode: (o) ->
    name = @name.compile o
    namePart = if name.match(IS_STRING) then "[#{name}]" else ".#{name}"
    @prototype + namePart

  isComplex: NO

#### Index

# A `[ ... ]` indexed accessor into an array or object.
exports.Index = class Index extends Base

  children: ['index']

  constructor: (@index) ->
    super()

  compileNode: (o) ->
    idx = @index.compile o
    prefix = if @proto then '.prototype' else ''
    "#{prefix}[#{idx}]"

  isComplex: -> @index.isComplex()

#### Range

# A range literal. Ranges can be used to specify a range for comprehensions
# or as a value to be expanded into the corresponding array of integers at runtime.
exports.Range = class Range extends Base

  children: ['begin', 'end', 'step']

  constructor: (@begin, @end, @step) -> super()

  # When compiled normally, the range returns the contents of the *for loop*
  # needed to iterate over the values in the range. Used by comprehensions.
  compileNode: (o) ->
    return @compileArray o unless idx = o.index
    o = merge o, top: on
    [bgn, bvar] = @begin.compileReference o, precompile: on, name: 'from'
    [end, evar] = @end  .compileReference o, precompile: on, name: 'to'
    [stp, svar] = @step .compileReference o, precompile: on, name: 'step'
    vars = "#{idx} = #{bgn}"
    vars += ", #{end}" if end isnt evar
    vars += ", #{stp}" if stp isnt svar
    compare = if isNaN stp
      "#{bvar} > #{evar} ? #{idx} >= #{evar} : #{idx} <= #{evar}"
    else
      "#{idx} #{ if stp < 0 then '>=' else '<=' } #{evar}"
    "#{vars}; #{compare}; #{idx} += #{svar}"

  # When used as a value, expand the range into the equivalent array.
  compileArray: (o) ->
    i    = @begin.compile o
    end  = @end  .compile o
    step = @step .compile o
    unless isNaN(i) or isNaN(end) or isNaN(step) or (end - i) / step > 20
      return "[#{ [+i to +end by +step].join ', ' }]"
    idt = @idt 1
    unless isNaN step
      compare = if step < 0 then '>=' else '<='
      return """
        (function(i, end, result) {
        #{idt}for (; i #{compare} end; i += #{step}) result.push(i);
        #{idt}return result;
        #{@tab}})(#{i}, #{end}, [])
      """
    """
    (function(i, end, step, result) {
    #{idt}if (step < 0) for (; i >= end; i += step) result.push(i);
    #{idt}else          for (; i <= end; i += step) result.push(i);
    #{idt}return result;
    #{@tab}})(#{i}, #{end}, #{step}, [])
    """

#### ObjectLiteral

# An object literal, nothing fancy.
exports.ObjectLiteral = class ObjectLiteral extends Base

  children: ['properties']

  topSensitive: YES

  constructor: (props) ->
    super()
    @objects = @properties = props or []

  compileNode: (o) ->
    top = del o, 'top'
    o.indent = @idt 1
    nonComments = prop for prop in @properties when (prop not instanceof Comment)
    lastNoncom  =  last nonComments
    props = for prop, i in @properties
      join   = ",\n"
      join   = "\n" if (prop is lastNoncom) or (prop instanceof Comment)
      join   = '' if i is @properties.length - 1
      indent = if prop instanceof Comment then '' else @idt 1
      if prop instanceof Value and prop.tags.this
        prop = new Assign prop.properties[0].name, prop, 'object'
      else if prop not instanceof Assign and prop not instanceof Comment
        prop = new Assign prop, prop, 'object'
      indent + prop.compile(o) + join
    props = props.join('')
    obj   = '{' + (if props then '\n' + props + '\n' + @idt() else '') + '}'
    if top then "(#{obj})" else obj

#### ArrayLiteral

# An array literal.
exports.ArrayLiteral = class ArrayLiteral extends Base

  children: ['objects']

  constructor: (@objects) ->
    super()
    @objects or= []

  compileSplatLiteral: (o) ->
    Splat.compileSplattedArray @objects, o

  compileNode: (o) ->
    o.indent = @idt 1
    objects = []
    for obj, i in @objects
      code = obj.compile(o)
      if obj instanceof Splat
        return @compileSplatLiteral o
      else if obj instanceof Comment
        objects.push "\n#{code}\n#{o.indent}"
      else if i is @objects.length - 1
        objects.push code
      else
        objects.push "#{code}, "
    objects = objects.join('')
    if indexOf(objects, '\n') >= 0
      "[\n#{@idt(1)}#{objects}\n#{@tab}]"
    else
      "[#{objects}]"

#### Class

# The CoffeeScript class definition.
exports.Class = class Class extends Base

  children:     ['variable', 'parent', 'properties']
  isStatement:  YES

  # Initialize a **Class** with its name, an optional superclass, and a
  # list of prototype property assignments.
  constructor: (variable, @parent, @properties) ->
    super()
    @variable = if variable is '__temp__' then new Literal variable else variable
    @properties or= []
    @returns    = false

  makeReturn: ->
    @returns = true
    this

  # Instead of generating the JavaScript string directly, we build up the
  # equivalent syntax tree and compile that, in pieces. You can see the
  # constructor, property assignments, and inheritance getting built out below.
  compileNode: (o) ->
    {variable} = this
    variable   = new Literal o.scope.freeVariable 'ctor' if variable.value is '__temp__'
    extension  = @parent and new Extends variable, @parent
    props      = new Expressions
    o.top      = true
    me         = null
    className  = variable.compile o
    constScope = null

    if @parent
      applied = new Value @parent, [new Accessor new Literal 'apply']
      constructor = new Code([], new Expressions([
        new Call applied, [new Literal('this'), new Literal('arguments')]
      ]))
    else
      constructor = new Code

    for prop in @properties
      {variable: pvar, value: func} = prop
      if pvar and pvar.base.value is 'constructor'
        if func not instanceof Code
          [func, ref] = func.compileReference o
          props.push func if func isnt ref
          apply = new Call(new Value(ref, [new Accessor new Literal 'apply']), [new Literal('this'), new Literal('arguments')])
          func  = new Code [], new Expressions([apply])
        throw new Error "cannot define a constructor as a bound function." if func.bound
        func.name = className
        func.body.push new Return new Literal 'this'
        variable = new Value variable
        variable.namespaced = include func.name, '.'
        constructor = func
        continue
      if func instanceof Code and func.bound
        if prop.context is 'this'
          func.context = className
        else
          func.bound = false
          constScope or= new Scope(o.scope, constructor.body, constructor)
          me or= constScope.freeVariable 'this'
          pname = pvar.compile(o)
          constructor.body.push    new Return new Literal 'this' if constructor.body.empty()
          constructor.body.unshift new Literal "this.#{pname} = function(){ return #{className}.prototype.#{pname}.apply(#{me}, arguments); }"
      if pvar
        access = if prop.context is 'this' then pvar.base.properties[0] else new Accessor(pvar, 'prototype')
        val    = new Value variable, [access]
        prop   = new Assign(val, func)
      props.push prop

    constructor.className = className.match /[\w\d\$_]+$/
    constructor.body.unshift new Literal "#{me} = this" if me
    construct = @idt() + new Assign(variable, constructor).compile(merge o, sharedScope: constScope) + ';'
    props     = if !props.empty() then '\n' + props.compile(o)                    else ''
    extension = if extension      then '\n' + @idt() + extension.compile(o) + ';' else ''
    returns   = if @returns       then '\n' + new Return(variable).compile(o) else ''
    construct + extension + props + returns

#### Assign

# The **Assign** is used to assign a local variable to value, or to set the
# property of an object -- including within object literals.
exports.Assign = class Assign extends Base

  # Matchers for detecting class/method names
  METHOD_DEF: /^(?:(\S+)\.prototype\.)?([$A-Za-z_][$\w]*)$/

  children: ['variable', 'value']

  constructor: (@variable, @value, @context) ->
    super()

  topSensitive: YES

  isValue: ->
    @variable instanceof Value

  # Compile an assignment, delegating to `compilePatternMatch` if appropriate.
  # Keep track of the name of the base object
  # we've been assigned to, for correct internal references. If the variable
  # has not been seen yet within the current scope, declare it.
  compileNode: (o) ->
    if isValue = @isValue()
      return @compilePatternMatch(o) if @variable.isArray() or @variable.isObject()
      return node.compile o if node = Value.unfoldSoak o, this, 'variable'
    top    = del o, 'top'
    stmt   = del o, 'asStatement'
    name   = @variable.compile(o)
    if @value instanceof Code and match = @METHOD_DEF.exec name
      @value.name  = match[2]
      @value.klass = match[1]
    val = @value.compile o
    return "#{name}: #{val}" if @context is 'object'
    o.scope.find name unless isValue and (@variable.hasProperties() or @variable.namespaced)
    val = "#{name} = #{val}"
    return "#{@tab}#{val};" if stmt
    if top or @parenthetical then val else "(#{val})"

  # Brief implementation of recursive pattern matching, when assigning array or
  # object literals to a value. Peeks at their properties to assign inner names.
  # See the [ECMAScript Harmony Wiki](http://wiki.ecmascript.org/doku.php?id=harmony:destructuring)
  # for details.
  compilePatternMatch: (o) ->
    if (value = @value).isStatement o then value = Closure.wrap value
    {objects} = @variable.base
    return value.compile o unless olength = objects.length
    isObject = @variable.isObject()
    if o.top and olength is 1 and (obj = objects[0]) not instanceof Splat
      # Unroll simplest cases: `{v} = x` -> `v = x.v`
      if obj instanceof Assign
        {variable: {base: idx}, value: obj} = obj
      else
        idx = if isObject
          if obj.tags.this then obj.properties[0].name else obj
        else new Literal 0
      value = new Value value unless value instanceof Value
      accessClass = if IDENTIFIER.test idx.value then Accessor else Index
      value.properties.push new accessClass idx
      return new Assign(obj, value).compile o
    top     = del o, 'top'
    otop    = merge o, top: yes
    valVar  = o.scope.freeVariable 'ref'
    assigns = ["#{valVar} = #{ value.compile o }"]
    splat   = false
    for obj, i in objects
      # A regular array pattern-match.
      idx = i
      if isObject
        if obj instanceof Assign
          # A regular object pattern-match.
          [obj, idx] = [obj.value, obj.variable.base]
        else
          # A shorthand `{a, b, @c} = val` pattern-match.
          idx = if obj.tags.this then obj.properties[0].name else obj
      unless obj instanceof Value or obj instanceof Splat
        throw new Error 'pattern matching must use only identifiers on the left-hand side.'
      accessClass = if isObject and IDENTIFIER.test(idx.value) then Accessor else Index
      if not splat and obj instanceof Splat
        val   = new Literal obj.compileValue o, valVar, i, olength - i - 1
        splat = true
      else
        idx = new Literal(if splat then "#{valVar}.length - #{olength - idx}" else idx) if typeof idx isnt 'object'
        val = new Value new Literal(valVar), [new accessClass idx]
      assigns.push new Assign(obj, val).compile otop
    assigns.push valVar unless top
    code = assigns.join ', '
    if top or @parenthetical then code else "(#{code})"

#### Code

# A function definition. This is the only node that creates a new Scope.
# When for the purposes of walking the contents of a function body, the Code
# has no *children* -- they're within the inner scope.
exports.Code = class Code extends Base

  children: ['params', 'body']

  constructor: (@params, @body, tag) ->
    super()
    @params   or= []
    @body     or= new Expressions
    @bound    = tag is 'boundfunc'
    @context  = 'this' if @bound

  # Compilation creates a new scope unless explicitly asked to share with the
  # outer scope. Handles splat parameters in the parameter list by peeking at
  # the JavaScript `arguments` objects. If the function is bound with the `=>`
  # arrow, generates a wrapper that saves the current value of `this` through
  # a closure.
  compileNode: (o) ->
    sharedScope = del o, 'sharedScope'
    top         = del o, 'top'
    o.scope     = sharedScope or new Scope(o.scope, @body, this)
    o.top       = true
    o.indent    = @idt(1)
    empty       = @body.expressions.length is 0
    del o, 'noWrap'
    del o, 'globals'
    splat = undefined
    params = []
    for param, i in @params
      if splat
        if param.attach
          param.assign = new Assign new Value new Literal('this'), [new Accessor param.value]
          @body.expressions.splice splat.index + 1, 0, param.assign
        splat.trailings.push param
      else
        if param.attach
          {value} = param
          [param, param.splat] = [new Literal(o.scope.freeVariable 'arg'), param.splat]
          @body.unshift new Assign new Value(new Literal('this'), [new Accessor value]), param
        if param.splat
          splat           = new Splat param.value
          splat.index     = i
          splat.trailings = []
          splat.arglength = @params.length
          @body.unshift(splat)
        else
          params.push param
    o.scope.startLevel()
    params = (param.compile(o) for param in params)
    @body.makeReturn() unless empty
    (o.scope.parameter(param)) for param in params
    o.indent = @idt 2 if @className
    code  = if @body.expressions.length then "\n#{ @body.compileWithDeclarations(o) }\n" else ''
    open  = if @className then "(function() {\n#{@idt(1)}return function #{@className}(" else "function("
    close = if @className then "#{code and @idt(1)}};\n#{@tab}})()" else "#{code and @tab}}"
    func  = "#{open}#{ params.join(', ') }) {#{code}#{close}"
    o.scope.endLevel()
    return "#{utility 'bind'}(#{func}, #{@context})" if @bound
    if top then "(#{func})" else func

  topSensitive: YES

  # Short-circuit traverseChildren method to prevent it from crossing scope boundaries
  # unless crossScope is true
  traverseChildren: (crossScope, func) -> super(crossScope, func) if crossScope

#### Param

# A parameter in a function definition. Beyond a typical Javascript parameter,
# these parameters can also attach themselves to the context of the function,
# as well as be a splat, gathering up a group of parameters into an array.
exports.Param = class Param extends Base

  children: ['name']

  constructor: (@name, @attach, @splat) ->
    super()
    @value = new Literal @name

  compileNode: (o) ->
    @value.compile o

  toString: ->
    {name} = @
    name = '@' + name if @attach
    name += '...'     if @splat
    new Literal(name).toString()

#### Splat

# A splat, either as a parameter to a function, an argument to a call,
# or as part of a destructuring assignment.
exports.Splat = class Splat extends Base

  children: ['name']

  constructor: (name) ->
    super()
    name = new Literal name unless name.compile
    @name = name

  compileNode: (o) ->
    if @index? then @compileParam(o) else @name.compile(o)

  # Compiling a parameter splat means recovering the parameters that succeed
  # the splat in the parameter list, by slicing the arguments object.
  compileParam: (o) ->
    name = @name.compile(o)
    o.scope.find name
    end = ''
    if @trailings.length
      len = o.scope.freeVariable 'len'
      o.scope.assign len, "arguments.length"
      variadic = o.scope.freeVariable 'result'
      o.scope.assign variadic, len + ' >= ' + @arglength
      end = if @trailings.length then ", #{len} - #{@trailings.length}"
      for trailing, idx in @trailings
        if trailing.attach
          assign        = trailing.assign
          trailing      = new Literal o.scope.freeVariable 'arg'
          assign.value  = trailing
        pos = @trailings.length - idx
        o.scope.assign(trailing.compile(o), "arguments[#{variadic} ? #{len} - #{pos} : #{@index + idx}]")
    "#{name} = #{utility('slice')}.call(arguments, #{@index}#{end})"

  # A compiling a splat as a destructuring assignment means slicing arguments
  # from the right-hand-side's corresponding array.
  compileValue: (o, name, index, trailings) ->
    trail = if trailings then ", #{name}.length - #{trailings}" else ''
    "#{utility 'slice'}.call(#{name}, #{index}#{trail})"

  # Utility function that converts arbitrary number of elements, mixed with
  # splats, to a proper array
  @compileSplattedArray: (list, o) ->
    args = []
    end = -1
    for arg, i in list
      code = arg.compile o
      prev = args[end]
      if arg not instanceof Splat
        if prev and starts(prev, '[') and ends(prev, ']')
          args[end] = "#{prev.slice 0, -1}, #{code}]"
          continue
        if prev and starts(prev, '.concat([') and ends(prev, '])')
          args[end] = "#{prev.slice 0, -2}, #{code}])"
          continue
        code = "[#{code}]"
      args[++end] = if i is 0 then code else ".concat(#{code})"
    args.join ''

#### While

# A while loop, the only sort of low-level loop exposed by CoffeeScript. From
# it, all other loops can be manufactured. Useful in cases where you need more
# flexibility or more speed than a comprehension can provide.
exports.While = class While extends Base

  children:     ['condition', 'guard', 'body']
  isStatement: YES

  constructor: (condition, opts) ->
    super()
    if opts?.invert
      condition = new Parens condition if condition instanceof Op
      condition = new Op('!', condition)
    @condition  = condition
    @guard = opts?.guard

  addBody: (body) ->
    @body = body
    this

  makeReturn: ->
    @returns = true
    this

  topSensitive: YES

  # The main difference from a JavaScript *while* is that the CoffeeScript
  # *while* can be used as a part of a larger expression -- while loops may
  # return an array containing the computed result of each iteration.
  compileNode: (o) ->
    top      =  del(o, 'top') and not @returns
    o.indent =  @idt 1
    o.top    =  true
    @condition.parenthetical = yes
    cond     =  @condition.compile(o)
    set      =  ''
    unless top
      rvar  = o.scope.freeVariable 'result'
      set   = "#{@tab}#{rvar} = [];\n"
      @body = Push.wrap(rvar, @body) if @body
    pre     = "#{set}#{@tab}while (#{cond})"
    @body   = Expressions.wrap([new If(@guard, @body)]) if @guard
    if @returns
      post = '\n' + new Return(new Literal rvar).compile(merge(o, indent: @idt()))
    else
      post = ''
    "#{pre} {\n#{ @body.compile(o) }\n#{@tab}}#{post}"

#### Op

# Simple Arithmetic and logical operations. Performs some conversion from
# CoffeeScript operations into their JavaScript equivalents.
exports.Op = class Op extends Base

  # The map of conversions from CoffeeScript to JavaScript symbols.
  CONVERSIONS:
    '==': '==='
    '!=': '!=='
    of: 'in'

  # The map of invertible operators.
  INVERSIONS:
    '!==': '==='
    '===': '!=='

  # The list of operators for which we perform
  # [Python-style comparison chaining](http://docs.python.org/reference/expressions.html#notin).
  CHAINABLE:        ['<', '>', '>=', '<=', '===', '!==']

  # Our assignment operators that have no JavaScript equivalent.
  ASSIGNMENT:       ['||=', '&&=', '?=']

  # Operators must come before their operands with a space.
  PREFIX_OPERATORS: ['new', 'typeof', 'delete']

  children: ['first', 'second']

  constructor: (op, first, second, flip) ->
    if first instanceof Value
      if first.base instanceof ObjectLiteral
        first = new Parens first
      else if not second and op in ['+', '-'] and NUMBER.test(first.base.value)
        return new Value new Literal op + first.base.value
    else if op is 'new' and first instanceof Call
      return first.newInstance()
    super()
    @operator = @CONVERSIONS[op] or op
    @first    = first
    @second   = second
    @flip     = !!flip
    @first  .tags.operation = yes
    @second?.tags.operation = yes

  isUnary: ->
    not @second

  isInvertible: ->
    @operator in ['===', '!==']

  isComplex: -> @operator isnt '!' or @first.isComplex()

  isMutator: ->
    ends(@operator, '=') and @operator not in ['===', '!==']

  isChainable: ->
    include(@CHAINABLE, @operator)

  invert: ->
    @operator = @INVERSIONS[@operator]

  toString: (idt) ->
    super(idt, @constructor.name + ' ' + @operator)

  compileNode: (o) ->
    return node.compile o if node = Value.unfoldSoak o, this, 'first'
    return @compileChain(o)      if @isChainable() and @first.unwrap() instanceof Op and @first.unwrap().isChainable()
    return @compileAssignment(o) if indexOf(@ASSIGNMENT, @operator) >= 0
    return @compileUnary(o)      if @isUnary()
    return @compileExistence(o)  if @operator is '?'
    @first  = new Parens @first  if @first  instanceof Op and @first.isMutator()
    @second = new Parens @second if @second instanceof Op and @second.isMutator()
    [@first.compile(o), @operator, @second.compile(o)].join ' '

  # Mimic Python's chained comparisons when multiple comparison operators are
  # used sequentially. For example:
  #
  #     bin/coffee -e "puts 50 < 65 > 10"
  #     true
  compileChain: (o) ->
    shared = @first.unwrap().second
    [@first.second, shared] = shared.compileReference o
    [first, second, shared] = [@first.compile(o), @second.compile(o), shared.compile(o)]
    "(#{first}) && (#{shared} #{@operator} #{second})"

  # When compiling a conditional assignment, take care to ensure that the
  # operands are only evaluated once, even though we have to reference them
  # more than once.
  compileAssignment: (o) ->
    [left, rite] = @first.cacheReference o
    rite = new Assign rite, @second
    return new Op(@operator.slice(0, -1), left, rite).compile o

  compileExistence: (o) ->
    if @first.isComplex()
      ref = o.scope.freeVariable 'ref'
      fst = new Parens new Assign new Literal(ref), @first
    else
      fst = @first
      ref = fst.compile o
    new Existence(fst).compile(o) + " ? #{ref} : #{ @second.compile o }"

  # Compile a unary **Op**.
  compileUnary: (o) ->
    space = if indexOf(@PREFIX_OPERATORS, @operator) >= 0 then ' ' else ''
    parts = [@operator, space, @first.compile(o)]
    parts = parts.reverse() if @flip
    parts.join('')

#### In
exports.In = class In extends Base

  children: ['object', 'array']

  constructor: (@object, @array) ->
    super()

  isArray: ->
    @array instanceof Value and @array.isArray()

  compileNode: (o) ->
    [@obj1, @obj2] = @object.compileReference o, precompile: yes
    if @isArray() then @compileOrTest(o) else @compileLoopTest(o)

  compileOrTest: (o) ->
    tests = for item, i in @array.base.objects
      "#{item.compile(o)} === #{if i then @obj2 else @obj1}"
    "(#{tests.join(' || ')})"

  compileLoopTest: (o) ->
    [@arr1, @arr2] = @array.compileReference o, precompile: yes
    [i, l] = [o.scope.freeVariable('i'), o.scope.freeVariable('len')]
    prefix = if @obj1 isnt @obj2 then @obj1 + '; ' else ''
    "(function(){ #{prefix}for (var #{i}=0, #{l}=#{@arr1}.length; #{i}<#{l}; #{i}++) { if (#{@arr2}[#{i}] === #{@obj2}) return true; } return false; }).call(this)"

#### Try

# A classic *try/catch/finally* block.
exports.Try = class Try extends Base

  children:     ['attempt', 'recovery', 'ensure']
  isStatement: YES

  constructor: (@attempt, @error, @recovery, @ensure) ->
    super()

  makeReturn: ->
    @attempt  = @attempt.makeReturn() if @attempt
    @recovery = @recovery.makeReturn() if @recovery
    this

  # Compilation is more or less as you would expect -- the *finally* clause
  # is optional, the *catch* is not.
  compileNode: (o) ->
    o.indent    = @idt 1
    o.top       = true
    attemptPart = @attempt.compile(o)
    errorPart   = if @error then " (#{ @error.compile(o) }) " else ' '
    catchPart   = if @recovery
      " catch#{errorPart}{\n#{ @recovery.compile(o) }\n#{@tab}}"
    else unless @ensure or @recovery then ' catch (_e) {}' else ''
    finallyPart = (@ensure or '') and ' finally {\n' + @ensure.compile(merge(o)) + "\n#{@tab}}"
    "#{@tab}try {\n#{attemptPart}\n#{@tab}}#{catchPart}#{finallyPart}"

#### Throw

# Simple node to throw an exception.
exports.Throw = class Throw extends Base

  children:     ['expression']
  isStatement: YES

  constructor: (@expression) ->
    super()

  # A **Throw** is already a return, of sorts...
  makeReturn: THIS

  compileNode: (o) ->
    "#{@tab}throw #{@expression.compile(o)};"

#### Existence

# Checks a variable for existence -- not *null* and not *undefined*. This is
# similar to `.nil?` in Ruby, and avoids having to consult a JavaScript truth
# table.
exports.Existence = class Existence extends Base

  children: ['expression']

  constructor: (@expression) ->
    super()

  compileNode: (o) ->
    code = @expression.compile o
    code = if IDENTIFIER.test(code) and not o.scope.check code
      "typeof #{code} !== \"undefined\" && #{code} !== null"
    else
      "#{code} != null"
    if @parenthetical then code else "(#{code})"

#### Parens

# An extra set of parentheses, specified explicitly in the source. At one time
# we tried to clean up the results by detecting and removing redundant
# parentheses, but no longer -- you can put in as many as you please.
#
# Parentheses are a good way to force any statement to become an expression.
exports.Parens = class Parens extends Base

  children: ['expression']

  constructor: (@expression) ->
    super()

  isStatement: (o) ->
    @expression.isStatement(o)
  isComplex: ->
    @expression.isComplex()

  topSensitive: YES

  makeReturn: ->
    @expression.makeReturn()

  compileNode: (o) ->
    top  = del o, 'top'
    @expression.parenthetical = true
    code = @expression.compile(o)
    return code if top and @expression.isPureStatement o
    if @parenthetical or @isStatement o
      return if top then @tab + code + ';' else code
    "(#{code})"

#### For

# CoffeeScript's replacement for the *for* loop is our array and object
# comprehensions, that compile into *for* loops here. They also act as an
# expression, able to return the result of each filtered iteration.
#
# Unlike Python array comprehensions, they can be multi-line, and you can pass
# the current index of the loop as a second parameter. Unlike Ruby blocks,
# you can map and filter in a single pass.
exports.For = class For extends Base

  children:     ['body', 'source', 'guard']
  isStatement: YES

  constructor: (@body, source, @name, @index) ->
    super()
    {@source, @guard, @step} = source
    @raw    = !!source.raw
    @object = !!source.object
    [@name, @index] = [@index, @name] if @object
    @pattern = @name instanceof Value
    throw new Error('index cannot be a pattern matching expression') if @index instanceof Value
    @returns = false

  topSensitive: YES

  makeReturn: ->
    @returns = true
    this

  compileReturnValue: (val, o) ->
    return '\n' + new Return(new Literal val).compile(o) if @returns
    return '\n' + val if val
    ''

  # Welcome to the hairiest method in all of CoffeeScript. Handles the inner
  # loop, filtering, stepping, and result saving for array, object, and range
  # comprehensions. Some of the generated code can be shared in common, and
  # some cannot.
  compileNode: (o) ->
    {scope}       = o
    topLevel      = del(o, 'top') and not @returns
    codeInBody    = @body.contains (node) -> node instanceof Code
    range         = @source instanceof Range
    name          = @name  and @name.compile o
    index         = @index and @index.compile o
    scope.find(name,  immediate: yes) if name and not @pattern and (range or not codeInBody)
    scope.find(index, immediate: yes) if index
    rvar          = scope.freeVariable 'result' unless topLevel
    ivar          = if range then name else index
    ivar          = scope.freeVariable 'i' if not ivar or codeInBody
    varPart       = ''
    guardPart     = ''
    body          = Expressions.wrap([@body])
    idt           = @idt 1
    if range
      forPart = @source.compile merge o, index: ivar
    else
      svar = sourcePart = @source.compile o
      if (name or not @raw) and
         not (IDENTIFIER.test(svar) and scope.check svar, immediate: on)
        sourcePart = "#{ref = scope.freeVariable 'ref'} = #{svar}"
        sourcePart = "(#{sourcePart})" unless @object
        svar = ref
      namePart = if @pattern
        new Assign(@name, new Literal "#{svar}[#{ivar}]").compile merge o, top: on
      else if name
        "#{name} = #{svar}[#{ivar}]"
      unless @object
        lvar      = scope.freeVariable 'len'
        stepPart  = if @step
          [step, stepVar] = @step.compileReference o, name: 'step', precompile: yes
          "#{ivar} += #{stepVar}"
        else "#{ivar}++"
        vars      = "#{ivar} = 0, #{lvar} = #{sourcePart}.length"
        vars     += ", #{step}" if step isnt stepVar
        forPart   = "#{vars}; #{ivar} < #{lvar}; #{stepPart}"
    resultPart    = if rvar then "#{@tab}#{rvar} = [];\n" else ''
    returnResult  = @compileReturnValue(rvar, o)
    body          = Push.wrap(rvar, body) unless topLevel
    if @guard
      body        = Expressions.wrap([new If(@guard, body)])
    if codeInBody
      body.unshift  new Literal "var #{name} = #{ivar}" if range
      body.unshift  new Literal "var #{namePart}" if namePart
      body.unshift  new Literal "var #{index} = #{ivar}" if index
      body        = Closure.wrap(body, true)
    else
      varPart     = "#{idt}#{namePart};\n" if namePart
    if @object
      forPart     = "#{ivar} in #{sourcePart}"
      guardPart   = "#{idt}if (!#{utility 'hasProp'}.call(#{svar}, #{ivar})) continue;\n" unless @raw
    body          = body.compile merge o, indent: idt, top: true
    """
    #{resultPart}#{@tab}for (#{forPart}) {
    #{guardPart}#{varPart}#{body}
    #{@tab}}#{returnResult}
    """

#### Switch

# A JavaScript *switch* statement. Converts into a returnable expression on-demand.
exports.Switch = class Switch extends Base

  children: ['subject', 'cases', 'otherwise']

  isStatement: YES

  constructor: (@subject, @cases, @otherwise) ->
    super()
    @tags.subjectless = !@subject
    @subject or= new Literal 'true'

  makeReturn: ->
    pair[1].makeReturn() for pair in @cases
    @otherwise.makeReturn() if @otherwise
    this

  compileNode: (o) ->
    idt = o.indent = @idt 2
    o.top = yes
    code = "#{ @tab }switch (#{ @subject.compile o }) {"
    for pair in @cases
      [conditions, block] = pair
      exprs = block.expressions
      for condition in flatten [conditions]
        condition = new Op '!!', new Parens condition if @tags.subjectless
        code += "\n#{ @idt(1) }case #{ condition.compile o }:"
      code += "\n#{ block.compile o }"
      code += "\n#{ idt }break;" unless last(exprs) instanceof Return
    if @otherwise
      code += "\n#{ @idt(1) }default:\n#{ @otherwise.compile o }"
    code += "\n#{ @tab }}"
    code

#### If

# *If/else* statements. Acts as an expression by pushing down requested returns
# to the last line of each clause.
#
# Single-expression **Ifs** are compiled into conditional operators if possible,
# because ternaries are already proper expressions, and don't need conversion.
exports.If = class If extends Base

  children: ['condition', 'body', 'elseBody', 'assigner']

  topSensitive: YES

  constructor: (condition, @body, @tags) ->
    @tags or= {}
    if @tags.invert
      op = condition instanceof Op
      if op and condition.isInvertible()
        condition.invert()
      else
        condition = new Parens condition if op and not condition.isUnary()
        condition = new Op '!', condition
    @condition = condition
    @elseBody  = null
    @isChain   = false

  bodyNode: -> @body?.unwrap()
  elseBodyNode: -> @elseBody?.unwrap()

  # Rewrite a chain of **Ifs** to add a default case as the final *else*.
  addElse: (elseBody, statement) ->
    if @isChain
      @elseBodyNode().addElse elseBody, statement
    else
      @isChain = elseBody instanceof If
      @elseBody = @ensureExpressions elseBody
    this

  # The **If** only compiles into a statement if either of its bodies needs
  # to be a statement. Otherwise a conditional operator is safe.
  isStatement: (o) ->
    @statement or= !!((o and o.top) or @bodyNode().isStatement(o) or (@elseBody and @elseBodyNode().isStatement(o)))

  compileCondition: (o) ->
    conditions = flatten [@condition]
    conditions[0].parenthetical = yes if conditions.length is 1
    (cond.compile(o) for cond in conditions).join(' || ')

  compileNode: (o) ->
    if @isStatement o then @compileStatement o else @compileExpression o

  makeReturn: ->
    if @isStatement()
      @body     and= @ensureExpressions(@body.makeReturn())
      @elseBody and= @ensureExpressions(@elseBody.makeReturn())
      this
    else
      new Return this

  ensureExpressions: (node) ->
    if node instanceof Expressions then node else new Expressions [node]

  # Compile the **If** as a regular *if-else* statement. Flattened chains
  # force inner *else* bodies into statement form.
  compileStatement: (o) ->
    top      = del o, 'top'
    child    = del o, 'chainChild'
    condO    = merge o
    o.indent = @idt 1
    o.top    = true
    ifDent   = if child or (top and not @isStatement(o)) then '' else @idt()
    comDent  = if child then @idt() else ''
    body     = @body.compile(o)
    ifPart   = "#{ifDent}if (#{ @compileCondition(condO) }) {\n#{body}\n#{@tab}}"
    return ifPart unless @elseBody
    elsePart = if @isChain
      ' else ' + @elseBodyNode().compile(merge(o, {indent: @idt(), chainChild: true}))
    else
      " else {\n#{ @elseBody.compile(o) }\n#{@tab}}"
    "#{ifPart}#{elsePart}"

  # Compile the If as a conditional operator.
  compileExpression: (o) ->
    @bodyNode().tags.operation = @condition.tags.operation = yes
    @elseBodyNode().tags.operation = yes if @elseBody
    ifPart      = @condition.compile(o) + ' ? ' + @bodyNode().compile(o)
    elsePart    = if @elseBody then @elseBodyNode().compile(o) else 'undefined'
    code        = "#{ifPart} : #{elsePart}"
    if @tags.operation then "(#{code})" else code

# Faux-Nodes
# ----------
# Faux-nodes are never created by the grammar, but are used during code
# generation to generate other combinations of nodes.

#### Push

# The **Push** creates the tree for `array.push(value)`,
# which is helpful for recording the result arrays from comprehensions.
Push =
  wrap: (name, expressions) ->
    return expressions if expressions.empty() or expressions.containsPureStatement()
    Expressions.wrap [new Call(
      new Value new Literal(name), [new Accessor new Literal 'push']
      [expressions.unwrap()]
    )]

#### Closure

# A faux-node used to wrap an expressions body in a closure.
Closure =

  # Wrap the expressions body, unless it contains a pure statement,
  # in which case, no dice. If the body mentions `this` or `arguments`,
  # then make sure that the closure wrapper preserves the original values.
  wrap: (expressions, statement) ->
    return expressions if expressions.containsPureStatement()
    func = new Parens new Code [], Expressions.wrap [expressions]
    args = []
    if (mentionsArgs = expressions.contains @literalArgs) or
       (               expressions.contains @literalThis)
      meth = new Literal if mentionsArgs then 'apply' else 'call'
      args = [new Literal 'this']
      args.push new Literal 'arguments' if mentionsArgs
      func = new Value func, [new Accessor meth]
    call = new Call func, args
    if statement then Expressions.wrap [call] else call

  literalArgs: (node) -> node instanceof Literal and node.value is 'arguments'
  literalThis: (node) -> node instanceof Literal and node.value is 'this' or
                         node instanceof Code    and node.bound

# Constants
# ---------

UTILITIES =

  # Correctly set up a prototype chain for inheritance, including a reference
  # to the superclass for `super()` calls. See:
  # [goog.inherits](http://closure-library.googlecode.com/svn/docs/closureGoogBase.js.source.html#line1206).
  extends:  '''
    function(child, parent) {
      var ctor = function() {};
      ctor.prototype = parent.prototype;
      child.prototype = new ctor();
      child.prototype.constructor = child;
      if (typeof parent.extended === "function") parent.extended(child);
      child.__super__ = parent.prototype;
    }
  '''

  # Create a function bound to the current value of "this".
  bind: '''
    function(func, context) {
      return function() { return func.apply(context, arguments); };
    }
  '''

  # Shortcuts to speed up the lookup time for native functions.
  hasProp: 'Object.prototype.hasOwnProperty'
  slice:   'Array.prototype.slice'

# Tabs are two spaces for pretty printing.
TAB = '  '

# Trim out all trailing whitespace, so that the generated code plays nice
# with Git.
TRAILING_WHITESPACE = /[ \t]+$/gm

IDENTIFIER = /^[$A-Za-z_][$\w]*$/
NUMBER     = /^0x[\da-f]+|^(?:\d+(\.\d+)?|\.\d+)(?:e[+-]?\d+)?$/i

# Is a literal value a string?
IS_STRING = /^['"]/

# Utility Functions
# -----------------

# Helper for ensuring that utility functions are assigned at the top level.
utility = (name) ->
  ref = "__#{name}"
  Scope.root.assign ref, UTILITIES[name]
  ref
