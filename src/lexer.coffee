# The CoffeeScript Lexer. Uses a series of token-matching regexes to attempt
# matches against the beginning of the source code. When a match is found,
# a token is produced, we consume the match, and start again. Tokens are in the
# form:
#
#     [tag, value, lineNumber]
#
# Which is a format that can be fed directly into [Jison](http://github.com/zaach/jison).

{Rewriter} = require './rewriter'

# Import the helpers we need.
{count, starts, compact, last} = require './helpers'

# The Lexer Class
# ---------------

# The Lexer class reads a stream of CoffeeScript and divvys it up into tagged
# tokens. Some potential ambiguity in the grammar has been avoided by
# pushing some extra smarts into the Lexer.
exports.Lexer = class Lexer

  # **tokenize** is the Lexer's main method. Scan by attempting to match tokens
  # one at a time, using a regular expression anchored at the start of the
  # remaining code, or a custom recursive token-matching method
  # (for interpolations). When the next token has been recorded, we move forward
  # within the code past the token, and begin again.
  #
  # Each tokenizing method is responsible for returning the number of characters
  # it has consumed.
  #
  # Before returning the token stream, run it through the [Rewriter](rewriter.html)
  # unless explicitly asked not to.
  tokenize: (code, options) ->
    code     = code.replace(/\r/g, '').replace TRAILING_SPACES, ''
    o        = options or {}
    @code    = code         # The remainder of the source code.
    @line    = o.line or 0  # The current line.
    @indent  = 0            # The current indentation level.
    @indebt  = 0            # The over-indentation at the current level.
    @outdebt = 0            # The under-outdentation at the current level.
    @indents = []           # The stack of all current indentation levels.
    @tokens  = []           # Stream of parsed tokens in the form ['TYPE', value, line]
    # Flags for distinguishing FORIN/FOROF/FROM/TO.
    @seenFor = @seenFrom = no
    # At every position, run through this list of attempted matches,
    # short-circuiting if any of them succeed. Their order determines precedence:
    # `@literalToken` is the fallback catch-all.
    i = 0
    while @chunk = code.slice i
      i += @identifierToken() or
           @commentToken()    or
           @whitespaceToken() or
           @lineToken()       or
           @heredocToken()    or
           @stringToken()     or
           @numberToken()     or
           @regexToken()      or
           @jsToken()         or
           @literalToken()
    @closeIndentation()
    return @tokens if o.rewrite is off
    (new Rewriter).rewrite @tokens

  # Tokenizers
  # ----------

  # Matches identifying literals: variables, keywords, method names, etc.
  # Check to ensure that JavaScript reserved words aren't being used as
  # identifiers. Because CoffeeScript reserves a handful of keywords that are
  # allowed in JavaScript, we're careful not to tag them as keywords when
  # referenced as property names here, so you can still do `jQuery.is()` even
  # though `is` means `===` otherwise.
  identifierToken: ->
    return 0 unless match = IDENTIFIER.exec @chunk
    [input, id, colon] = match
    if id is 'all' and @tag() is 'FOR'
      @token 'ALL', id
      return id.length
    if id is 'from' and @tag(1) is 'FOR'
      @seenFor  = no
      @seenFrom = yes
      @token 'FROM', id
      return id.length
    if id is 'to' and @seenFrom
      @seenFrom = no
      @token 'TO', id
      return id.length
    forcedIdentifier = colon or
      (prev = last @tokens) and not prev.spaced and prev[0] in ['.', '?.', '@', '::']
    tag = 'IDENTIFIER'
    if id in JS_KEYWORDS or
       not forcedIdentifier and id in COFFEE_KEYWORDS
      tag = id.toUpperCase()
      if tag is 'WHEN' and @tag() in LINE_BREAK
        tag = 'LEADING_WHEN'
      else if tag is 'FOR'
        @seenFor = yes
      else if tag in UNARY
        tag = 'UNARY'
      else if tag in RELATION
        if tag isnt 'INSTANCEOF' and @seenFor
          @seenFor = no
          tag = 'FOR' + tag
        else
          tag = 'RELATION'
          if @value() is '!'
            @tokens.pop()
            id = '!' + id
    if id in JS_FORBIDDEN
      if forcedIdentifier
        tag = 'IDENTIFIER'
        id  = new String id
        id.reserved = yes
      else if id in RESERVED
        @identifierError id
    unless forcedIdentifier
      id  = COFFEE_ALIASES[id] if COFFEE_ALIASES.hasOwnProperty id
      tag = if id is '!'                       then 'UNARY'
      else  if id in ['==', '!=']              then 'COMPARE'
      else  if id in ['&&', '||']              then 'LOGIC'
      else  if id in ['true', 'false', 'null'] then 'BOOL'
      else  tag
    @token tag, id
    @token ':', ':' if colon
    input.length

  # Matches numbers, including decimals, hex, and exponential notation.
  # Be careful not to interfere with ranges-in-progress.
  numberToken: ->
    return 0 unless match = NUMBER.exec @chunk
    number = match[0]
    @token 'NUMBER', number
    number.length

  # Matches strings, including multi-line strings. Ensures that quotation marks
  # are balanced within the string's contents, and within nested interpolations.
  stringToken: ->
    switch @chunk.charAt 0
      when "'"
        return 0 unless match = SIMPLESTR.exec @chunk
        @token 'STRING', (string = match[0]).replace MULTILINER, '\\\n'
      when '"'
        return 0 unless string = @balancedString @chunk, [['"', '"'], ['#{', '}']]
        if 0 < string.indexOf '#{', 1
        then @interpolateString string.slice 1, -1
        else @token 'STRING', @escapeLines string
      else
        return 0
    @line += count string, '\n'
    string.length

  # Matches heredocs, adjusting indentation to the correct level, as heredocs
  # preserve whitespace, but ignore indentation to the left.
  heredocToken: ->
    return 0 unless match = HEREDOC.exec @chunk
    heredoc = match[0]
    quote = heredoc.charAt 0
    doc = @sanitizeHeredoc match[2], {quote, indent: null}
    if quote is '"' and 0 <= doc.indexOf '#{'
    then @interpolateString doc, heredoc: yes
    else @token 'STRING', @makeString doc, quote, yes
    @line += count heredoc, '\n'
    heredoc.length

  # Matches and consumes comments.
  commentToken: ->
    return 0 unless match = @chunk.match COMMENT
    [comment, here] = match
    @line += count comment, '\n'
    if here
      @token 'HERECOMMENT', @sanitizeHeredoc here,
        herecomment: true, indent: Array(@indent + 1).join(' ')
      @token 'TERMINATOR', '\n'
    comment.length

  # Matches JavaScript interpolated directly into the source via backticks.
  jsToken: ->
    return 0 unless @chunk.charAt(0) is '`' and match = JSTOKEN.exec @chunk
    @token 'JS', (script = match[0]).slice 1, -1
    script.length

  # Matches regular expression literals. Lexing regular expressions is difficult
  # to distinguish from division, so we borrow some basic heuristics from
  # JavaScript and Ruby.
  regexToken: ->
    return 0 if @chunk.charAt(0) isnt '/'
    return @heregexToken match if match = HEREGEX.exec @chunk
    return 0 if @tag() in NOT_REGEX
    return 0 unless match = REGEX.exec @chunk
    [regex] = match
    @token 'REGEX', if regex is '//' then '/(?:)/' else regex
    regex.length

  # Matches experimental, multiline and extended regular expression literals.
  heregexToken: (match) ->
    [heregex, body, flags] = match
    if 0 > body.indexOf '#{'
      re = body.replace(HEREGEX_OMIT, '').replace(/\//g, '\\/')
      @token 'REGEX', "/#{ re or '(?:)' }/#{flags}"
      return heregex.length
    @token 'IDENTIFIER', 'RegExp'
    @tokens.push ['CALL_START', '(']
    tokens = []
    for [tag, value] in @interpolateString(body, regex: yes)
      if tag is 'TOKENS'
        tokens.push value...
      else
        continue unless value = value.replace HEREGEX_OMIT, ''
        value = value.replace /\\/g, '\\\\'
        tokens.push ['STRING', @makeString(value, '"', yes)]
      tokens.push ['+', '+']
    tokens.pop()
    @tokens.push ['STRING', '""'], ['+', '+'] unless tokens[0]?[0] is 'STRING'
    @tokens.push tokens...
    @tokens.push [',', ','], ['STRING', '"' + flags + '"'] if flags
    @token ')', ')'
    heregex.length

  # Matches newlines, indents, and outdents, and determines which is which.
  # If we can detect that the current line is continued onto the the next line,
  # then the newline is suppressed:
  #
  #     elements
  #       .each( ... )
  #       .map( ... )
  #
  # Keeps track of the level of indentation, because a single outdent token
  # can close multiple indents, so we need to know how far in we happen to be.
  lineToken: ->
    return 0 unless match = MULTI_DENT.exec @chunk
    indent = match[0]
    @line += count indent, '\n'
    prev = last @tokens, 1
    size = indent.length - 1 - indent.lastIndexOf '\n'
    noNewlines = @unfinished()
    if size - @indebt is @indent
      if noNewlines then @suppressNewlines() else @newlineToken()
      return indent.length
    if size > @indent
      if noNewlines
        @indebt = size - @indent
        @suppressNewlines()
        return indent.length
      diff = size - @indent + @outdebt
      @token 'INDENT', diff
      @indents.push diff
      @outdebt = @indebt = 0
    else
      @indebt = 0
      @outdentToken @indent - size, noNewlines
    @indent = size
    indent.length

  # Record an outdent token or multiple tokens, if we happen to be moving back
  # inwards past several recorded indents.
  outdentToken: (moveOut, noNewlines, close) ->
    while moveOut > 0
      len = @indents.length - 1
      if @indents[len] is undefined
        moveOut = 0
      else if @indents[len] is @outdebt
        moveOut -= @outdebt
        @outdebt = 0
      else if @indents[len] < @outdebt
        @outdebt -= @indents[len]
        moveOut  -= @indents[len]
      else
        dent = @indents.pop() - @outdebt
        moveOut -= dent
        @outdebt = 0
        @token 'OUTDENT', dent
    @outdebt -= moveOut if dent
    @token 'TERMINATOR', '\n' unless @tag() is 'TERMINATOR' or noNewlines
    this

  # Matches and consumes non-meaningful whitespace. Tag the previous token
  # as being "spaced", because there are some cases where it makes a difference.
  whitespaceToken: ->
    return 0 unless (match = WHITESPACE.exec @chunk) or
                    (nline = @chunk.charAt(0) is '\n')
    prev = last @tokens
    prev[if match then 'spaced' else 'newLine'] = true if prev
    if match then match[0].length else 0

  # Generate a newline token. Consecutive newlines get merged together.
  newlineToken: ->
    @token 'TERMINATOR', '\n' unless @tag() is 'TERMINATOR'
    this

  # Use a `\` at a line-ending to suppress the newline.
  # The slash is removed here once its job is done.
  suppressNewlines: ->
    @tokens.pop() if @value() is '\\'
    this

  # We treat all other single characters as a token. Eg.: `( ) , . !`
  # Multi-character operators are also literal tokens, so that Jison can assign
  # the proper order of operations. There are some symbols that we tag specially
  # here. `;` and newlines are both treated as a `TERMINATOR`, we distinguish
  # parentheses that indicate a method call from regular parentheses, and so on.
  literalToken: ->
    if match = OPERATOR.exec @chunk
      [value] = match
      @tagParameters() if CODE.test value
    else
      value = @chunk.charAt 0
    tag  = value
    prev = last @tokens
    if value is '=' and prev
      @assignmentError() if not prev[1].reserved and prev[1] in JS_FORBIDDEN
      if prev[1] in ['||', '&&']
        prev[0] = 'COMPOUND_ASSIGN'
        prev[1] += '='
        return value.length
    if      value is ';'             then tag = 'TERMINATOR'
    else if value in MATH            then tag = 'MATH'
    else if value in COMPARE         then tag = 'COMPARE'
    else if value in COMPOUND_ASSIGN then tag = 'COMPOUND_ASSIGN'
    else if value in UNARY           then tag = 'UNARY'
    else if value in SHIFT           then tag = 'SHIFT'
    else if value in LOGIC or value is '?' and prev?.spaced then tag = 'LOGIC'
    else if prev and not prev.spaced
      if value is '(' and prev[0] in CALLABLE
        prev[0] = 'FUNC_EXIST' if prev[0] is '?'
        tag = 'CALL_START'
      else if value is '[' and prev[0] in INDEXABLE
        tag = 'INDEX_START'
        switch prev[0]
          when '?'  then prev[0] = 'INDEX_SOAK'
          when '::' then prev[0] = 'INDEX_PROTO'
    @token tag, value
    value.length

  # Token Manipulators
  # ------------------

  # Sanitize a heredoc or herecomment by
  # erasing all external indentation on the left-hand side.
  sanitizeHeredoc: (doc, options) ->
    {indent, herecomment} = options
    return doc if herecomment and 0 > doc.indexOf '\n'
    unless herecomment
      while match = HEREDOC_INDENT.exec doc
        attempt = match[1]
        indent = attempt if indent is null or 0 < attempt.length < indent.length
    doc = doc.replace /// \n #{indent} ///g, '\n' if indent
    doc = doc.replace /^\n/, '' unless herecomment
    doc

  # A source of ambiguity in our grammar used to be parameter lists in function
  # definitions versus argument lists in function calls. Walk backwards, tagging
  # parameters specially in order to make things easier for the parser.
  tagParameters: ->
    return this if @tag() isnt ')'
    i = @tokens.length
    while tok = @tokens[--i]
      switch tok[0]
        when 'IDENTIFIER'       then tok[0] = 'PARAM'
        when ')'                then tok[0] = 'PARAM_END'
        when '(', 'CALL_START'  then tok[0] = 'PARAM_START'; return true
    this

  # Close up all remaining open blocks at the end of the file.
  closeIndentation: ->
    @outdentToken @indent

  # The error for when you try to use a forbidden word in JavaScript as
  # an identifier.
  identifierError: (word) ->
    throw SyntaxError "Reserved word \"#{word}\" on line #{@line + 1}"

  # The error for when you try to assign to a reserved word in JavaScript,
  # like "function" or "default".
  assignmentError: ->
    throw SyntaxError "Reserved word \"#{@value()}\" on line #{@line + 1} can't be assigned"

  # Matches a balanced group such as a single or double-quoted string. Pass in
  # a series of delimiters, all of which must be nested correctly within the
  # contents of the string. This method allows us to have strings within
  # interpolations within strings, ad infinitum.
  balancedString: (str, delimited, options) ->
    options or= {}
    levels = []
    i = 0
    slen = str.length
    while i < slen
      if levels.length and str.charAt(i) is '\\'
        i += 1
      else
        for pair in delimited
          [open, close] = pair
          if levels.length and starts(str, close, i) and last(levels) is pair
            levels.pop()
            i += close.length - 1
            i += 1 unless levels.length
            break
          if starts str, open, i
            levels.push(pair)
            i += open.length - 1
            break
      break if not levels.length
      i += 1
    if levels.length
      throw SyntaxError "Unterminated #{levels.pop()[0]} starting on line #{@line + 1}"
    i and str.slice 0, i

  # Expand variables and expressions inside double-quoted strings using
  # Ruby-like notation for substitution of arbitrary expressions.
  #
  #     "Hello #{name.capitalize()}."
  #
  # If it encounters an interpolation, this method will recursively create a
  # new Lexer, tokenize the interpolated contents, and merge them into the
  # token stream.
  interpolateString: (str, options) ->
    {heredoc, regex} = options or= {}
    tokens = []
    pi = 0
    i  = -1
    while letter = str.charAt i += 1
      if letter is '\\'
        i += 1
        continue
      unless letter is '#' and str.charAt(i+1) is '{' and
             (expr = @balancedString str.slice(i+1), [['{', '}']])
        continue
      tokens.push ['TO_BE_STRING', str.slice(pi, i)] if pi < i
      inner = expr.slice(1, -1).replace(LEADING_SPACES, '').replace(TRAILING_SPACES, '')
      if inner.length
        nested = new Lexer().tokenize inner, line: @line, rewrite: off
        nested.pop()
        if nested.length > 1
          nested.unshift ['(', '(']
          nested.push    [')', ')']
        tokens.push ['TOKENS', nested]
      i += expr.length
      pi = i + 1
    tokens.push ['TO_BE_STRING', str.slice pi] if i > pi < str.length
    return tokens if regex
    return @token 'STRING', '""' unless tokens.length
    tokens.unshift ['', ''] unless tokens[0][0] is 'TO_BE_STRING'
    @token '(', '(' if interpolated = tokens.length > 1
    for [tag, value], i in tokens
      @token '+', '+' if i
      if tag is 'TOKENS'
      then @tokens.push value...
      else @token 'STRING', @makeString value, '"', heredoc
    @token ')', ')' if interpolated
    tokens

  # Helpers
  # -------

  # Add a token to the results, taking note of the line number.
  token: (tag, value) ->
    @tokens.push [tag, value, @line]

  # Peek at a tag/value in the current token stream.
  tag  : (index, tag) ->
    (tok = last @tokens, index) and if tag? then tok[0] = tag else tok[0]
  value: (index, val) ->
    (tok = last @tokens, index) and if val? then tok[1] = val else tok[1]

  # Are we in the midst of an unfinished expression?
  unfinished: ->
    LINE_CONTINUER.test(@chunk) or
    (prev = last @tokens, 1) and prev[0] isnt '.' and
      (value = @value()) and not value.reserved and
      NO_NEWLINE.test(value) and not CODE.test(value) and not ASSIGNED.test(@chunk)

  # Converts newlines for string literals.
  escapeLines: (str, heredoc) ->
    str.replace MULTILINER, if heredoc then '\\n' else ''

  # Constructs a string token by escaping quotes and newlines.
  makeString: (body, quote, heredoc) ->
    return quote + quote unless body
    body = body.replace /\\([\s\S])/g, (match, contents) ->
      if contents in ['\n', quote] then contents else match
    body = body.replace /// #{quote} ///g, '\\$&'
    quote + @escapeLines(body, heredoc) + quote

# Constants
# ---------

# Keywords that CoffeeScript shares in common with JavaScript.
JS_KEYWORDS = [
  'true', 'false', 'null', 'this'
  'new', 'delete', 'typeof', 'in', 'instanceof'
  'return', 'throw', 'break', 'continue', 'debugger'
  'if', 'else', 'switch', 'for', 'while', 'try', 'catch', 'finally'
  'class', 'extends', 'super'
]

# CoffeeScript-only keywords.
COFFEE_KEYWORDS = ['then', 'unless', 'until', 'loop', 'of', 'by', 'when']
COFFEE_KEYWORDS.push op for all op of COFFEE_ALIASES =
  and  : '&&'
  or   : '||'
  is   : '=='
  isnt : '!='
  not  : '!'
  yes  : 'true'
  no   : 'false'
  on   : 'true'
  off  : 'false'

# The list of keywords that are reserved by JavaScript, but not used, or are
# used by CoffeeScript internally. We throw an error when these are encountered,
# to avoid having a JavaScript error at runtime.
RESERVED = [
  'case', 'default', 'function', 'var', 'void', 'with', 'do'
  'const', 'let', 'enum', 'export', 'import', 'native'
  '__hasProp', '__extends', '__slice'
]

# The superset of both JavaScript keywords and reserved words, none of which may
# be used as identifiers or properties.
JS_FORBIDDEN = JS_KEYWORDS.concat RESERVED

# Token matching regexes.
IDENTIFIER = /// ^
  ( [$A-Za-z_][$\w]* )
  ( [^\n\S]* : (?!:) )?  # Is this a property name?
///
NUMBER     = /^0x[\da-f]+|^(?:\d+(\.\d+)?|\.\d+)(?:e[+-]?\d+)?/i
HEREDOC    = /^("""|''')([\s\S]*?)(?:\n[ \t]*)?\1/
OPERATOR   = /// ^ (
  ?: [-=]>             # function
   | [-+*/%<>&|^!?=]=  # compound assign / compare
   | >>>=?             # zero-fill right shift
   | ([-+:])\1         # doubles
   | ([&|<>])\2=?      # logic / shift
   | \?\.              # soak access
   | \.{3}             # splat
) ///
WHITESPACE = /^[ \t]+/
COMMENT    = /^###([^#][\s\S]*?)(?:###[ \t]*\n|(?:###)?$)|^(?:\s*#(?!##[^#]).*)+/
CODE       = /^[-=]>/
MULTI_DENT = /^(?:\n[ \t]*)+/
SIMPLESTR  = /^'[^\\']*(?:\\.[^\\']*)*'/
JSTOKEN    = /^`[^\\`]*(?:\\.[^\\`]*)*`/

# Regex-matching-regexes.
REGEX = /// ^
  / (?! \s )       # disallow leading whitespace
  [^ [ / \n \\ ]*  # every other thing
  (?:
    (?: \\[\s\S]   # anything escaped
      | \[         # character class
           [^ \] \n \\ ]*
           (?: \\[\s\S] [^ \] \n \\ ]* )*
         ]
    ) [^ [ / \n \\ ]*
  )*
  / [imgy]{0,4} (?![A-Za-z])
///
HEREGEX      = /^\/{3}([\s\S]+?)\/{3}([imgy]{0,4})(?![A-Za-z])/
HEREGEX_OMIT = /\s+(?:#.*)?/g

# Token cleaning regexes.
MULTILINER      = /\n/g
HEREDOC_INDENT  = /\n+([ \t]*)/g
ASSIGNED        = /^\s*@?[$A-Za-z_][$\w]*[ \t]*?[:=][^:=>]/
LINE_CONTINUER  = /// ^ \s* (?: , | \??\.(?!\.) | :: ) ///
LEADING_SPACES  = /^\s+/
TRAILING_SPACES = /\s+$/
NO_NEWLINE      = /// ^ (?:            # non-capturing group
  [-+*&|/%=<>!.\\][<>=&|]* |           # symbol operators
  and | or | is(?:nt)? | n(?:ot|ew) |  # word operators
  delete | typeof | instanceof
) $ ///

# Compound assignment tokens.
COMPOUND_ASSIGN = [
  '-=', '+=', '/=', '*=', '%=', '||=', '&&=', '?=', '<<=', '>>=', '>>>=', '&=', '^=', '|='
]

# Unary tokens.
UNARY   = ['!', '~', 'NEW', 'TYPEOF', 'DELETE']

# Logical tokens.
LOGIC   = ['&&', '||', '&', '|', '^']

# Bit-shifting tokens.
SHIFT   = ['<<', '>>', '>>>']

# Comparison tokens.
COMPARE = ['==', '!=', '<', '>', '<=', '>=']

# Mathmatical tokens.
MATH    = ['*', '/', '%']

# Relational tokens that are negatable with `not` prefix.
RELATION = ['IN', 'OF', 'INSTANCEOF']

# Boolean tokens.
BOOL = ['TRUE', 'FALSE', 'NULL']

# Tokens which a regular expression will never immediately follow, but which
# a division operator might.
#
# See: http://www.mozilla.org/js/language/js20-2002-04/rationale/syntax.html#regular-expressions
#
# Our list is shorter, due to sans-parentheses method calls.
NOT_REGEX = ['NUMBER', 'REGEX', 'BOOL', '++', '--', ']']

# Tokens which could legitimately be invoked or indexed. A opening
# parentheses or bracket following these tokens will be recorded as the start
# of a function invocation or indexing operation.
CALLABLE  = ['IDENTIFIER', 'STRING', 'REGEX', ')', ']', '}', '?', '::', '@', 'THIS', 'SUPER']
INDEXABLE = CALLABLE.concat 'NUMBER', 'BOOL'

# Tokens that, when immediately preceding a `WHEN`, indicate that the `WHEN`
# occurs at the start of a line. We disambiguate these from trailing whens to
# avoid an ambiguity in the grammar.
LINE_BREAK = ['INDENT', 'OUTDENT', 'TERMINATOR']
