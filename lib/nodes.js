(function() {
  var Accessor, ArrayLiteral, Assign, Base, Call, Class, Closure, Code, Comment, Existence, Expressions, Extends, For, IDENTIFIER, IS_STRING, If, In, Index, Literal, NO, NUMBER, ObjectLiteral, Op, Param, Parens, Push, Range, Return, Scope, Splat, Switch, TAB, THIS, TRAILING_WHITESPACE, Throw, Try, UTILITIES, Value, While, YES, _ref, compact, del, ends, flatten, include, indexOf, last, merge, starts, utility;
  var __extends = function(child, parent) {
    var ctor = function() {};
    ctor.prototype = parent.prototype;
    child.prototype = new ctor();
    child.prototype.constructor = child;
    if (typeof parent.extended === "function") parent.extended(child);
    child.__super__ = parent.prototype;
  };
  Scope = require('./scope').Scope;
  _ref = require('./helpers'), compact = _ref.compact, flatten = _ref.flatten, merge = _ref.merge, del = _ref.del, include = _ref.include, indexOf = _ref.indexOf, starts = _ref.starts, ends = _ref.ends, last = _ref.last;
  YES = function() {
    return true;
  };
  NO = function() {
    return false;
  };
  THIS = function() {
    return this;
  };
  exports.Base = (function() {
    Base = (function() {
      return function Base() {
        this.tags = {};
        return this;
      };
    })();
    Base.prototype.compile = function(o) {
      var closure, code, top;
      this.options = o ? merge(o) : {};
      this.tab = o.indent;
      top = this.topSensitive() ? this.options.top : del(this.options, 'top');
      closure = this.isStatement(o) && !this.isPureStatement() && !top && !this.options.asStatement && !(this instanceof Comment) && !this.containsPureStatement();
      code = closure ? this.compileClosure(this.options) : this.compileNode(this.options);
      return code;
    };
    Base.prototype.compileClosure = function(o) {
      this.tab = o.indent;
      o.sharedScope = o.scope;
      return Closure.wrap(this).compile(o);
    };
    Base.prototype.compileReference = function(o, options) {
      var _len, compiled, i, node, pair, reference;
      pair = (function() {
        if (!this.isComplex()) {
          return [this, this];
        } else {
          reference = new Literal(o.scope.freeVariable((((options != null) ? options.name : undefined)) || 'ref'));
          compiled = new Assign(reference, this);
          return [compiled, reference];
        }
      }).call(this);
      if (((options != null) ? options.precompile : undefined)) {
        for (i = 0, _len = pair.length; i < _len; i++) {
          node = pair[i];
          (pair[i] = node.compile(o));
        }
      }
      return pair;
    };
    Base.prototype.idt = function(tabs) {
      var idt, num;
      idt = this.tab || '';
      num = (tabs || 0) + 1;
      while (num -= 1) {
        idt += TAB;
      }
      return idt;
    };
    Base.prototype.makeReturn = function() {
      return new Return(this);
    };
    Base.prototype.contains = function(block) {
      var contains;
      contains = false;
      this.traverseChildren(false, function(node) {
        if (block(node)) {
          contains = true;
          return false;
        }
      });
      return contains;
    };
    Base.prototype.containsType = function(type) {
      return this instanceof type || this.contains(function(node) {
        return node instanceof type;
      });
    };
    Base.prototype.containsPureStatement = function() {
      return this.isPureStatement() || this.contains(function(node) {
        return node.isPureStatement();
      });
    };
    Base.prototype.traverse = function(block) {
      return this.traverseChildren(true, block);
    };
    Base.prototype.toString = function(idt, override) {
      var _i, _len, _ref2, _result, child, children, klass;
      idt || (idt = '');
      children = (function() {
        _result = [];
        for (_i = 0, _len = (_ref2 = this.collectChildren()).length; _i < _len; _i++) {
          child = _ref2[_i];
          _result.push(child.toString(idt + TAB));
        }
        return _result;
      }).call(this).join('');
      klass = override || this.constructor.name + (this.soakNode || this.exist ? '?' : '');
      return '\n' + idt + klass + children;
    };
    Base.prototype.eachChild = function(func) {
      var _i, _j, _len, _len2, _ref2, _ref3, _result, attr, child;
      if (!this.children) {
        return;
      }
      _result = [];
      for (_i = 0, _len = (_ref2 = this.children).length; _i < _len; _i++) {
        attr = _ref2[_i];
        if (this[attr]) {
          for (_j = 0, _len2 = (_ref3 = flatten([this[attr]])).length; _j < _len2; _j++) {
            child = _ref3[_j];
            if (func(child) === false) {
              return;
            }
          }
        }
      }
      return _result;
    };
    Base.prototype.collectChildren = function() {
      var nodes;
      nodes = [];
      this.eachChild(function(node) {
        return nodes.push(node);
      });
      return nodes;
    };
    Base.prototype.traverseChildren = function(crossScope, func) {
      return this.eachChild(function(child) {
        if (func(child) === false) {
          return false;
        }
        return child instanceof Base && (crossScope || !(child instanceof Code)) ? child.traverseChildren(crossScope, func) : undefined;
      });
    };
    Base.prototype.children = [];
    Base.prototype.unwrap = THIS;
    Base.prototype.isStatement = NO;
    Base.prototype.isPureStatement = NO;
    Base.prototype.isComplex = YES;
    Base.prototype.topSensitive = NO;
    return Base;
  })();
  exports.Expressions = (function() {
    Expressions = (function() {
      return function Expressions(nodes) {
        Expressions.__super__.constructor.call(this);
        this.expressions = compact(flatten(nodes || []));
        return this;
      };
    })();
    __extends(Expressions, Base);
    Expressions.prototype.children = ['expressions'];
    Expressions.prototype.isStatement = YES;
    Expressions.prototype.push = function(node) {
      this.expressions.push(node);
      return this;
    };
    Expressions.prototype.unshift = function(node) {
      this.expressions.unshift(node);
      return this;
    };
    Expressions.prototype.unwrap = function() {
      return this.expressions.length === 1 ? this.expressions[0] : this;
    };
    Expressions.prototype.empty = function() {
      return this.expressions.length === 0;
    };
    Expressions.prototype.makeReturn = function() {
      var end, idx;
      end = this.expressions[(idx = this.expressions.length - 1)];
      if (end instanceof Comment) {
        end = this.expressions[idx -= 1];
      }
      if (end && !(end instanceof Return)) {
        this.expressions[idx] = end.makeReturn();
      }
      return this;
    };
    Expressions.prototype.compile = function(o) {
      o || (o = {});
      return o.scope ? Expressions.__super__.compile.call(this, o) : this.compileRoot(o);
    };
    Expressions.prototype.compileNode = function(o) {
      var _i, _len, _ref2, _result, node;
      return (function() {
        _result = [];
        for (_i = 0, _len = (_ref2 = this.expressions).length; _i < _len; _i++) {
          node = _ref2[_i];
          _result.push(this.compileExpression(node, merge(o)));
        }
        return _result;
      }).call(this).join("\n");
    };
    Expressions.prototype.compileRoot = function(o) {
      var code;
      o.indent = (this.tab = o.noWrap ? '' : TAB);
      o.scope = new Scope(null, this, null);
      code = this.compileWithDeclarations(o);
      code = code.replace(TRAILING_WHITESPACE, '');
      return o.noWrap ? code : ("(function() {\n" + code + "\n}).call(this);\n");
    };
    Expressions.prototype.compileWithDeclarations = function(o) {
      var code;
      code = this.compileNode(o);
      if (o.scope.hasAssignments(this)) {
        code = ("" + (this.tab) + "var " + (o.scope.compiledAssignments().replace(/\n/g, '$&' + this.tab)) + ";\n" + code);
      }
      if (!o.globals && o.scope.hasDeclarations(this)) {
        code = ("" + (this.tab) + "var " + (o.scope.compiledDeclarations()) + ";\n" + code);
      }
      return code;
    };
    Expressions.prototype.compileExpression = function(node, o) {
      var compiledNode;
      this.tab = o.indent;
      compiledNode = node.compile(merge(o, {
        top: true
      }));
      return node.isStatement(o) ? compiledNode : ("" + (this.idt()) + compiledNode + ";");
    };
    return Expressions;
  })();
  Expressions.wrap = function(nodes) {
    if (nodes.length === 1 && nodes[0] instanceof Expressions) {
      return nodes[0];
    }
    return new Expressions(nodes);
  };
  exports.Literal = (function() {
    Literal = (function() {
      return function Literal(_arg) {
        this.value = _arg;
        Literal.__super__.constructor.call(this);
        return this;
      };
    })();
    __extends(Literal, Base);
    Literal.prototype.makeReturn = function() {
      return this.isStatement() ? this : Literal.__super__.makeReturn.call(this);
    };
    Literal.prototype.isStatement = function() {
      var _ref2;
      return ('break' === (_ref2 = this.value) || 'continue' === _ref2 || 'debugger' === _ref2);
    };
    Literal.prototype.isPureStatement = Literal.prototype.isStatement;
    Literal.prototype.isComplex = NO;
    Literal.prototype.isReserved = function() {
      return !!this.value.reserved;
    };
    Literal.prototype.compileNode = function(o) {
      var end, idt, val;
      idt = this.isStatement(o) ? this.idt() : '';
      end = this.isStatement(o) ? ';' : '';
      val = this.isReserved() ? ("\"" + (this.value) + "\"") : this.value;
      return idt + val + end;
    };
    Literal.prototype.toString = function() {
      return ' "' + this.value + '"';
    };
    return Literal;
  })();
  exports.Return = (function() {
    Return = (function() {
      return function Return(_arg) {
        this.expression = _arg;
        Return.__super__.constructor.call(this);
        return this;
      };
    })();
    __extends(Return, Base);
    Return.prototype.isStatement = YES;
    Return.prototype.isPureStatement = YES;
    Return.prototype.children = ['expression'];
    Return.prototype.makeReturn = THIS;
    Return.prototype.compile = function(o) {
      var _ref2, expr;
      expr = (((_ref2 = this.expression) != null) ? _ref2.makeReturn() : undefined);
      if (expr && (!(expr instanceof Return))) {
        return expr.compile(o);
      }
      return Return.__super__.compile.call(this, o);
    };
    Return.prototype.compileNode = function(o) {
      var expr;
      expr = '';
      if (this.expression) {
        if (this.expression.isStatement(o)) {
          o.asStatement = true;
        }
        expr = ' ' + this.expression.compile(o);
      }
      return "" + (this.tab) + "return" + expr + ";";
    };
    return Return;
  })();
  exports.Value = (function() {
    Value = (function() {
      return function Value(_arg, _arg2, tag) {
        this.properties = _arg2;
        this.base = _arg;
        Value.__super__.constructor.call(this);
        this.properties || (this.properties = []);
        if (tag) {
          this.tags[tag] = true;
        }
        return this;
      };
    })();
    __extends(Value, Base);
    Value.prototype.children = ['base', 'properties'];
    Value.prototype.push = function(prop) {
      this.properties.push(prop);
      return this;
    };
    Value.prototype.hasProperties = function() {
      return !!this.properties.length;
    };
    Value.prototype.isArray = function() {
      return this.base instanceof ArrayLiteral && !this.properties.length;
    };
    Value.prototype.isObject = function() {
      return this.base instanceof ObjectLiteral && !this.properties.length;
    };
    Value.prototype.isComplex = function() {
      return this.base.isComplex() || this.hasProperties();
    };
    Value.prototype.makeReturn = function() {
      return this.properties.length ? Value.__super__.makeReturn.call(this) : this.base.makeReturn();
    };
    Value.prototype.unwrap = function() {
      return this.properties.length ? this : this.base;
    };
    Value.prototype.isStatement = function(o) {
      return this.base.isStatement(o) && !this.properties.length;
    };
    Value.prototype.isNumber = function() {
      return this.base instanceof Literal && NUMBER.test(this.base.value);
    };
    Value.prototype.cacheReference = function(o) {
      var base, bref, name, nref;
      name = last(this.properties);
      if (!this.base.isComplex() && this.properties.length < 2 && !((name != null) ? name.isComplex() : undefined)) {
        return [this, this];
      }
      base = new Value(this.base, this.properties.slice(0, -1));
      if (base.isComplex()) {
        bref = new Literal(o.scope.freeVariable('base'));
        base = new Value(new Parens(new Assign(bref, base)));
      }
      if (!name) {
        return [base, bref];
      }
      if (name.isComplex()) {
        nref = new Literal(o.scope.freeVariable('name'));
        name = new Index(new Assign(nref, name.index));
        nref = new Index(nref);
      }
      return [base.push(name), new Value(bref || base.base, [nref || name])];
    };
    Value.prototype.compile = function(o) {
      return !o.top || this.properties.length ? Value.__super__.compile.call(this, o) : this.base.compile(o);
    };
    Value.prototype.compileNode = function(o) {
      var _i, _len, code, ex, prop, props;
      if (ex = this.unfoldSoak(o)) {
        return ex.compile(o);
      }
      props = this.properties;
      if (this.parenthetical && !props.length) {
        this.base.parenthetical = true;
      }
      code = this.base.compile(o);
      if (props[0] instanceof Accessor && this.isNumber() || o.top && this.base instanceof ObjectLiteral) {
        code = ("(" + code + ")");
      }
      for (_i = 0, _len = props.length; _i < _len; _i++) {
        prop = props[_i];
        (code += prop.compile(o));
      }
      return code;
    };
    Value.prototype.unfoldSoak = function(o) {
      var _len, _ref2, fst, i, ifn, prop, ref, snd;
      if (this.base.soakNode) {
        Array.prototype.push.apply(this.base.body.properties, this.properties);
        return this.base;
      }
      for (i = 0, _len = (_ref2 = this.properties).length; i < _len; i++) {
        prop = _ref2[i];
        if (prop.soakNode) {
          prop.soakNode = false;
          fst = new Value(this.base, this.properties.slice(0, i));
          snd = new Value(this.base, this.properties.slice(i));
          if (fst.isComplex()) {
            ref = new Literal(o.scope.freeVariable('ref'));
            fst = new Parens(new Assign(ref, fst));
            snd.base = ref;
          }
          ifn = new If(new Existence(fst), snd, {
            operation: true
          });
          ifn.soakNode = true;
          return ifn;
        }
      }
      return null;
    };
    Value.unfoldSoak = function(o, parent, name) {
      var ifnode, node;
      node = parent[name];
      if (node instanceof If && node.soakNode) {
        ifnode = node;
      } else if (node instanceof Value) {
        ifnode = node.unfoldSoak(o);
      }
      if (!ifnode) {
        return;
      }
      parent[name] = ifnode.body;
      ifnode.body = new Value(parent);
      return ifnode;
    };
    return Value;
  }).call(this);
  exports.Comment = (function() {
    Comment = (function() {
      return function Comment(_arg) {
        this.comment = _arg;
        Comment.__super__.constructor.call(this);
        return this;
      };
    })();
    __extends(Comment, Base);
    Comment.prototype.isStatement = YES;
    Comment.prototype.makeReturn = THIS;
    Comment.prototype.compileNode = function(o) {
      return this.tab + '/*' + this.comment.replace(/\n/g, '\n' + this.tab) + '*/';
    };
    return Comment;
  })();
  exports.Call = (function() {
    Call = (function() {
      return function Call(variable, _arg, _arg2) {
        this.exist = _arg2;
        this.args = _arg;
        Call.__super__.constructor.call(this);
        this.isNew = false;
        this.isSuper = variable === 'super';
        this.variable = this.isSuper ? null : variable;
        this.args || (this.args = []);
        return this;
      };
    })();
    __extends(Call, Base);
    Call.prototype.children = ['variable', 'args'];
    Call.prototype.compileSplatArguments = function(o) {
      return Splat.compileSplattedArray(this.args, o);
    };
    Call.prototype.newInstance = function() {
      this.isNew = true;
      return this;
    };
    Call.prototype.prefix = function() {
      return this.isNew ? 'new ' : '';
    };
    Call.prototype.superReference = function(o) {
      var method, name;
      method = o.scope.method;
      if (!method) {
        throw Error("cannot call super outside of a function");
      }
      name = method.name;
      if (!name) {
        throw Error("cannot call super on an anonymous function.");
      }
      return method.klass ? ("" + (method.klass) + ".__super__." + name) : ("" + name + ".__super__.constructor");
    };
    Call.prototype.unfoldSoak = function(o) {
      var _i, _len, _ref2, call, list, node;
      call = this;
      list = [];
      while (true) {
        if (call.variable instanceof Call) {
          list.push(call);
          call = call.variable;
          continue;
        }
        if (!(call.variable instanceof Value)) {
          break;
        }
        list.push(call);
        if (!((call = call.variable.base) instanceof Call)) {
          break;
        }
      }
      for (_i = 0, _len = (_ref2 = list.reverse()).length; _i < _len; _i++) {
        call = _ref2[_i];
        if (node) {
          if (call.variable instanceof Call) {
            call.variable = node;
          } else {
            call.variable.base = node;
          }
        }
        node = Value.unfoldSoak(o, call, 'variable');
      }
      return node;
    };
    Call.prototype.compileNode = function(o) {
      var _i, _j, _len, _len2, _ref2, _ref3, _ref4, _result, arg, args, left, node, rite, val;
      if (node = this.unfoldSoak(o)) {
        return node.compile(o);
      }
      if (this.exist) {
        if (val = this.variable) {
          if (!(val instanceof Value)) {
            val = new Value(val);
          }
          _ref2 = val.cacheReference(o), left = _ref2[0], rite = _ref2[1];
          rite = new Call(rite, this.args);
        } else {
          left = new Literal(this.superReference(o));
          rite = new Call(new Value(left), this.args);
          rite.isNew = this.isNew;
        }
        left = ("typeof " + (left.compile(o)) + " !== \"function\"");
        rite = rite.compile(o);
        return ("(" + left + " ? undefined : " + rite + ")");
      }
      for (_i = 0, _len = (_ref3 = this.args).length; _i < _len; _i++) {
        arg = _ref3[_i];
        if (arg instanceof Splat) {
          return this.compileSplat(o);
        }
      }
      args = (function() {
        _result = [];
        for (_j = 0, _len2 = (_ref4 = this.args).length; _j < _len2; _j++) {
          arg = _ref4[_j];
          _result.push((arg.parenthetical = true) && arg.compile(o));
        }
        return _result;
      }).call(this).join(', ');
      return this.isSuper ? this.compileSuper(args, o) : ("" + (this.prefix()) + (this.variable.compile(o)) + "(" + args + ")");
    };
    Call.prototype.compileSuper = function(args, o) {
      return "" + (this.superReference(o)) + ".call(this" + (args.length ? ', ' : '') + args + ")";
    };
    Call.prototype.compileSplat = function(o) {
      var _i, _len, _ref2, arg, argvar, base, call, ctor, fun, idt, name, ref, result, splatargs;
      splatargs = this.compileSplatArguments(o);
      if (this.isSuper) {
        return ("" + (this.superReference(o)) + ".apply(this, " + splatargs + ")");
      }
      if (!this.isNew) {
        if (!((base = this.variable) instanceof Value)) {
          base = new Value(base);
        }
        if ((name = base.properties.pop()) && base.isComplex()) {
          ref = o.scope.freeVariable('this');
          fun = ("(" + ref + " = " + (base.compile(o)) + ")" + (name.compile(o)));
        } else {
          fun = (ref = base.compile(o));
          if (name) {
            fun += name.compile(o);
          }
        }
        return ("" + fun + ".apply(" + ref + ", " + splatargs + ")");
      }
      call = 'call(this)';
      argvar = function(node) {
        return node instanceof Literal && node.value === 'arguments';
      };
      for (_i = 0, _len = (_ref2 = this.args).length; _i < _len; _i++) {
        arg = _ref2[_i];
        if (arg.contains(argvar)) {
          call = 'apply(this, arguments)';
          break;
        }
      }
      ctor = o.scope.freeVariable('ctor');
      ref = o.scope.freeVariable('ref');
      result = o.scope.freeVariable('result');
      return "(function() {\n" + (idt = this.idt(1)) + "var ctor = function() {};\n" + idt + (utility('extends')) + "(ctor, " + ctor + " = " + (this.variable.compile(o)) + ");\n" + idt + "return typeof (" + result + " = " + ctor + ".apply(" + ref + " = new ctor, " + splatargs + ")) === \"object\" ? " + result + " : " + ref + ";\n" + (this.tab) + "})." + call;
    };
    return Call;
  })();
  exports.Extends = (function() {
    Extends = (function() {
      return function Extends(_arg, _arg2) {
        this.parent = _arg2;
        this.child = _arg;
        Extends.__super__.constructor.call(this);
        return this;
      };
    })();
    __extends(Extends, Base);
    Extends.prototype.children = ['child', 'parent'];
    Extends.prototype.compileNode = function(o) {
      var ref;
      ref = new Value(new Literal(utility('extends')));
      return (new Call(ref, [this.child, this.parent])).compile(o);
    };
    return Extends;
  })();
  exports.Accessor = (function() {
    Accessor = (function() {
      return function Accessor(_arg, tag) {
        this.name = _arg;
        Accessor.__super__.constructor.call(this);
        this.prototype = tag === 'prototype' ? '.prototype' : '';
        this.soakNode = tag === 'soak';
        return this;
      };
    })();
    __extends(Accessor, Base);
    Accessor.prototype.children = ['name'];
    Accessor.prototype.compileNode = function(o) {
      var name, namePart;
      name = this.name.compile(o);
      namePart = name.match(IS_STRING) ? ("[" + name + "]") : ("." + name);
      return this.prototype + namePart;
    };
    Accessor.prototype.isComplex = NO;
    return Accessor;
  })();
  exports.Index = (function() {
    Index = (function() {
      return function Index(_arg) {
        this.index = _arg;
        Index.__super__.constructor.call(this);
        return this;
      };
    })();
    __extends(Index, Base);
    Index.prototype.children = ['index'];
    Index.prototype.compileNode = function(o) {
      var idx, prefix;
      idx = this.index.compile(o);
      prefix = this.proto ? '.prototype' : '';
      return "" + prefix + "[" + idx + "]";
    };
    Index.prototype.isComplex = function() {
      return this.index.isComplex();
    };
    return Index;
  })();
  exports.Range = (function() {
    Range = (function() {
      return function Range(_arg, _arg2, _arg3) {
        this.step = _arg3;
        this.end = _arg2;
        this.begin = _arg;
        Range.__super__.constructor.call(this);
        return this;
      };
    })();
    __extends(Range, Base);
    Range.prototype.children = ['begin', 'end', 'step'];
    Range.prototype.compileNode = function(o) {
      var _ref2, _ref3, _ref4, bgn, bvar, compare, end, evar, idx, stp, svar, vars;
      if (!(idx = o.index)) {
        return this.compileArray(o);
      }
      o = merge(o, {
        top: true
      });
      _ref2 = this.begin.compileReference(o, {
        precompile: true,
        name: 'from'
      }), bgn = _ref2[0], bvar = _ref2[1];
      _ref3 = this.end.compileReference(o, {
        precompile: true,
        name: 'to'
      }), end = _ref3[0], evar = _ref3[1];
      _ref4 = this.step.compileReference(o, {
        precompile: true,
        name: 'step'
      }), stp = _ref4[0], svar = _ref4[1];
      vars = ("" + idx + " = " + bgn);
      if (end !== evar) {
        vars += (", " + end);
      }
      if (stp !== svar) {
        vars += (", " + stp);
      }
      compare = isNaN(stp) ? ("" + bvar + " > " + evar + " ? " + idx + " >= " + evar + " : " + idx + " <= " + evar) : ("" + idx + " " + (stp < 0 ? '>=' : '<=') + " " + evar);
      return "" + vars + "; " + compare + "; " + idx + " += " + svar;
    };
    Range.prototype.compileArray = function(o) {
      var compare, end, i, idt, step;
      i = this.begin.compile(o);
      end = this.end.compile(o);
      step = this.step.compile(o);
      if (!(isNaN(i) || isNaN(end) || isNaN(step) || (end - i) / step > 20)) {
        return ("[" + ((function(i, end, step, result) {
          if (step < 0) for (; i >= end; i += step) result.push(i);
          else          for (; i <= end; i += step) result.push(i);
          return result;
        })(+i, +end, +step, []).join(', ')) + "]");
      }
      idt = this.idt(1);
      if (!isNaN(step)) {
        compare = step < 0 ? '>=' : '<=';
        return ("(function(i, end, result) {\n" + idt + "for (; i " + compare + " end; i += " + step + ") result.push(i);\n" + idt + "return result;\n" + (this.tab) + "})(" + i + ", " + end + ", [])");
      }
      return "(function(i, end, step, result) {\n" + idt + "if (step < 0) for (; i >= end; i += step) result.push(i);\n" + idt + "else          for (; i <= end; i += step) result.push(i);\n" + idt + "return result;\n" + (this.tab) + "})(" + i + ", " + end + ", " + step + ", [])";
    };
    return Range;
  })();
  exports.ObjectLiteral = (function() {
    ObjectLiteral = (function() {
      return function ObjectLiteral(props) {
        ObjectLiteral.__super__.constructor.call(this);
        this.objects = (this.properties = props || []);
        return this;
      };
    })();
    __extends(ObjectLiteral, Base);
    ObjectLiteral.prototype.children = ['properties'];
    ObjectLiteral.prototype.topSensitive = YES;
    ObjectLiteral.prototype.compileNode = function(o) {
      var _i, _len, _ref2, _result, i, indent, join, lastNoncom, nonComments, obj, prop, props, top;
      top = del(o, 'top');
      o.indent = this.idt(1);
      nonComments = (function() {
        _result = [];
        for (_i = 0, _len = (_ref2 = this.properties).length; _i < _len; _i++) {
          prop = _ref2[_i];
          if (!(prop instanceof Comment)) {
            _result.push(prop);
          }
        }
        return _result;
      }).call(this);
      lastNoncom = last(nonComments);
      props = (function() {
        _result = [];
        for (i = 0, _len = (_ref2 = this.properties).length; i < _len; i++) {
          prop = _ref2[i];
          _result.push((function() {
            join = ",\n";
            if ((prop === lastNoncom) || (prop instanceof Comment)) {
              join = "\n";
            }
            if (i === this.properties.length - 1) {
              join = '';
            }
            indent = prop instanceof Comment ? '' : this.idt(1);
            if (prop instanceof Value && prop.tags["this"]) {
              prop = new Assign(prop.properties[0].name, prop, 'object');
            } else if (!(prop instanceof Assign) && !(prop instanceof Comment)) {
              prop = new Assign(prop, prop, 'object');
            }
            return indent + prop.compile(o) + join;
          }).call(this));
        }
        return _result;
      }).call(this);
      props = props.join('');
      obj = '{' + (props ? '\n' + props + '\n' + this.idt() : '') + '}';
      return top ? ("(" + obj + ")") : obj;
    };
    return ObjectLiteral;
  })();
  exports.ArrayLiteral = (function() {
    ArrayLiteral = (function() {
      return function ArrayLiteral(_arg) {
        this.objects = _arg;
        ArrayLiteral.__super__.constructor.call(this);
        this.objects || (this.objects = []);
        return this;
      };
    })();
    __extends(ArrayLiteral, Base);
    ArrayLiteral.prototype.children = ['objects'];
    ArrayLiteral.prototype.compileSplatLiteral = function(o) {
      return Splat.compileSplattedArray(this.objects, o);
    };
    ArrayLiteral.prototype.compileNode = function(o) {
      var _len, _ref2, code, i, obj, objects;
      o.indent = this.idt(1);
      objects = [];
      for (i = 0, _len = (_ref2 = this.objects).length; i < _len; i++) {
        obj = _ref2[i];
        code = obj.compile(o);
        if (obj instanceof Splat) {
          return this.compileSplatLiteral(o);
        } else if (obj instanceof Comment) {
          objects.push("\n" + code + "\n" + (o.indent));
        } else if (i === this.objects.length - 1) {
          objects.push(code);
        } else {
          objects.push("" + code + ", ");
        }
      }
      objects = objects.join('');
      return indexOf(objects, '\n') >= 0 ? ("[\n" + (this.idt(1)) + objects + "\n" + (this.tab) + "]") : ("[" + objects + "]");
    };
    return ArrayLiteral;
  })();
  exports.Class = (function() {
    Class = (function() {
      return function Class(variable, _arg, _arg2) {
        this.properties = _arg2;
        this.parent = _arg;
        Class.__super__.constructor.call(this);
        this.variable = variable === '__temp__' ? new Literal(variable) : variable;
        this.properties || (this.properties = []);
        this.returns = false;
        return this;
      };
    })();
    __extends(Class, Base);
    Class.prototype.children = ['variable', 'parent', 'properties'];
    Class.prototype.isStatement = YES;
    Class.prototype.makeReturn = function() {
      this.returns = true;
      return this;
    };
    Class.prototype.compileNode = function(o) {
      var _i, _len, _ref2, _ref3, _ref4, access, applied, apply, className, constScope, construct, constructor, extension, func, me, pname, prop, props, pvar, ref, returns, val, variable;
      variable = this.variable;
      if (variable.value === '__temp__') {
        variable = new Literal(o.scope.freeVariable('ctor'));
      }
      extension = this.parent && new Extends(variable, this.parent);
      props = new Expressions;
      o.top = true;
      me = null;
      className = variable.compile(o);
      constScope = null;
      if (this.parent) {
        applied = new Value(this.parent, [new Accessor(new Literal('apply'))]);
        constructor = new Code([], new Expressions([new Call(applied, [new Literal('this'), new Literal('arguments')])]));
      } else {
        constructor = new Code;
      }
      for (_i = 0, _len = (_ref2 = this.properties).length; _i < _len; _i++) {
        prop = _ref2[_i];
        _ref3 = prop, pvar = _ref3.variable, func = _ref3.value;
        if (pvar && pvar.base.value === 'constructor') {
          if (!(func instanceof Code)) {
            _ref4 = func.compileReference(o), func = _ref4[0], ref = _ref4[1];
            if (func !== ref) {
              props.push(func);
            }
            apply = new Call(new Value(ref, [new Accessor(new Literal('apply'))]), [new Literal('this'), new Literal('arguments')]);
            func = new Code([], new Expressions([apply]));
          }
          if (func.bound) {
            throw new Error("cannot define a constructor as a bound function.");
          }
          func.name = className;
          func.body.push(new Return(new Literal('this')));
          variable = new Value(variable);
          variable.namespaced = include(func.name, '.');
          constructor = func;
          continue;
        }
        if (func instanceof Code && func.bound) {
          if (prop.context === 'this') {
            func.context = className;
          } else {
            func.bound = false;
            constScope || (constScope = new Scope(o.scope, constructor.body, constructor));
            me || (me = constScope.freeVariable('this'));
            pname = pvar.compile(o);
            if (constructor.body.empty()) {
              constructor.body.push(new Return(new Literal('this')));
            }
            constructor.body.unshift(new Literal("this." + pname + " = function(){ return " + className + ".prototype." + pname + ".apply(" + me + ", arguments); }"));
          }
        }
        if (pvar) {
          access = prop.context === 'this' ? pvar.base.properties[0] : new Accessor(pvar, 'prototype');
          val = new Value(variable, [access]);
          prop = new Assign(val, func);
        }
        props.push(prop);
      }
      constructor.className = className.match(/[\w\d\$_]+$/);
      if (me) {
        constructor.body.unshift(new Literal("" + me + " = this"));
      }
      construct = this.idt() + new Assign(variable, constructor).compile(merge(o, {
        sharedScope: constScope
      })) + ';';
      props = !props.empty() ? '\n' + props.compile(o) : '';
      extension = extension ? '\n' + this.idt() + extension.compile(o) + ';' : '';
      returns = this.returns ? '\n' + new Return(variable).compile(o) : '';
      return construct + extension + props + returns;
    };
    return Class;
  })();
  exports.Assign = (function() {
    Assign = (function() {
      return function Assign(_arg, _arg2, _arg3) {
        this.context = _arg3;
        this.value = _arg2;
        this.variable = _arg;
        Assign.__super__.constructor.call(this);
        return this;
      };
    })();
    __extends(Assign, Base);
    Assign.prototype.METHOD_DEF = /^(?:(\S+)\.prototype\.)?([$A-Za-z_][$\w]*)$/;
    Assign.prototype.children = ['variable', 'value'];
    Assign.prototype.topSensitive = YES;
    Assign.prototype.isValue = function() {
      return this.variable instanceof Value;
    };
    Assign.prototype.compileNode = function(o) {
      var isValue, match, name, node, stmt, top, val;
      if (isValue = this.isValue()) {
        if (this.variable.isArray() || this.variable.isObject()) {
          return this.compilePatternMatch(o);
        }
        if (node = Value.unfoldSoak(o, this, 'variable')) {
          return node.compile(o);
        }
      }
      top = del(o, 'top');
      stmt = del(o, 'asStatement');
      name = this.variable.compile(o);
      if (this.value instanceof Code && (match = this.METHOD_DEF.exec(name))) {
        this.value.name = match[2];
        this.value.klass = match[1];
      }
      val = this.value.compile(o);
      if (this.context === 'object') {
        return ("" + name + ": " + val);
      }
      if (!(isValue && (this.variable.hasProperties() || this.variable.namespaced))) {
        o.scope.find(name);
      }
      val = ("" + name + " = " + val);
      if (stmt) {
        return ("" + (this.tab) + val + ";");
      }
      return top || this.parenthetical ? val : ("(" + val + ")");
    };
    Assign.prototype.compilePatternMatch = function(o) {
      var _len, _ref2, _ref3, accessClass, assigns, code, i, idx, isObject, obj, objects, olength, otop, splat, top, val, valVar, value;
      if ((value = this.value).isStatement(o)) {
        value = Closure.wrap(value);
      }
      objects = this.variable.base.objects;
      if (!(olength = objects.length)) {
        return value.compile(o);
      }
      isObject = this.variable.isObject();
      if (o.top && olength === 1 && !((obj = objects[0]) instanceof Splat)) {
        if (obj instanceof Assign) {
          _ref2 = obj, idx = _ref2.variable.base, obj = _ref2.value;
        } else {
          idx = isObject ? (obj.tags["this"] ? obj.properties[0].name : obj) : new Literal(0);
        }
        if (!(value instanceof Value)) {
          value = new Value(value);
        }
        accessClass = IDENTIFIER.test(idx.value) ? Accessor : Index;
        value.properties.push(new accessClass(idx));
        return new Assign(obj, value).compile(o);
      }
      top = del(o, 'top');
      otop = merge(o, {
        top: true
      });
      valVar = o.scope.freeVariable('ref');
      assigns = [("" + valVar + " = " + (value.compile(o)))];
      splat = false;
      for (i = 0, _len = objects.length; i < _len; i++) {
        obj = objects[i];
        idx = i;
        if (isObject) {
          if (obj instanceof Assign) {
            _ref3 = [obj.value, obj.variable.base], obj = _ref3[0], idx = _ref3[1];
          } else {
            idx = obj.tags["this"] ? obj.properties[0].name : obj;
          }
        }
        if (!(obj instanceof Value || obj instanceof Splat)) {
          throw new Error('pattern matching must use only identifiers on the left-hand side.');
        }
        accessClass = isObject && IDENTIFIER.test(idx.value) ? Accessor : Index;
        if (!splat && obj instanceof Splat) {
          val = new Literal(obj.compileValue(o, valVar, i, olength - i - 1));
          splat = true;
        } else {
          if (typeof idx !== 'object') {
            idx = new Literal(splat ? ("" + valVar + ".length - " + (olength - idx)) : idx);
          }
          val = new Value(new Literal(valVar), [new accessClass(idx)]);
        }
        assigns.push(new Assign(obj, val).compile(otop));
      }
      if (!top) {
        assigns.push(valVar);
      }
      code = assigns.join(', ');
      return top || this.parenthetical ? code : ("(" + code + ")");
    };
    return Assign;
  })();
  exports.Code = (function() {
    Code = (function() {
      return function Code(_arg, _arg2, tag) {
        this.body = _arg2;
        this.params = _arg;
        Code.__super__.constructor.call(this);
        this.params || (this.params = []);
        this.body || (this.body = new Expressions);
        this.bound = tag === 'boundfunc';
        if (this.bound) {
          this.context = 'this';
        }
        return this;
      };
    })();
    __extends(Code, Base);
    Code.prototype.children = ['params', 'body'];
    Code.prototype.compileNode = function(o) {
      var _i, _len, _len2, _ref2, _ref3, _result, close, code, empty, func, i, open, param, params, sharedScope, splat, top, value;
      sharedScope = del(o, 'sharedScope');
      top = del(o, 'top');
      o.scope = sharedScope || new Scope(o.scope, this.body, this);
      o.top = true;
      o.indent = this.idt(1);
      empty = this.body.expressions.length === 0;
      del(o, 'noWrap');
      del(o, 'globals');
      splat = undefined;
      params = [];
      for (i = 0, _len = (_ref2 = this.params).length; i < _len; i++) {
        param = _ref2[i];
        if (splat) {
          if (param.attach) {
            param.assign = new Assign(new Value(new Literal('this'), [new Accessor(param.value)]));
            this.body.expressions.splice(splat.index + 1, 0, param.assign);
          }
          splat.trailings.push(param);
        } else {
          if (param.attach) {
            value = param.value;
            _ref3 = [new Literal(o.scope.freeVariable('arg')), param.splat], param = _ref3[0], param.splat = _ref3[1];
            this.body.unshift(new Assign(new Value(new Literal('this'), [new Accessor(value)]), param));
          }
          if (param.splat) {
            splat = new Splat(param.value);
            splat.index = i;
            splat.trailings = [];
            splat.arglength = this.params.length;
            this.body.unshift(splat);
          } else {
            params.push(param);
          }
        }
      }
      o.scope.startLevel();
      params = (function() {
        _result = [];
        for (_i = 0, _len2 = params.length; _i < _len2; _i++) {
          param = params[_i];
          _result.push(param.compile(o));
        }
        return _result;
      })();
      if (!empty) {
        this.body.makeReturn();
      }
      for (_i = 0, _len2 = params.length; _i < _len2; _i++) {
        param = params[_i];
        (o.scope.parameter(param));
      }
      if (this.className) {
        o.indent = this.idt(2);
      }
      code = this.body.expressions.length ? ("\n" + (this.body.compileWithDeclarations(o)) + "\n") : '';
      open = this.className ? ("(function() {\n" + (this.idt(1)) + "return function " + (this.className) + "(") : "function(";
      close = this.className ? ("" + (code && this.idt(1)) + "};\n" + (this.tab) + "})()") : ("" + (code && this.tab) + "}");
      func = ("" + open + (params.join(', ')) + ") {" + code + close);
      o.scope.endLevel();
      if (this.bound) {
        return ("" + (utility('bind')) + "(" + func + ", " + (this.context) + ")");
      }
      return top ? ("(" + func + ")") : func;
    };
    Code.prototype.topSensitive = YES;
    Code.prototype.traverseChildren = function(crossScope, func) {
      return crossScope ? Code.__super__.traverseChildren.call(this, crossScope, func) : undefined;
    };
    return Code;
  })();
  exports.Param = (function() {
    Param = (function() {
      return function Param(_arg, _arg2, _arg3) {
        this.splat = _arg3;
        this.attach = _arg2;
        this.name = _arg;
        Param.__super__.constructor.call(this);
        this.value = new Literal(this.name);
        return this;
      };
    })();
    __extends(Param, Base);
    Param.prototype.children = ['name'];
    Param.prototype.compileNode = function(o) {
      return this.value.compile(o);
    };
    Param.prototype.toString = function() {
      var name;
      name = this.name;
      if (this.attach) {
        name = '@' + name;
      }
      if (this.splat) {
        name += '...';
      }
      return new Literal(name).toString();
    };
    return Param;
  })();
  exports.Splat = (function() {
    Splat = (function() {
      return function Splat(name) {
        Splat.__super__.constructor.call(this);
        if (!name.compile) {
          name = new Literal(name);
        }
        this.name = name;
        return this;
      };
    })();
    __extends(Splat, Base);
    Splat.prototype.children = ['name'];
    Splat.prototype.compileNode = function(o) {
      return (this.index != null) ? this.compileParam(o) : this.name.compile(o);
    };
    Splat.prototype.compileParam = function(o) {
      var _len, _ref2, assign, end, idx, len, name, pos, trailing, variadic;
      name = this.name.compile(o);
      o.scope.find(name);
      end = '';
      if (this.trailings.length) {
        len = o.scope.freeVariable('len');
        o.scope.assign(len, "arguments.length");
        variadic = o.scope.freeVariable('result');
        o.scope.assign(variadic, len + ' >= ' + this.arglength);
        end = this.trailings.length ? (", " + len + " - " + (this.trailings.length)) : undefined;
        for (idx = 0, _len = (_ref2 = this.trailings).length; idx < _len; idx++) {
          trailing = _ref2[idx];
          if (trailing.attach) {
            assign = trailing.assign;
            trailing = new Literal(o.scope.freeVariable('arg'));
            assign.value = trailing;
          }
          pos = this.trailings.length - idx;
          o.scope.assign(trailing.compile(o), "arguments[" + variadic + " ? " + len + " - " + pos + " : " + (this.index + idx) + "]");
        }
      }
      return "" + name + " = " + (utility('slice')) + ".call(arguments, " + (this.index) + end + ")";
    };
    Splat.prototype.compileValue = function(o, name, index, trailings) {
      var trail;
      trail = trailings ? (", " + name + ".length - " + trailings) : '';
      return "" + (utility('slice')) + ".call(" + name + ", " + index + trail + ")";
    };
    Splat.compileSplattedArray = function(list, o) {
      var _len, arg, args, code, end, i, prev;
      args = [];
      end = -1;
      for (i = 0, _len = list.length; i < _len; i++) {
        arg = list[i];
        code = arg.compile(o);
        prev = args[end];
        if (!(arg instanceof Splat)) {
          if (prev && starts(prev, '[') && ends(prev, ']')) {
            args[end] = ("" + (prev.slice(0, -1)) + ", " + code + "]");
            continue;
          }
          if (prev && starts(prev, '.concat([') && ends(prev, '])')) {
            args[end] = ("" + (prev.slice(0, -2)) + ", " + code + "])");
            continue;
          }
          code = ("[" + code + "]");
        }
        args[++end] = i === 0 ? code : (".concat(" + code + ")");
      }
      return args.join('');
    };
    return Splat;
  }).call(this);
  exports.While = (function() {
    While = (function() {
      return function While(condition, opts) {
        While.__super__.constructor.call(this);
        if (((opts != null) ? opts.invert : undefined)) {
          if (condition instanceof Op) {
            condition = new Parens(condition);
          }
          condition = new Op('!', condition);
        }
        this.condition = condition;
        this.guard = ((opts != null) ? opts.guard : undefined);
        return this;
      };
    })();
    __extends(While, Base);
    While.prototype.children = ['condition', 'guard', 'body'];
    While.prototype.isStatement = YES;
    While.prototype.addBody = function(body) {
      this.body = body;
      return this;
    };
    While.prototype.makeReturn = function() {
      this.returns = true;
      return this;
    };
    While.prototype.topSensitive = YES;
    While.prototype.compileNode = function(o) {
      var cond, post, pre, rvar, set, top;
      top = del(o, 'top') && !this.returns;
      o.indent = this.idt(1);
      o.top = true;
      this.condition.parenthetical = true;
      cond = this.condition.compile(o);
      set = '';
      if (!top) {
        rvar = o.scope.freeVariable('result');
        set = ("" + (this.tab) + rvar + " = [];\n");
        if (this.body) {
          this.body = Push.wrap(rvar, this.body);
        }
      }
      pre = ("" + set + (this.tab) + "while (" + cond + ")");
      if (this.guard) {
        this.body = Expressions.wrap([new If(this.guard, this.body)]);
      }
      if (this.returns) {
        post = '\n' + new Return(new Literal(rvar)).compile(merge(o, {
          indent: this.idt()
        }));
      } else {
        post = '';
      }
      return "" + pre + " {\n" + (this.body.compile(o)) + "\n" + (this.tab) + "}" + post;
    };
    return While;
  })();
  exports.Op = (function() {
    Op = (function() {
      return function Op(op, first, second, flip) {
        var _ref2;
        if (first instanceof Value) {
          if (first.base instanceof ObjectLiteral) {
            first = new Parens(first);
          } else if (!second && ('+' === op || '-' === op) && NUMBER.test(first.base.value)) {
            return new Value(new Literal(op + first.base.value));
          }
        } else if (op === 'new' && first instanceof Call) {
          return first.newInstance();
        }
        Op.__super__.constructor.call(this);
        this.operator = this.CONVERSIONS[op] || op;
        this.first = first;
        this.second = second;
        this.flip = !!flip;
        this.first.tags.operation = true;
                if ((_ref2 = this.second) != null) {
_ref2.tags.operation = true
        };
        return this;
      };
    })();
    __extends(Op, Base);
    Op.prototype.CONVERSIONS = {
      '==': '===',
      '!=': '!==',
      of: 'in'
    };
    Op.prototype.INVERSIONS = {
      '!==': '===',
      '===': '!=='
    };
    Op.prototype.CHAINABLE = ['<', '>', '>=', '<=', '===', '!=='];
    Op.prototype.ASSIGNMENT = ['||=', '&&=', '?='];
    Op.prototype.PREFIX_OPERATORS = ['new', 'typeof', 'delete'];
    Op.prototype.children = ['first', 'second'];
    Op.prototype.isUnary = function() {
      return !this.second;
    };
    Op.prototype.isInvertible = function() {
      var _ref2;
      return ('===' === (_ref2 = this.operator) || '!==' === _ref2);
    };
    Op.prototype.isComplex = function() {
      return this.operator !== '!' || this.first.isComplex();
    };
    Op.prototype.isMutator = function() {
      var _ref2;
      return ends(this.operator, '=') && !('===' === (_ref2 = this.operator) || '!==' === _ref2);
    };
    Op.prototype.isChainable = function() {
      return include(this.CHAINABLE, this.operator);
    };
    Op.prototype.invert = function() {
      return (this.operator = this.INVERSIONS[this.operator]);
    };
    Op.prototype.toString = function(idt) {
      return Op.__super__.toString.call(this, idt, this.constructor.name + ' ' + this.operator);
    };
    Op.prototype.compileNode = function(o) {
      var node;
      if (node = Value.unfoldSoak(o, this, 'first')) {
        return node.compile(o);
      }
      if (this.isChainable() && this.first.unwrap() instanceof Op && this.first.unwrap().isChainable()) {
        return this.compileChain(o);
      }
      if (indexOf(this.ASSIGNMENT, this.operator) >= 0) {
        return this.compileAssignment(o);
      }
      if (this.isUnary()) {
        return this.compileUnary(o);
      }
      if (this.operator === '?') {
        return this.compileExistence(o);
      }
      if (this.first instanceof Op && this.first.isMutator()) {
        this.first = new Parens(this.first);
      }
      if (this.second instanceof Op && this.second.isMutator()) {
        this.second = new Parens(this.second);
      }
      return [this.first.compile(o), this.operator, this.second.compile(o)].join(' ');
    };
    Op.prototype.compileChain = function(o) {
      var _ref2, _ref3, first, second, shared;
      shared = this.first.unwrap().second;
      _ref2 = shared.compileReference(o), this.first.second = _ref2[0], shared = _ref2[1];
      _ref3 = [this.first.compile(o), this.second.compile(o), shared.compile(o)], first = _ref3[0], second = _ref3[1], shared = _ref3[2];
      return "(" + first + ") && (" + shared + " " + (this.operator) + " " + second + ")";
    };
    Op.prototype.compileAssignment = function(o) {
      var _ref2, left, rite;
      _ref2 = this.first.cacheReference(o), left = _ref2[0], rite = _ref2[1];
      rite = new Assign(rite, this.second);
      return new Op(this.operator.slice(0, -1), left, rite).compile(o);
    };
    Op.prototype.compileExistence = function(o) {
      var fst, ref;
      if (this.first.isComplex()) {
        ref = o.scope.freeVariable('ref');
        fst = new Parens(new Assign(new Literal(ref), this.first));
      } else {
        fst = this.first;
        ref = fst.compile(o);
      }
      return new Existence(fst).compile(o) + (" ? " + ref + " : " + (this.second.compile(o)));
    };
    Op.prototype.compileUnary = function(o) {
      var parts, space;
      space = indexOf(this.PREFIX_OPERATORS, this.operator) >= 0 ? ' ' : '';
      parts = [this.operator, space, this.first.compile(o)];
      if (this.flip) {
        parts = parts.reverse();
      }
      return parts.join('');
    };
    return Op;
  })();
  exports.In = (function() {
    In = (function() {
      return function In(_arg, _arg2) {
        this.array = _arg2;
        this.object = _arg;
        In.__super__.constructor.call(this);
        return this;
      };
    })();
    __extends(In, Base);
    In.prototype.children = ['object', 'array'];
    In.prototype.isArray = function() {
      return this.array instanceof Value && this.array.isArray();
    };
    In.prototype.compileNode = function(o) {
      var _ref2;
      _ref2 = this.object.compileReference(o, {
        precompile: true
      }), this.obj1 = _ref2[0], this.obj2 = _ref2[1];
      return this.isArray() ? this.compileOrTest(o) : this.compileLoopTest(o);
    };
    In.prototype.compileOrTest = function(o) {
      var _len, _ref2, _result, i, item, tests;
      tests = (function() {
        _result = [];
        for (i = 0, _len = (_ref2 = this.array.base.objects).length; i < _len; i++) {
          item = _ref2[i];
          _result.push("" + (item.compile(o)) + " === " + (i ? this.obj2 : this.obj1));
        }
        return _result;
      }).call(this);
      return "(" + (tests.join(' || ')) + ")";
    };
    In.prototype.compileLoopTest = function(o) {
      var _ref2, _ref3, i, l, prefix;
      _ref2 = this.array.compileReference(o, {
        precompile: true
      }), this.arr1 = _ref2[0], this.arr2 = _ref2[1];
      _ref3 = [o.scope.freeVariable('i'), o.scope.freeVariable('len')], i = _ref3[0], l = _ref3[1];
      prefix = this.obj1 !== this.obj2 ? this.obj1 + '; ' : '';
      return "(function(){ " + prefix + "for (var " + i + "=0, " + l + "=" + (this.arr1) + ".length; " + i + "<" + l + "; " + i + "++) { if (" + (this.arr2) + "[" + i + "] === " + (this.obj2) + ") return true; } return false; }).call(this)";
    };
    return In;
  })();
  exports.Try = (function() {
    Try = (function() {
      return function Try(_arg, _arg2, _arg3, _arg4) {
        this.ensure = _arg4;
        this.recovery = _arg3;
        this.error = _arg2;
        this.attempt = _arg;
        Try.__super__.constructor.call(this);
        return this;
      };
    })();
    __extends(Try, Base);
    Try.prototype.children = ['attempt', 'recovery', 'ensure'];
    Try.prototype.isStatement = YES;
    Try.prototype.makeReturn = function() {
      if (this.attempt) {
        this.attempt = this.attempt.makeReturn();
      }
      if (this.recovery) {
        this.recovery = this.recovery.makeReturn();
      }
      return this;
    };
    Try.prototype.compileNode = function(o) {
      var attemptPart, catchPart, errorPart, finallyPart;
      o.indent = this.idt(1);
      o.top = true;
      attemptPart = this.attempt.compile(o);
      errorPart = this.error ? (" (" + (this.error.compile(o)) + ") ") : ' ';
      catchPart = this.recovery ? (" catch" + errorPart + "{\n" + (this.recovery.compile(o)) + "\n" + (this.tab) + "}") : (!(this.ensure || this.recovery) ? ' catch (_e) {}' : '');
      finallyPart = (this.ensure || '') && ' finally {\n' + this.ensure.compile(merge(o)) + ("\n" + (this.tab) + "}");
      return "" + (this.tab) + "try {\n" + attemptPart + "\n" + (this.tab) + "}" + catchPart + finallyPart;
    };
    return Try;
  })();
  exports.Throw = (function() {
    Throw = (function() {
      return function Throw(_arg) {
        this.expression = _arg;
        Throw.__super__.constructor.call(this);
        return this;
      };
    })();
    __extends(Throw, Base);
    Throw.prototype.children = ['expression'];
    Throw.prototype.isStatement = YES;
    Throw.prototype.makeReturn = THIS;
    Throw.prototype.compileNode = function(o) {
      return "" + (this.tab) + "throw " + (this.expression.compile(o)) + ";";
    };
    return Throw;
  })();
  exports.Existence = (function() {
    Existence = (function() {
      return function Existence(_arg) {
        this.expression = _arg;
        Existence.__super__.constructor.call(this);
        return this;
      };
    })();
    __extends(Existence, Base);
    Existence.prototype.children = ['expression'];
    Existence.prototype.compileNode = function(o) {
      var code;
      code = this.expression.compile(o);
      code = IDENTIFIER.test(code) && !o.scope.check(code) ? ("typeof " + code + " !== \"undefined\" && " + code + " !== null") : ("" + code + " != null");
      return this.parenthetical ? code : ("(" + code + ")");
    };
    return Existence;
  })();
  exports.Parens = (function() {
    Parens = (function() {
      return function Parens(_arg) {
        this.expression = _arg;
        Parens.__super__.constructor.call(this);
        return this;
      };
    })();
    __extends(Parens, Base);
    Parens.prototype.children = ['expression'];
    Parens.prototype.isStatement = function(o) {
      return this.expression.isStatement(o);
    };
    Parens.prototype.isComplex = function() {
      return this.expression.isComplex();
    };
    Parens.prototype.topSensitive = YES;
    Parens.prototype.makeReturn = function() {
      return this.expression.makeReturn();
    };
    Parens.prototype.compileNode = function(o) {
      var code, top;
      top = del(o, 'top');
      this.expression.parenthetical = true;
      code = this.expression.compile(o);
      if (top && this.expression.isPureStatement(o)) {
        return code;
      }
      if (this.parenthetical || this.isStatement(o)) {
        return top ? this.tab + code + ';' : code;
      }
      return "(" + code + ")";
    };
    return Parens;
  })();
  exports.For = (function() {
    For = (function() {
      return function For(_arg, source, _arg2, _arg3) {
        var _ref2, _ref3;
        this.index = _arg3;
        this.name = _arg2;
        this.body = _arg;
        For.__super__.constructor.call(this);
        _ref2 = source, this.source = _ref2.source, this.guard = _ref2.guard, this.step = _ref2.step;
        this.raw = !!source.raw;
        this.object = !!source.object;
        if (this.object) {
          _ref3 = [this.index, this.name], this.name = _ref3[0], this.index = _ref3[1];
        }
        this.pattern = this.name instanceof Value;
        if (this.index instanceof Value) {
          throw new Error('index cannot be a pattern matching expression');
        }
        this.returns = false;
        return this;
      };
    })();
    __extends(For, Base);
    For.prototype.children = ['body', 'source', 'guard'];
    For.prototype.isStatement = YES;
    For.prototype.topSensitive = YES;
    For.prototype.makeReturn = function() {
      this.returns = true;
      return this;
    };
    For.prototype.compileReturnValue = function(val, o) {
      if (this.returns) {
        return '\n' + new Return(new Literal(val)).compile(o);
      }
      if (val) {
        return '\n' + val;
      }
      return '';
    };
    For.prototype.compileNode = function(o) {
      var _ref2, body, codeInBody, forPart, guardPart, idt, index, ivar, lvar, name, namePart, range, ref, resultPart, returnResult, rvar, scope, sourcePart, step, stepPart, stepVar, svar, topLevel, varPart, vars;
      scope = o.scope;
      topLevel = del(o, 'top') && !this.returns;
      codeInBody = this.body.contains(function(node) {
        return node instanceof Code;
      });
      range = this.source instanceof Range;
      name = this.name && this.name.compile(o);
      index = this.index && this.index.compile(o);
      if (name && !this.pattern && (range || !codeInBody)) {
        scope.find(name, {
          immediate: true
        });
      }
      if (index) {
        scope.find(index, {
          immediate: true
        });
      }
      if (!topLevel) {
        rvar = scope.freeVariable('result');
      }
      ivar = range ? name : index;
      if (!ivar || codeInBody) {
        ivar = scope.freeVariable('i');
      }
      varPart = '';
      guardPart = '';
      body = Expressions.wrap([this.body]);
      idt = this.idt(1);
      if (range) {
        forPart = this.source.compile(merge(o, {
          index: ivar
        }));
      } else {
        svar = (sourcePart = this.source.compile(o));
        if ((name || !this.raw) && !(IDENTIFIER.test(svar) && scope.check(svar, {
          immediate: true
        }))) {
          sourcePart = ("" + (ref = scope.freeVariable('ref')) + " = " + svar);
          if (!this.object) {
            sourcePart = ("(" + sourcePart + ")");
          }
          svar = ref;
        }
        namePart = this.pattern ? new Assign(this.name, new Literal("" + svar + "[" + ivar + "]")).compile(merge(o, {
          top: true
        })) : (name ? ("" + name + " = " + svar + "[" + ivar + "]") : undefined);
        if (!this.object) {
          lvar = scope.freeVariable('len');
          stepPart = (function() {
            if (this.step) {
              _ref2 = this.step.compileReference(o, {
                name: 'step',
                precompile: true
              }), step = _ref2[0], stepVar = _ref2[1];
              return "" + ivar + " += " + stepVar;
            } else {
              return "" + ivar + "++";
            }
          }).call(this);
          vars = ("" + ivar + " = 0, " + lvar + " = " + sourcePart + ".length");
          if (step !== stepVar) {
            vars += (", " + step);
          }
          forPart = ("" + vars + "; " + ivar + " < " + lvar + "; " + stepPart);
        }
      }
      resultPart = rvar ? ("" + (this.tab) + rvar + " = [];\n") : '';
      returnResult = this.compileReturnValue(rvar, o);
      if (!topLevel) {
        body = Push.wrap(rvar, body);
      }
      if (this.guard) {
        body = Expressions.wrap([new If(this.guard, body)]);
      }
      if (codeInBody) {
        if (range) {
          body.unshift(new Literal("var " + name + " = " + ivar));
        }
        if (namePart) {
          body.unshift(new Literal("var " + namePart));
        }
        if (index) {
          body.unshift(new Literal("var " + index + " = " + ivar));
        }
        body = Closure.wrap(body, true);
      } else {
        if (namePart) {
          varPart = ("" + idt + namePart + ";\n");
        }
      }
      if (this.object) {
        forPart = ("" + ivar + " in " + sourcePart);
        if (!this.raw) {
          guardPart = ("" + idt + "if (!" + (utility('hasProp')) + ".call(" + svar + ", " + ivar + ")) continue;\n");
        }
      }
      body = body.compile(merge(o, {
        indent: idt,
        top: true
      }));
      return "" + resultPart + (this.tab) + "for (" + forPart + ") {\n" + guardPart + varPart + body + "\n" + (this.tab) + "}" + returnResult;
    };
    return For;
  })();
  exports.Switch = (function() {
    Switch = (function() {
      return function Switch(_arg, _arg2, _arg3) {
        this.otherwise = _arg3;
        this.cases = _arg2;
        this.subject = _arg;
        Switch.__super__.constructor.call(this);
        this.tags.subjectless = !this.subject;
        this.subject || (this.subject = new Literal('true'));
        return this;
      };
    })();
    __extends(Switch, Base);
    Switch.prototype.children = ['subject', 'cases', 'otherwise'];
    Switch.prototype.isStatement = YES;
    Switch.prototype.makeReturn = function() {
      var _i, _len, _ref2, pair;
      for (_i = 0, _len = (_ref2 = this.cases).length; _i < _len; _i++) {
        pair = _ref2[_i];
        pair[1].makeReturn();
      }
      if (this.otherwise) {
        this.otherwise.makeReturn();
      }
      return this;
    };
    Switch.prototype.compileNode = function(o) {
      var _i, _j, _len, _len2, _ref2, _ref3, _ref4, block, code, condition, conditions, exprs, idt, pair;
      idt = (o.indent = this.idt(2));
      o.top = true;
      code = ("" + (this.tab) + "switch (" + (this.subject.compile(o)) + ") {");
      for (_i = 0, _len = (_ref2 = this.cases).length; _i < _len; _i++) {
        pair = _ref2[_i];
        _ref3 = pair, conditions = _ref3[0], block = _ref3[1];
        exprs = block.expressions;
        for (_j = 0, _len2 = (_ref4 = flatten([conditions])).length; _j < _len2; _j++) {
          condition = _ref4[_j];
          if (this.tags.subjectless) {
            condition = new Op('!!', new Parens(condition));
          }
          code += ("\n" + (this.idt(1)) + "case " + (condition.compile(o)) + ":");
        }
        code += ("\n" + (block.compile(o)));
        if (!(last(exprs) instanceof Return)) {
          code += ("\n" + idt + "break;");
        }
      }
      if (this.otherwise) {
        code += ("\n" + (this.idt(1)) + "default:\n" + (this.otherwise.compile(o)));
      }
      code += ("\n" + (this.tab) + "}");
      return code;
    };
    return Switch;
  })();
  exports.If = (function() {
    If = (function() {
      return function If(condition, _arg, _arg2) {
        var op;
        this.tags = _arg2;
        this.body = _arg;
        this.tags || (this.tags = {});
        if (this.tags.invert) {
          op = condition instanceof Op;
          if (op && condition.isInvertible()) {
            condition.invert();
          } else {
            if (op && !condition.isUnary()) {
              condition = new Parens(condition);
            }
            condition = new Op('!', condition);
          }
        }
        this.condition = condition;
        this.elseBody = null;
        this.isChain = false;
        return this;
      };
    })();
    __extends(If, Base);
    If.prototype.children = ['condition', 'body', 'elseBody', 'assigner'];
    If.prototype.topSensitive = YES;
    If.prototype.bodyNode = function() {
      var _ref2;
      return (((_ref2 = this.body) != null) ? _ref2.unwrap() : undefined);
    };
    If.prototype.elseBodyNode = function() {
      var _ref2;
      return (((_ref2 = this.elseBody) != null) ? _ref2.unwrap() : undefined);
    };
    If.prototype.addElse = function(elseBody, statement) {
      if (this.isChain) {
        this.elseBodyNode().addElse(elseBody, statement);
      } else {
        this.isChain = elseBody instanceof If;
        this.elseBody = this.ensureExpressions(elseBody);
      }
      return this;
    };
    If.prototype.isStatement = function(o) {
      return this.statement || (this.statement = !!((o && o.top) || this.bodyNode().isStatement(o) || (this.elseBody && this.elseBodyNode().isStatement(o))));
    };
    If.prototype.compileCondition = function(o) {
      var _i, _len, _result, cond, conditions;
      conditions = flatten([this.condition]);
      if (conditions.length === 1) {
        conditions[0].parenthetical = true;
      }
      return (function() {
        _result = [];
        for (_i = 0, _len = conditions.length; _i < _len; _i++) {
          cond = conditions[_i];
          _result.push(cond.compile(o));
        }
        return _result;
      })().join(' || ');
    };
    If.prototype.compileNode = function(o) {
      return this.isStatement(o) ? this.compileStatement(o) : this.compileExpression(o);
    };
    If.prototype.makeReturn = function() {
      if (this.isStatement()) {
        this.body && (this.body = this.ensureExpressions(this.body.makeReturn()));
        this.elseBody && (this.elseBody = this.ensureExpressions(this.elseBody.makeReturn()));
        return this;
      } else {
        return new Return(this);
      }
    };
    If.prototype.ensureExpressions = function(node) {
      return node instanceof Expressions ? node : new Expressions([node]);
    };
    If.prototype.compileStatement = function(o) {
      var body, child, comDent, condO, elsePart, ifDent, ifPart, top;
      top = del(o, 'top');
      child = del(o, 'chainChild');
      condO = merge(o);
      o.indent = this.idt(1);
      o.top = true;
      ifDent = child || (top && !this.isStatement(o)) ? '' : this.idt();
      comDent = child ? this.idt() : '';
      body = this.body.compile(o);
      ifPart = ("" + ifDent + "if (" + (this.compileCondition(condO)) + ") {\n" + body + "\n" + (this.tab) + "}");
      if (!this.elseBody) {
        return ifPart;
      }
      elsePart = this.isChain ? ' else ' + this.elseBodyNode().compile(merge(o, {
        indent: this.idt(),
        chainChild: true
      })) : (" else {\n" + (this.elseBody.compile(o)) + "\n" + (this.tab) + "}");
      return "" + ifPart + elsePart;
    };
    If.prototype.compileExpression = function(o) {
      var code, elsePart, ifPart;
      this.bodyNode().tags.operation = (this.condition.tags.operation = true);
      if (this.elseBody) {
        this.elseBodyNode().tags.operation = true;
      }
      ifPart = this.condition.compile(o) + ' ? ' + this.bodyNode().compile(o);
      elsePart = this.elseBody ? this.elseBodyNode().compile(o) : 'undefined';
      code = ("" + ifPart + " : " + elsePart);
      return this.tags.operation ? ("(" + code + ")") : code;
    };
    return If;
  })();
  Push = {
    wrap: function(name, expressions) {
      if (expressions.empty() || expressions.containsPureStatement()) {
        return expressions;
      }
      return Expressions.wrap([new Call(new Value(new Literal(name), [new Accessor(new Literal('push'))]), [expressions.unwrap()])]);
    }
  };
  Closure = {
    wrap: function(expressions, statement) {
      var args, call, func, mentionsArgs, meth;
      if (expressions.containsPureStatement()) {
        return expressions;
      }
      func = new Parens(new Code([], Expressions.wrap([expressions])));
      args = [];
      if ((mentionsArgs = expressions.contains(this.literalArgs)) || (expressions.contains(this.literalThis))) {
        meth = new Literal(mentionsArgs ? 'apply' : 'call');
        args = [new Literal('this')];
        if (mentionsArgs) {
          args.push(new Literal('arguments'));
        }
        func = new Value(func, [new Accessor(meth)]);
      }
      call = new Call(func, args);
      return statement ? Expressions.wrap([call]) : call;
    },
    literalArgs: function(node) {
      return node instanceof Literal && node.value === 'arguments';
    },
    literalThis: function(node) {
      return node instanceof Literal && node.value === 'this' || node instanceof Code && node.bound;
    }
  };
  UTILITIES = {
    "extends": 'function(child, parent) {\n  var ctor = function() {};\n  ctor.prototype = parent.prototype;\n  child.prototype = new ctor();\n  child.prototype.constructor = child;\n  if (typeof parent.extended === "function") parent.extended(child);\n  child.__super__ = parent.prototype;\n}',
    bind: 'function(func, context) {\n  return function() { return func.apply(context, arguments); };\n}',
    hasProp: 'Object.prototype.hasOwnProperty',
    slice: 'Array.prototype.slice'
  };
  TAB = '  ';
  TRAILING_WHITESPACE = /[ \t]+$/gm;
  IDENTIFIER = /^[$A-Za-z_][$\w]*$/;
  NUMBER = /^0x[\da-f]+|^(?:\d+(\.\d+)?|\.\d+)(?:e[+-]?\d+)?$/i;
  IS_STRING = /^['"]/;
  utility = function(name) {
    var ref;
    ref = ("__" + name);
    Scope.root.assign(ref, UTILITIES[name]);
    return ref;
  };
}).call(this);
