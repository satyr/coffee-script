(function() {
  var Parser, _i, _j, _len, _len2, _ref, _result, alt, alternatives, grammar, name, o, operators, token, tokens, unwrap;
  Parser = require('jison').Parser;
  unwrap = /^function\s*\(\)\s*\{\s*return\s*([\s\S]*);\s*\}/;
  o = function(patternString, action, options) {
    var match;
    patternString = patternString.replace(/\s{2,}/g, ' ');
    if (!action) {
      return [patternString, '$$ = $1;', options];
    }
    action = (match = unwrap.exec(action)) ? match[1] : "(" + action + "())";
    action = action.replace(/\bnew /g, '$&yy.');
    action = action.replace(/\b(?:Expressions\.wrap|extend)\b/g, 'yy.$&');
    return [patternString, "$$ = " + action + ";", options];
  };
  grammar = {
    Root: [
      o('', function() {
        return new Expressions;
      }), o('TERMINATOR', function() {
        return new Expressions;
      }), o('Body'), o('Block TERMINATOR')
    ],
    Body: [
      o('Line', function() {
        return Expressions.wrap([$1]);
      }), o('Body TERMINATOR Line', function() {
        return $1.push($3);
      }), o('Body TERMINATOR')
    ],
    Line: [o('Expression'), o('Statement')],
    Statement: [
      o('Return'), o('Throw'), o('BREAK', function() {
        return new Literal($1);
      }), o('CONTINUE', function() {
        return new Literal($1);
      }), o('DEBUGGER', function() {
        return new Literal($1);
      })
    ],
    Expression: [o('Value'), o('Invocation'), o('Code'), o('Operation'), o('Assign'), o('If'), o('Try'), o('While'), o('For'), o('Switch'), o('Extends'), o('Class'), o('Comment')],
    Block: [
      o('INDENT Body OUTDENT', function() {
        return $2;
      }), o('INDENT OUTDENT', function() {
        return new Expressions;
      }), o('TERMINATOR Comment', function() {
        return Expressions.wrap([$2]);
      })
    ],
    Identifier: [
      o('IDENTIFIER', function() {
        return new Literal($1);
      })
    ],
    AlphaNumeric: [
      o('NUMBER', function() {
        return new Literal($1);
      }), o('STRING', function() {
        return new Literal($1);
      })
    ],
    Literal: [
      o('AlphaNumeric'), o('JS', function() {
        return new Literal($1);
      }), o('REGEX', function() {
        return new Literal($1);
      }), o('BOOL', function() {
        return new Literal($1);
      })
    ],
    Assign: [
      o('Assignable = Expression', function() {
        return new Assign($1, $3);
      }), o('Assignable = INDENT Expression OUTDENT', function() {
        return new Assign($1, $4);
      })
    ],
    AssignObj: [
      o('ObjAssignable', function() {
        return new Value($1);
      }), o('ObjAssignable : Expression', function() {
        return new Assign(new Value($1), $3, 'object');
      }), o('ObjAssignable :\
       INDENT Expression OUTDENT', function() {
        return new Assign(new Value($1), $4, 'object');
      }), o('ThisProperty'), o('Comment')
    ],
    ObjAssignable: [o('Identifier'), o('AlphaNumeric'), o('Parenthetical')],
    Return: [
      o('RETURN Expression', function() {
        return new Return($2);
      }), o('RETURN', function() {
        return new Return;
      })
    ],
    Comment: [
      o('HERECOMMENT', function() {
        return new Comment($1);
      })
    ],
    Code: [
      o('PARAM_START ParamList PARAM_END FuncGlyph Block', function() {
        return new Code($2, $5, $4);
      }), o('FuncGlyph Block', function() {
        return new Code([], $2, $1);
      })
    ],
    FuncGlyph: [
      o('->', function() {
        return 'func';
      }), o('=>', function() {
        return 'boundfunc';
      })
    ],
    OptComma: [o(''), o(',')],
    ParamList: [
      o('', function() {
        return [];
      }), o('Param', function() {
        return [$1];
      }), o('ParamList , Param', function() {
        return $1.concat($3);
      })
    ],
    Param: [
      o('PARAM', function() {
        return new Literal($1);
      }), o('PARAM ...', function() {
        return new Param($1, false, true);
      }), o('@ PARAM', function() {
        return new Param($2, true);
      }), o('@ PARAM ...', function() {
        return new Param($2, true, true);
      })
    ],
    Splat: [
      o('Expression ...', function() {
        return new Splat($1);
      })
    ],
    SimpleAssignable: [
      o('Identifier', function() {
        return new Value($1);
      }), o('Value Accessor', function() {
        return $1.push($2);
      }), o('Invocation Accessor', function() {
        return new Value($1, [$2]);
      }), o('ThisProperty')
    ],
    Assignable: [
      o('SimpleAssignable'), o('Array', function() {
        return new Value($1);
      }), o('Object', function() {
        return new Value($1);
      })
    ],
    Value: [
      o('Assignable'), o('Literal', function() {
        return new Value($1);
      }), o('Parenthetical', function() {
        return new Value($1);
      }), o('This')
    ],
    Accessor: [
      o('.  Identifier', function() {
        return new Accessor($2);
      }), o('?. Identifier', function() {
        return new Accessor($2, 'soak');
      }), o(':: Identifier', function() {
        return new Accessor($2, 'proto');
      }), o('::', function() {
        return new Accessor(new Literal('prototype'));
      }), o('Index')
    ],
    Index: [
      o('INDEX_START Expression INDEX_END', function() {
        return new Index($2);
      }), o('INDEX_SOAK  Index', function() {
        return extend($2, {
          soak: true
        });
      }), o('INDEX_PROTO Index', function() {
        return extend($2, {
          proto: true
        });
      })
    ],
    Object: [
      o('{ AssignList OptComma }', function() {
        return new Obj($2);
      })
    ],
    AssignList: [
      o('', function() {
        return [];
      }), o('AssignObj', function() {
        return [$1];
      }), o('AssignList , AssignObj', function() {
        return $1.concat($3);
      }), o('AssignList OptComma TERMINATOR AssignObj', function() {
        return $1.concat($4);
      }), o('AssignList OptComma INDENT AssignList OptComma OUTDENT', function() {
        return $1.concat($4);
      })
    ],
    Class: [
      o('CLASS SimpleAssignable', function() {
        return new Class($2);
      }), o('CLASS SimpleAssignable EXTENDS Value', function() {
        return new Class($2, $4);
      }), o('CLASS SimpleAssignable\
       INDENT ClassBody OUTDENT', function() {
        return new Class($2, null, $4);
      }), o('CLASS SimpleAssignable EXTENDS Value\
       INDENT ClassBody OUTDENT', function() {
        return new Class($2, $4, $6);
      }), o('CLASS INDENT ClassBody OUTDENT', function() {
        return new Class(null, null, $3);
      }), o('CLASS', function() {
        return new Class(null, null, new Expressions);
      }), o('CLASS EXTENDS Value', function() {
        return new Class(null, $3, new Expressions);
      }), o('CLASS EXTENDS Value\
       INDENT ClassBody OUTDENT', function() {
        return new Class(null, $3, $5);
      })
    ],
    ClassAssign: [
      o('AssignObj', function() {
        return $1;
      }), o('ThisProperty : Expression', function() {
        return new Assign(new Value($1), $3, 'this');
      }), o('ThisProperty : INDENT Expression OUTDENT', function() {
        return new Assign(new Value($1), $4, 'this');
      })
    ],
    ClassBody: [
      o('', function() {
        return [];
      }), o('ClassAssign', function() {
        return [$1];
      }), o('ClassBody TERMINATOR ClassAssign', function() {
        return $1.concat($3);
      }), o('{ ClassBody }', function() {
        return $2;
      })
    ],
    Extends: [
      o('SimpleAssignable EXTENDS Value', function() {
        return new Extends($1, $3);
      })
    ],
    Invocation: [
      o('Value OptFuncExist Arguments', function() {
        return new Call($1, $3, $2);
      }), o('Invocation OptFuncExist Arguments', function() {
        return new Call($1, $3, $2);
      }), o('SUPER', function() {
        return new Call('super', [new Splat(new Literal('arguments'))]);
      }), o('SUPER Arguments', function() {
        return new Call('super', $2);
      })
    ],
    OptFuncExist: [
      o('', function() {
        return false;
      }), o('FUNC_EXIST', function() {
        return true;
      })
    ],
    Arguments: [
      o('CALL_START CALL_END', function() {
        return [];
      }), o('CALL_START ArgList OptComma CALL_END', function() {
        return $2;
      })
    ],
    This: [
      o('THIS', function() {
        return new Value(new Literal('this'));
      }), o('@', function() {
        return new Value(new Literal('this'));
      })
    ],
    ThisProperty: [
      o('@ Identifier', function() {
        return new Value(new Literal('this'), [new Accessor($2)], 'this');
      })
    ],
    Array: [
      o('[ ]', function() {
        return new Arr([]);
      }), o('[ ArgList OptComma ]', function() {
        return new Arr($2);
      })
    ],
    ArgList: [
      o('Arg', function() {
        return [$1];
      }), o('ArgList , Arg', function() {
        return $1.concat($3);
      }), o('ArgList OptComma TERMINATOR Arg', function() {
        return $1.concat($4);
      }), o('INDENT ArgList OptComma OUTDENT', function() {
        return $2;
      }), o('ArgList OptComma INDENT ArgList OptComma OUTDENT', function() {
        return $1.concat($4);
      })
    ],
    Arg: [o('Expression'), o('Splat')],
    SimpleArgs: [
      o('Expression'), o('SimpleArgs , Expression', function() {
        return [].concat($1, $3);
      })
    ],
    Try: [
      o('TRY Block', function() {
        return new Try($2);
      }), o('TRY Block Catch', function() {
        return new Try($2, $3[0], $3[1]);
      }), o('TRY Block FINALLY Block', function() {
        return new Try($2, null, null, $4);
      }), o('TRY Block Catch FINALLY Block', function() {
        return new Try($2, $3[0], $3[1], $5);
      })
    ],
    Catch: [
      o('CATCH Identifier Block', function() {
        return [$2, $3];
      })
    ],
    Throw: [
      o('THROW Expression', function() {
        return new Throw($2);
      })
    ],
    Parenthetical: [
      o('( Expression )', function() {
        return new Parens($2);
      })
    ],
    WhileSource: [
      o('WHILE Expression', function() {
        return new While($2);
      }), o('WHILE Expression WHEN Expression', function() {
        return new While($2, {
          guard: $4
        });
      }), o('UNTIL Expression', function() {
        return new While($2, {
          invert: true
        });
      }), o('UNTIL Expression WHEN Expression', function() {
        return new While($2, {
          invert: true,
          guard: $4
        });
      })
    ],
    While: [
      o('WhileSource Block', function() {
        return $1.addBody($2);
      }), o('Statement  WhileSource', function() {
        return $2.addBody(Expressions.wrap([$1]));
      }), o('Expression WhileSource', function() {
        return $2.addBody(Expressions.wrap([$1]));
      }), o('Loop', function() {
        return $1;
      })
    ],
    Loop: [
      o('LOOP Block', function() {
        return new While(new Literal('true')).addBody($2);
      }), o('LOOP Expression', function() {
        return new While(new Literal('true')).addBody(Expressions.wrap([$2]));
      })
    ],
    For: [
      o('Statement  ForBody', function() {
        return new For($1, $2);
      }), o('Expression ForBody', function() {
        return new For($1, $2);
      }), o('ForBody    Block', function() {
        return new For($2, $1);
      })
    ],
    ForValue: [
      o('Identifier'), o('Array', function() {
        return new Value($1);
      }), o('Object', function() {
        return new Value($1);
      })
    ],
    ForIn: [
      o('FORIN Expression', function() {
        return {
          source: $2
        };
      }), o('FORIN Expression WHEN Expression', function() {
        return {
          source: $2,
          guard: $4
        };
      }), o('FORIN Expression BY Expression', function() {
        return {
          source: $2,
          step: $4
        };
      }), o('FORIN Expression BY Expression WHEN Expression', function() {
        return {
          source: $2,
          step: $4,
          guard: $6
        };
      })
    ],
    ForOf: [
      o('FOROF Expression', function() {
        return {
          object: true,
          source: $2
        };
      }), o('FOROF Expression WHEN Expression', function() {
        return {
          object: true,
          source: $2,
          guard: $4
        };
      })
    ],
    ForTo: [
      o('TO Expression', function() {
        return {
          to: $2
        };
      }), o('TO Expression WHEN Expression', function() {
        return {
          to: $2,
          guard: $4
        };
      }), o('TO Expression BY Expression', function() {
        return {
          to: $2,
          step: $4
        };
      }), o('TO Expression BY Expression WHEN Expression', function() {
        return {
          to: $2,
          step: $4,
          guard: $6
        };
      })
    ],
    ForBody: [
      o('FOR ForValue ForIn', function() {
        return extend($3, {
          name: $2
        });
      }), o('FOR ForValue , Identifier ForIn', function() {
        return extend($5, {
          name: $2,
          index: $4
        });
      }), o('FOR Identifier ForOf', function() {
        return extend($3, {
          index: $2
        });
      }), o('FOR ForValue , ForValue ForOf', function() {
        return extend($5, {
          index: $2,
          name: $4
        });
      }), o('FOR ALL Identifier ForOf', function() {
        return extend($4, {
          raw: true,
          index: $3
        });
      }), o('FOR ALL Identifier , ForValue ForOf', function() {
        return extend($6, {
          raw: true,
          index: $3,
          name: $5
        });
      }), o('FOR Identifier FROM Expression ForTo', function() {
        return extend($5, {
          index: $2,
          from: $4
        });
      })
    ],
    Switch: [
      o('SWITCH Expression INDENT Whens OUTDENT', function() {
        return new Switch($2, $4);
      }), o('SWITCH Expression INDENT Whens ELSE Block OUTDENT', function() {
        return new Switch($2, $4, $6);
      }), o('SWITCH INDENT Whens OUTDENT', function() {
        return new Switch(null, $3);
      }), o('SWITCH INDENT Whens ELSE Block OUTDENT', function() {
        return new Switch(null, $3, $5);
      })
    ],
    Whens: [
      o('When'), o('Whens When', function() {
        return $1.concat($2);
      })
    ],
    When: [
      o('LEADING_WHEN SimpleArgs Block', function() {
        return [[$2, $3]];
      }), o('LEADING_WHEN SimpleArgs Block TERMINATOR', function() {
        return [[$2, $3]];
      })
    ],
    IfBlock: [
      o('IF Expression Block', function() {
        return new If($2, $3);
      }), o('UNLESS Expression Block', function() {
        return new If($2, $3, {
          invert: true
        });
      }), o('IfBlock ELSE IF Expression Block', function() {
        return $1.addElse(new If($4, $5));
      }), o('IfBlock ELSE Block', function() {
        return $1.addElse($3);
      })
    ],
    If: [
      o('IfBlock'), o('Statement  POST_IF Expression', function() {
        return new If($3, Expressions.wrap([$1]), {
          statement: true
        });
      }), o('Expression POST_IF Expression', function() {
        return new If($3, Expressions.wrap([$1]), {
          statement: true
        });
      }), o('Statement  POST_UNLESS Expression', function() {
        return new If($3, Expressions.wrap([$1]), {
          statement: true,
          invert: true
        });
      }), o('Expression POST_UNLESS Expression', function() {
        return new If($3, Expressions.wrap([$1]), {
          statement: true,
          invert: true
        });
      })
    ],
    Operation: [
      o('UNARY Expression', function() {
        return new Op($1, $2);
      }), o('-     Expression', (function() {
        return new Op('-', $2);
      }), {
        prec: 'UNARY'
      }), o('+     Expression', (function() {
        return new Op('+', $2);
      }), {
        prec: 'UNARY'
      }), o('-- SimpleAssignable', function() {
        return new Op('--', $2);
      }), o('++ SimpleAssignable', function() {
        return new Op('++', $2);
      }), o('SimpleAssignable --', function() {
        return new Op('--', $1, null, true);
      }), o('SimpleAssignable ++', function() {
        return new Op('++', $1, null, true);
      }), o('Expression ?', function() {
        return new Existence($1);
      }), o('Expression +  Expression', function() {
        return new Op('+', $1, $3);
      }), o('Expression -  Expression', function() {
        return new Op('-', $1, $3);
      }), o('Expression MATH     Expression', function() {
        return new Op($2, $1, $3);
      }), o('Expression SHIFT    Expression', function() {
        return new Op($2, $1, $3);
      }), o('Expression COMPARE  Expression', function() {
        return new Op($2, $1, $3);
      }), o('Expression LOGIC    Expression', function() {
        return new Op($2, $1, $3);
      }), o('Expression RELATION Expression', function() {
        return $2.charAt(0) === '!' ? new Op($2.slice(1), $1, $3).invert() : new Op($2, $1, $3);
      }), o('SimpleAssignable COMPOUND_ASSIGN\
       Expression', function() {
        return new Assign($1, $3, $2);
      }), o('SimpleAssignable COMPOUND_ASSIGN\
       INDENT Expression OUTDENT', function() {
        return new Assign($1, $4, $2);
      })
    ]
  };
  operators = [['left', '.', '?.', '::'], ['left', 'CALL_START', 'CALL_END'], ['nonassoc', '++', '--'], ['left', '?'], ['right', 'UNARY'], ['left', 'MATH'], ['left', '+', '-'], ['left', 'SHIFT'], ['left', 'RELATION'], ['left', 'COMPARE'], ['left', 'LOGIC'], ['nonassoc', 'INDENT', 'OUTDENT'], ['right', '=', ':', 'COMPOUND_ASSIGN', 'RETURN'], ['right', 'WHEN', 'LEADING_WHEN', 'FORIN', 'FOROF', 'FROM', 'TO', 'BY', 'THROW', 'IF', 'UNLESS', 'ELSE', 'FOR', 'WHILE', 'UNTIL', 'LOOP', 'SUPER', 'CLASS', 'EXTENDS'], ['right', 'POST_IF', 'POST_UNLESS']];
  tokens = [];
  for (name in grammar) {
    alternatives = grammar[name];
    grammar[name] = (function() {
      _result = [];
      for (_i = 0, _len = alternatives.length; _i < _len; _i++) {
        alt = alternatives[_i];
        _ref = alt[0].split(' ');
        for (_j = 0, _len2 = _ref.length; _j < _len2; _j++) {
          token = _ref[_j];
          if (!grammar[token]) {
            tokens.push(token);
          }
        }
        if (name === 'Root') {
          alt[1] = "return " + alt[1];
        }
        _result.push(alt);
      }
      return _result;
    })();
  }
  exports.parser = new Parser({
    tokens: tokens.join(' '),
    bnf: grammar,
    operators: operators.reverse(),
    startSymbol: 'Root'
  });
}).call(this);
