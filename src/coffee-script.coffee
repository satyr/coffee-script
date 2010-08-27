# CoffeeScript can be used both on the server, as a command-line compiler based
# on Node.js/V8, or to run CoffeeScripts directly in the browser. This module
# contains the main entry functions for tokenzing, parsing, and compiling source
# CoffeeScript into JavaScript.
#
# If included on a webpage, it will automatically sniff out, compile, and
# execute all scripts present in `text/coffeescript` tags.

path      = require 'path'
{Lexer}   = require './lexer'
{parser}  = require './parser'
{helpers} = require './helpers'
if require.registerExtension
  require.registerExtension '.coffee', (content) -> compile content

# The current CoffeeScript version number.
exports.VERSION = '0.9.2'

# Instantiate a Lexer for our use here.
lexer = new Lexer

# Compile a string of CoffeeScript code to JavaScript, using the Coffee/Jison
# compiler.
exports.compile = compile = (code, options) ->
  options or= {}
  try
    (parser.parse lexer.tokenize code).compile options
  catch err
    err.message = "In #{options.fileName}, #{err.message}" if options.fileName
    throw err

# Tokenize a string of CoffeeScript code, and return the array of tokens.
exports.tokens = (code) ->
  lexer.tokenize code

# Tokenize and parse a string of CoffeeScript code, and return the AST. You can
# then compile it by calling `.compile()` on the root, or traverse it by using
# `.traverse()` with a callback.
exports.nodes = (code) ->
  parser.parse lexer.tokenize code

# Compile and execute a string of CoffeeScript (on the server), correctly
# setting `__filename`, `__dirname`, and relative `require()`.
exports.run = ((code, options) ->
  module.filename = __filename = options.fileName
  __dirname = path.dirname __filename
  eval exports.compile code, options
)

# The real Lexer produces a generic stream of tokens. This object provides a
# thin wrapper around it, compatible with the Jison API. We can then pass it
# directly as a "Jison lexer".
parser.lexer =
  lex: ->
    token = @tokens[@pos] or [""]
    @pos += 1
    this.yylineno = token[2]
    this.yytext   = token[1]
    token[0]
  setInput: (tokens) ->
    @tokens = tokens
    @pos    = 0
  upcomingInput: -> ""

parser.yy = require './nodes'

# Activate CoffeeScript in the browser by having it compile and evaluate
# all script tags with a content-type of `text/coffeescript`.
# This happens on page load.
if document?.getElementsByTagName
  grind = (coffee) ->
    setTimeout exports.compile coffee
  grindRemote = (url) ->
    xhr = new (window.ActiveXObject or XMLHttpRequest)('Microsoft.XMLHTTP')
    xhr.open 'GET', url, true
    xhr.overrideMimeType 'text/plain' if 'overrideMimeType' of xhr
    xhr.onreadystatechange = ->
      grind xhr.responseText if xhr.readyState is 4
    xhr.send null
  processScripts = ->
    for script in document.getElementsByTagName 'script'
      if script.type is 'text/coffeescript'
        if script.src
          grindRemote script.src
        else
          grind script.innerHTML
    null
  if window.addEventListener
    addEventListener 'DOMContentLoaded', processScripts, false
  else
    attachEvent 'onload', processScripts
