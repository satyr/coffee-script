(function() {
  var AccessorNode, ArrayNode, AssignNode, BaseNode, CallNode, ClassNode, ClosureNode, CodeNode, CommentNode, ExistenceNode, Expressions, ExtendsNode, ForNode, IDENTIFIER, IS_STRING, IfNode, InNode, IndexNode, LiteralNode, NUMBER, ObjectNode, OpNode, ParamNode, ParentheticalNode, PushNode, RangeNode, ReturnNode, SIMPLENUM, Scope, SliceNode, SplatNode, TAB, TRAILING_WHITESPACE, ThrowNode, TryNode, UTILITIES, ValueNode, WhileNode, _a, _b, _c, compact, del, ends, flatten, helpers, include, indexOf, literal, merge, starts, utility;
  var __extends = function(child, parent) {
    var ctor = function(){};
    ctor.prototype = parent.prototype;
    child.prototype = new ctor();
    child.prototype.constructor = child;
    if (typeof parent.extended === "function") parent.extended(child);
    child.__super__ = parent.prototype;
  };
  _a = require('./scope');
  Scope = _a.Scope;
  _b = require('./helpers');
  helpers = _b.helpers;
  _c = helpers;
  compact = _c.compact;
  flatten = _c.flatten;
  merge = _c.merge;
  del = _c.del;
  include = _c.include;
  indexOf = _c.indexOf;
  starts = _c.starts;
  ends = _c.ends;
  exports.BaseNode = (function() {
    BaseNode = function() {
      this.tags = {};
      return this;
    };
    BaseNode.prototype.compile = function(o) {
      var closure, top;
      this.options = merge(o || {});
      this.tab = o.indent;
      if (!(this instanceof AccessorNode || this instanceof IndexNode)) {
        del(this.options, 'chainRoot');
      }
      top = this.topSensitive() ? this.options.top : del(this.options, 'top');
      closure = this.isStatement(o) && !this.isPureStatement() && !top && !this.options.asStatement && !(this instanceof CommentNode) && !this.containsPureStatement();
      return closure ? this.compileClosure(this.options) : this.compileNode(this.options);
    };
    BaseNode.prototype.compileClosure = function(o) {
      this.tab = o.indent;
      o.sharedScope = o.scope;
      return ClosureNode.wrap(this).compile(o);
    };
    BaseNode.prototype.compileReference = function(o, options) {
      var compiled, pair, reference;
      options || (options = {});
      pair = (function() {
        if (!((this instanceof CallNode || this.contains(function(n) {
          return n instanceof CallNode;
        })) || (this instanceof ValueNode && (!(this.base instanceof LiteralNode) || this.hasProperties())))) {
          return [this, this];
        } else if (this instanceof ValueNode && options.assignment) {
          return this.cacheIndexes(o);
        } else {
          reference = literal(o.scope.freeVariable());
          compiled = new AssignNode(reference, this);
          return [compiled, reference];
        }
      }).call(this);
      if (options.precompile) {
        return [pair[0].compile(o), pair[1].compile(o)];
      }
      return pair;
    };
    BaseNode.prototype.idt = function(tabs) {
      var idt, num;
      idt = this.tab || '';
      num = (tabs || 0) + 1;
      while (num -= 1) {
        idt += TAB;
      }
      return idt;
    };
    BaseNode.prototype.makeReturn = function() {
      return new ReturnNode(this);
    };
    BaseNode.prototype.contains = function(block) {
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
    BaseNode.prototype.containsType = function(type) {
      return this instanceof type || this.contains(function(n) {
        return n instanceof type;
      });
    };
    BaseNode.prototype.containsPureStatement = function() {
      return this.isPureStatement() || this.contains(function(n) {
        return n.isPureStatement && n.isPureStatement();
      });
    };
    BaseNode.prototype.traverse = function(block) {
      return this.traverseChildren(true, block);
    };
    BaseNode.prototype.toString = function(idt, override) {
      var _d, _e, _f, _g, child, children;
      idt || (idt = '');
      children = (function() {
        _d = []; _f = this.collectChildren();
        for (_e = 0, _g = _f.length; _e < _g; _e++) {
          child = _f[_e];
          _d.push(child.toString(idt + TAB));
        }
        return _d;
      }).call(this).join('');
      return '\n' + idt + (override || this["class"]) + children;
    };
    BaseNode.prototype.eachChild = function(func) {
      var _d, _e, _f, _g, _h, _i, _j, attr, child;
      if (!(this.children)) {
        return null;
      }
      _d = []; _f = this.children;
      for (_e = 0, _g = _f.length; _e < _g; _e++) {
        attr = _f[_e];
        if (this[attr]) {
          _i = flatten([this[attr]]);
          for (_h = 0, _j = _i.length; _h < _j; _h++) {
            child = _i[_h];
            if (func(child) === false) {
              return null;
            }
          }
        }
      }
      return _d;
    };
    BaseNode.prototype.collectChildren = function() {
      var nodes;
      nodes = [];
      this.eachChild(function(node) {
        return nodes.push(node);
      });
      return nodes;
    };
    BaseNode.prototype.traverseChildren = function(crossScope, func) {
      return this.eachChild(function(child) {
        func.apply(this, arguments);
        if (child instanceof BaseNode) {
          return child.traverseChildren(crossScope, func);
        }
      });
    };
    BaseNode.prototype["class"] = 'BaseNode';
    BaseNode.prototype.children = [];
    BaseNode.prototype.unwrap = function() {
      return this;
    };
    BaseNode.prototype.isStatement = function() {
      return false;
    };
    BaseNode.prototype.isPureStatement = function() {
      return false;
    };
    BaseNode.prototype.topSensitive = function() {
      return false;
    };
    return BaseNode;
  })();
  exports.Expressions = (function() {
    Expressions = function(nodes) {
      Expressions.__super__.constructor.call(this);
      this.expressions = compact(flatten(nodes || []));
      return this;
    };
    __extends(Expressions, BaseNode);
    Expressions.prototype["class"] = 'Expressions';
    Expressions.prototype.children = ['expressions'];
    Expressions.prototype.isStatement = function() {
      return true;
    };
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
      var idx, last;
      idx = this.expressions.length - 1;
      last = this.expressions[idx];
      if (last instanceof CommentNode) {
        last = this.expressions[idx -= 1];
      }
      if (!last || last instanceof ReturnNode) {
        return this;
      }
      this.expressions[idx] = last.makeReturn();
      return this;
    };
    Expressions.prototype.compile = function(o) {
      o || (o = {});
      return o.scope ? Expressions.__super__.compile.call(this, o) : this.compileRoot(o);
    };
    Expressions.prototype.compileNode = function(o) {
      var _d, _e, _f, _g, node;
      return (function() {
        _d = []; _f = this.expressions;
        for (_e = 0, _g = _f.length; _e < _g; _e++) {
          node = _f[_e];
          _d.push(this.compileExpression(node, merge(o)));
        }
        return _d;
      }).call(this).join("\n");
    };
    Expressions.prototype.compileRoot = function(o) {
      var code;
      o.indent = (this.tab = o.noWrap ? '' : TAB);
      o.scope = new Scope(null, this, null);
      code = this.compileWithDeclarations(o);
      code = code.replace(TRAILING_WHITESPACE, '');
      return o.noWrap ? code : ("(function() {\n" + (code) + "\n}).call(this);\n");
    };
    Expressions.prototype.compileWithDeclarations = function(o) {
      var code;
      code = this.compileNode(o);
      if (o.scope.hasAssignments(this)) {
        code = ("" + (this.tab) + "var " + (o.scope.compiledAssignments()) + ";\n" + (code));
      }
      if (!o.globals && o.scope.hasDeclarations(this)) {
        code = ("" + (this.tab) + "var " + (o.scope.compiledDeclarations()) + ";\n" + (code));
      }
      return code;
    };
    Expressions.prototype.compileExpression = function(node, o) {
      var compiledNode;
      this.tab = o.indent;
      compiledNode = node.compile(merge(o, {
        top: true
      }));
      return node.isStatement(o) ? compiledNode : ("" + (this.idt()) + (compiledNode) + ";");
    };
    return Expressions;
  })();
  Expressions.wrap = function(nodes) {
    if (nodes.length === 1 && nodes[0] instanceof Expressions) {
      return nodes[0];
    }
    return new Expressions(nodes);
  };
  exports.LiteralNode = (function() {
    LiteralNode = function(_d) {
      this.value = _d;
      LiteralNode.__super__.constructor.call(this);
      return this;
    };
    __extends(LiteralNode, BaseNode);
    LiteralNode.prototype["class"] = 'LiteralNode';
    LiteralNode.prototype.makeReturn = function() {
      return this.isStatement() ? this : LiteralNode.__super__.makeReturn.call(this);
    };
    LiteralNode.prototype.isStatement = function() {
      return this.value === 'break' || this.value === 'continue';
    };
    LiteralNode.prototype.isPureStatement = LiteralNode.prototype.isStatement;
    LiteralNode.prototype.compileNode = function(o) {
      var end, idt;
      idt = this.isStatement(o) ? this.idt() : '';
      end = this.isStatement(o) ? ';' : '';
      return idt + this.value + end;
    };
    LiteralNode.prototype.toString = function(idt) {
      return '"' + this.value + '"';
    };
    return LiteralNode;
  })();
  exports.ReturnNode = (function() {
    ReturnNode = function(_d) {
      this.expression = _d;
      ReturnNode.__super__.constructor.call(this);
      return this;
    };
    __extends(ReturnNode, BaseNode);
    ReturnNode.prototype["class"] = 'ReturnNode';
    ReturnNode.prototype.isStatement = function() {
      return true;
    };
    ReturnNode.prototype.isPureStatement = function() {
      return true;
    };
    ReturnNode.prototype.children = ['expression'];
    ReturnNode.prototype.makeReturn = function() {
      return this;
    };
    ReturnNode.prototype.compile = function(o) {
      var expr;
      expr = this.expression.makeReturn();
      if (!(expr instanceof ReturnNode)) {
        return expr.compile(o);
      }
      return ReturnNode.__super__.compile.call(this, o);
    };
    ReturnNode.prototype.compileNode = function(o) {
      if (this.expression.isStatement(o)) {
        o.asStatement = true;
      }
      return "" + (this.tab) + "return " + (this.expression.compile(o)) + ";";
    };
    return ReturnNode;
  })();
  exports.ValueNode = (function() {
    ValueNode = function(_d, _e) {
      this.properties = _e;
      this.base = _d;
      ValueNode.__super__.constructor.call(this);
      this.properties || (this.properties = []);
      return this;
    };
    __extends(ValueNode, BaseNode);
    ValueNode.prototype["class"] = 'ValueNode';
    ValueNode.prototype.children = ['base', 'properties'];
    ValueNode.prototype.push = function(prop) {
      this.properties.push(prop);
      return this;
    };
    ValueNode.prototype.hasProperties = function() {
      return !!this.properties.length;
    };
    ValueNode.prototype.isArray = function() {
      return this.base instanceof ArrayNode && !this.hasProperties();
    };
    ValueNode.prototype.isObject = function() {
      return this.base instanceof ObjectNode && !this.hasProperties();
    };
    ValueNode.prototype.isSplice = function() {
      return this.hasProperties() && this.properties[this.properties.length - 1] instanceof SliceNode;
    };
    ValueNode.prototype.makeReturn = function() {
      return this.hasProperties() ? ValueNode.__super__.makeReturn.call(this) : this.base.makeReturn();
    };
    ValueNode.prototype.unwrap = function() {
      return this.properties.length ? this : this.base;
    };
    ValueNode.prototype.isStatement = function(o) {
      return this.base.isStatement && this.base.isStatement(o) && !this.hasProperties();
    };
    ValueNode.prototype.isNumber = function() {
      return this.base instanceof LiteralNode && this.base.value.match(NUMBER);
    };
    ValueNode.prototype.cacheIndexes = function(o) {
      var _d, _e, _f, copy, i;
      copy = new ValueNode(this.base, this.properties.slice(0));
      _e = copy.properties;
      for (_d = 0, _f = _e.length; _d < _f; _d++) {
        (function() {
          var _g, index, indexVar;
          var i = _d;
          var prop = _e[_d];
          if (prop instanceof IndexNode && prop.contains(function(n) {
            return n instanceof CallNode;
          })) {
            _g = prop.index.compileReference(o);
            index = _g[0];
            indexVar = _g[1];
            this.properties[i] = new IndexNode(index);
            return (copy.properties[i] = new IndexNode(indexVar));
          }
        }).call(this);
      }
      return [this, copy];
    };
    ValueNode.prototype.compile = function(o) {
      return !o.top || this.properties.length ? ValueNode.__super__.compile.call(this, o) : this.base.compile(o);
    };
    ValueNode.prototype.compileNode = function(o) {
      var _d, _e, _f, baseline, complete, i, only, op, props;
      only = del(o, 'onlyFirst');
      op = this.tags.operation;
      props = only ? this.properties.slice(0, this.properties.length - 1) : this.properties;
      o.chainRoot || (o.chainRoot = this);
      if (this.parenthetical && !props.length) {
        this.base.parenthetical = true;
      }
      baseline = this.base.compile(o);
      if (this.hasProperties() && (this.base instanceof ObjectNode || this.isNumber())) {
        baseline = ("(" + (baseline) + ")");
      }
      complete = (this.last = baseline);
      _e = props;
      for (_d = 0, _f = _e.length; _d < _f; _d++) {
        (function() {
          var part, temp;
          var i = _d;
          var prop = _e[_d];
          this.source = baseline;
          if (prop.soakNode) {
            if (this.base instanceof CallNode || this.base.contains(function(n) {
              return n instanceof CallNode;
            }) && i === 0) {
              temp = o.scope.freeVariable();
              complete = ("(" + (baseline = temp) + " = (" + (complete) + "))");
            }
            complete = i === 0 ? ("(typeof " + (complete) + " === \"undefined\" || " + (baseline) + " === null) ? undefined : ") : ("" + (complete) + " == null ? undefined : ");
            return complete += (baseline += prop.compile(o));
          } else {
            part = prop.compile(o);
            baseline += part;
            complete += part;
            return (this.last = part);
          }
        }).call(this);
      }
      return op && this.wrapped ? ("(" + (complete) + ")") : complete;
    };
    return ValueNode;
  })();
  exports.CommentNode = (function() {
    CommentNode = function(_d) {
      this.comment = _d;
      CommentNode.__super__.constructor.call(this);
      return this;
    };
    __extends(CommentNode, BaseNode);
    CommentNode.prototype["class"] = 'CommentNode';
    CommentNode.prototype.isStatement = function() {
      return true;
    };
    CommentNode.prototype.makeReturn = function() {
      return this;
    };
    CommentNode.prototype.compileNode = function(o) {
      return this.tab + '/*' + this.comment.replace(/\r?\n/g, '\n' + this.tab) + '*/';
    };
    return CommentNode;
  })();
  exports.CallNode = (function() {
    CallNode = function(variable, _d) {
      this.args = _d;
      CallNode.__super__.constructor.call(this);
      this.isNew = false;
      this.isSuper = variable === 'super';
      this.variable = this.isSuper ? null : variable;
      this.args || (this.args = []);
      this.compileSplatArguments = function(o) {
        return SplatNode.compileSplattedArray.call(this, this.args, o);
      };
      return this;
    };
    __extends(CallNode, BaseNode);
    CallNode.prototype["class"] = 'CallNode';
    CallNode.prototype.children = ['variable', 'args'];
    CallNode.prototype.newInstance = function() {
      this.isNew = true;
      return this;
    };
    CallNode.prototype.prefix = function() {
      return this.isNew ? 'new ' : '';
    };
    CallNode.prototype.superReference = function(o) {
      var meth, methname;
      methname = o.scope.method.name;
      return (meth = (function() {
        if (o.scope.method.proto) {
          return "" + (o.scope.method.proto) + ".__super__." + (methname);
        } else if (methname) {
          return "" + (methname) + ".__super__.constructor";
        } else {
          throw new Error("cannot call super on an anonymous function.");
        }
      })());
    };
    CallNode.prototype.compileNode = function(o) {
      var _d, _e, _f, _g, _h, _i, _j, arg, args, compilation;
      if (!(o.chainRoot)) {
        o.chainRoot = this;
      }
      _e = this.args;
      for (_d = 0, _f = _e.length; _d < _f; _d++) {
        arg = _e[_d];
        if (arg instanceof SplatNode) {
          compilation = this.compileSplat(o);
        }
      }
      if (!compilation) {
        args = (function() {
          _g = []; _i = this.args;
          for (_h = 0, _j = _i.length; _h < _j; _h++) {
            arg = _i[_h];
            _g.push((function() {
              arg.parenthetical = true;
              return arg.compile(o);
            })());
          }
          return _g;
        }).call(this);
        compilation = this.isSuper ? this.compileSuper(args.join(', '), o) : ("" + (this.prefix()) + (this.variable.compile(o)) + "(" + (args.join(', ')) + ")");
      }
      return compilation;
    };
    CallNode.prototype.compileSuper = function(args, o) {
      return "" + (this.superReference(o)) + ".call(this" + (args.length ? ', ' : '') + (args) + ")";
    };
    CallNode.prototype.compileSplat = function(o) {
      var meth, obj, temp;
      meth = this.variable ? this.variable.compile(o) : this.superReference(o);
      obj = this.variable && this.variable.source || 'this';
      if (obj.match(/\(/)) {
        temp = o.scope.freeVariable();
        obj = temp;
        meth = ("(" + (temp) + " = " + (this.variable.source) + ")" + (this.variable.last));
      }
      if (this.isNew) {
        utility('extends');
        return "(function() {\n" + (this.idt(1)) + "var ctor = function(){};\n" + (this.idt(1)) + "__extends(ctor, " + (meth) + ");\n" + (this.idt(1)) + "return " + (meth) + ".apply(new ctor, " + (this.compileSplatArguments(o)) + ");\n" + (this.tab) + "}).call(this)";
      } else {
        return "" + (this.prefix()) + (meth) + ".apply(" + (obj) + ", " + (this.compileSplatArguments(o)) + ")";
      }
    };
    return CallNode;
  })();
  exports.ExtendsNode = (function() {
    ExtendsNode = function(_d, _e) {
      this.parent = _e;
      this.child = _d;
      ExtendsNode.__super__.constructor.call(this);
      return this;
    };
    __extends(ExtendsNode, BaseNode);
    ExtendsNode.prototype["class"] = 'ExtendsNode';
    ExtendsNode.prototype.children = ['child', 'parent'];
    ExtendsNode.prototype.compileNode = function(o) {
      var ref;
      ref = new ValueNode(literal(utility('extends')));
      return (new CallNode(ref, [this.child, this.parent])).compile(o);
    };
    return ExtendsNode;
  })();
  exports.AccessorNode = (function() {
    AccessorNode = function(_d, tag) {
      this.name = _d;
      AccessorNode.__super__.constructor.call(this);
      this.prototype = tag === 'prototype' ? '.prototype' : '';
      this.soakNode = tag === 'soak';
      return this;
    };
    __extends(AccessorNode, BaseNode);
    AccessorNode.prototype["class"] = 'AccessorNode';
    AccessorNode.prototype.children = ['name'];
    AccessorNode.prototype.compileNode = function(o) {
      var name, namePart;
      name = this.name.compile(o);
      o.chainRoot.wrapped || (o.chainRoot.wrapped = this.soakNode);
      namePart = name.match(IS_STRING) ? ("[" + (name) + "]") : ("." + (name));
      return this.prototype + namePart;
    };
    return AccessorNode;
  })();
  exports.IndexNode = (function() {
    IndexNode = function(_d) {
      this.index = _d;
      IndexNode.__super__.constructor.call(this);
      return this;
    };
    __extends(IndexNode, BaseNode);
    IndexNode.prototype["class"] = 'IndexNode';
    IndexNode.prototype.children = ['index'];
    IndexNode.prototype.compileNode = function(o) {
      var idx, prefix;
      o.chainRoot.wrapped || (o.chainRoot.wrapped = this.soakNode);
      idx = this.index.compile(o);
      prefix = this.proto ? '.prototype' : '';
      return "" + (prefix) + "[" + (idx) + "]";
    };
    return IndexNode;
  })();
  exports.RangeNode = (function() {
    RangeNode = function(_d, _e, exclusive) {
      this.to = _e;
      this.from = _d;
      RangeNode.__super__.constructor.call(this);
      this.exclusive = !!exclusive;
      this.equals = this.exclusive ? '' : '=';
      return this;
    };
    __extends(RangeNode, BaseNode);
    RangeNode.prototype["class"] = 'RangeNode';
    RangeNode.prototype.children = ['from', 'to'];
    RangeNode.prototype.compileVariables = function(o) {
      var _d, _e, _f, parts;
      o = merge(o, {
        top: true
      });
      _d = this.from.compileReference(o, {
        precompile: true
      });
      this.from = _d[0];
      this.fromVar = _d[1];
      _e = this.to.compileReference(o, {
        precompile: true
      });
      this.to = _e[0];
      this.toVar = _e[1];
      _f = [this.fromVar.match(SIMPLENUM), this.toVar.match(SIMPLENUM)];
      this.fromNum = _f[0];
      this.toNum = _f[1];
      parts = [];
      if (this.from !== this.fromVar) {
        parts.push(this.from);
      }
      if (this.to !== this.toVar) {
        parts.push(this.to);
      }
      return parts.length ? ("" + (parts.join('; ')) + "; ") : '';
    };
    RangeNode.prototype.compileNode = function(o) {
      var compare, idx, incr, intro, step, stepPart, vars;
      if (!(o.index)) {
        return this.compileArray(o);
      }
      if (this.fromNum && this.toNum) {
        return this.compileSimple(o);
      }
      idx = del(o, 'index');
      step = del(o, 'step');
      vars = ("" + (idx) + " = " + (this.fromVar));
      intro = ("(" + (this.fromVar) + " <= " + (this.toVar) + " ? " + (idx));
      compare = ("" + (intro) + " <" + (this.equals) + " " + (this.toVar) + " : " + (idx) + " >" + (this.equals) + " " + (this.toVar) + ")");
      stepPart = step ? step.compile(o) : '1';
      incr = step ? ("" + (idx) + " += " + (stepPart)) : ("" + (intro) + " += " + (stepPart) + " : " + (idx) + " -= " + (stepPart) + ")");
      return "" + (vars) + "; " + (compare) + "; " + (incr);
    };
    RangeNode.prototype.compileSimple = function(o) {
      var _d, from, idx, step, to;
      _d = [parseInt(this.fromNum, 10), parseInt(this.toNum, 10)];
      from = _d[0];
      to = _d[1];
      idx = del(o, 'index');
      step = del(o, 'step');
      step && (step = ("" + (idx) + " += " + (step.compile(o))));
      return from <= to ? ("" + (idx) + " = " + (from) + "; " + (idx) + " <" + (this.equals) + " " + (to) + "; " + (step || ("" + (idx) + "++"))) : ("" + (idx) + " = " + (from) + "; " + (idx) + " >" + (this.equals) + " " + (to) + "; " + (step || ("" + (idx) + "--")));
    };
    RangeNode.prototype.compileArray = function(o) {
      var _d, _e, body, clause, i, idt, post, pre, range, result, vars;
      idt = this.idt(1);
      vars = this.compileVariables(merge(o, {
        indent: idt
      }));
      if (this.fromNum && this.toNum && (Math.abs(+this.fromNum - +this.toNum) <= 20)) {
        range = (function() {
          _e = [];
          for (var _d = +this.fromNum; +this.fromNum <= +this.toNum ? _d <= +this.toNum : _d >= +this.toNum; +this.fromNum <= +this.toNum ? _d += 1 : _d -= 1){ _e.push(_d); }
          return _e;
        }).call(this);
        if (this.exclusive) {
          range.pop();
        }
        return ("[" + (range.join(', ')) + "]");
      }
      i = o.scope.freeVariable();
      result = o.scope.freeVariable();
      pre = ("\n" + (idt) + (result) + " = []; " + (vars));
      if (this.fromNum && this.toNum) {
        o.index = i;
        body = this.compileSimple(o);
      } else {
        clause = ("" + (this.fromVar) + " <= " + (this.toVar) + " ?");
        body = ("var " + (i) + " = " + (this.fromVar) + "; " + (clause) + " " + (i) + " <" + (this.equals) + " " + (this.toVar) + " : " + (i) + " >" + (this.equals) + " " + (this.toVar) + "; " + (clause) + " " + (i) + " += 1 : " + (i) + " -= 1");
      }
      post = ("{ " + (result) + ".push(" + (i) + "); }\n" + (idt) + "return " + (result) + ";\n" + (o.indent));
      return "(function() {" + (pre) + "\n" + (idt) + "for (" + (body) + ")" + (post) + "}).call(this)";
    };
    return RangeNode;
  })();
  exports.SliceNode = (function() {
    SliceNode = function(_d) {
      this.range = _d;
      SliceNode.__super__.constructor.call(this);
      return this;
    };
    __extends(SliceNode, BaseNode);
    SliceNode.prototype["class"] = 'SliceNode';
    SliceNode.prototype.children = ['range'];
    SliceNode.prototype.compileNode = function(o) {
      var from, to;
      from = this.range.from ? this.range.from.compile(o) : '0';
      to = this.range.to ? this.range.to.compile(o) : '';
      to += (!to || this.range.exclusive ? '' : ' + 1');
      if (to) {
        to = ', ' + to;
      }
      return ".slice(" + (from) + (to) + ")";
    };
    return SliceNode;
  })();
  exports.ObjectNode = (function() {
    ObjectNode = function(props) {
      ObjectNode.__super__.constructor.call(this);
      this.objects = (this.properties = props || []);
      return this;
    };
    __extends(ObjectNode, BaseNode);
    ObjectNode.prototype["class"] = 'ObjectNode';
    ObjectNode.prototype.children = ['properties'];
    ObjectNode.prototype.topSensitive = function() {
      return true;
    };
    ObjectNode.prototype.compileNode = function(o) {
      var _d, _e, _f, _g, _h, _i, _j, i, indent, join, lastNoncom, nonComments, obj, prop, props, top;
      top = del(o, 'top');
      o.indent = this.idt(1);
      nonComments = (function() {
        _d = []; _f = this.properties;
        for (_e = 0, _g = _f.length; _e < _g; _e++) {
          prop = _f[_e];
          if (!(prop instanceof CommentNode)) {
            _d.push(prop);
          }
        }
        return _d;
      }).call(this);
      lastNoncom = nonComments[nonComments.length - 1];
      props = (function() {
        _h = []; _i = this.properties;
        for (i = 0, _j = _i.length; i < _j; i++) {
          prop = _i[i];
          _h.push((function() {
            join = ",\n";
            if ((prop === lastNoncom) || (prop instanceof CommentNode)) {
              join = "\n";
            }
            if (i === this.properties.length - 1) {
              join = '';
            }
            indent = prop instanceof CommentNode ? '' : this.idt(1);
            if (!(prop instanceof AssignNode || prop instanceof CommentNode)) {
              prop = new AssignNode(prop, prop, 'object');
            }
            return indent + prop.compile(o) + join;
          }).call(this));
        }
        return _h;
      }).call(this);
      props = props.join('');
      obj = '{' + (props ? '\n' + props + '\n' + this.idt() : '') + '}';
      return top ? ("(" + (obj) + ")") : obj;
    };
    return ObjectNode;
  })();
  exports.ArrayNode = (function() {
    ArrayNode = function(_d) {
      this.objects = _d;
      ArrayNode.__super__.constructor.call(this);
      this.objects || (this.objects = []);
      this.compileSplatLiteral = function(o) {
        return SplatNode.compileSplattedArray.call(this, this.objects, o);
      };
      return this;
    };
    __extends(ArrayNode, BaseNode);
    ArrayNode.prototype["class"] = 'ArrayNode';
    ArrayNode.prototype.children = ['objects'];
    ArrayNode.prototype.compileNode = function(o) {
      var _d, _e, code, i, obj, objects;
      o.indent = this.idt(1);
      objects = [];
      _d = this.objects;
      for (i = 0, _e = _d.length; i < _e; i++) {
        obj = _d[i];
        code = obj.compile(o);
        if (obj instanceof SplatNode) {
          return this.compileSplatLiteral(o);
        } else if (obj instanceof CommentNode) {
          objects.push("\n" + (code) + "\n" + (o.indent));
        } else if (i === this.objects.length - 1) {
          objects.push(code);
        } else {
          objects.push("" + (code) + ", ");
        }
      }
      objects = objects.join('');
      return indexOf(objects, '\n') >= 0 ? ("[\n" + (this.idt(1)) + (objects) + "\n" + (this.tab) + "]") : ("[" + (objects) + "]");
    };
    return ArrayNode;
  })();
  exports.ClassNode = (function() {
    ClassNode = function(_d, _e, _f) {
      this.properties = _f;
      this.parent = _e;
      this.variable = _d;
      ClassNode.__super__.constructor.call(this);
      this.properties || (this.properties = []);
      this.returns = false;
      return this;
    };
    __extends(ClassNode, BaseNode);
    ClassNode.prototype["class"] = 'ClassNode';
    ClassNode.prototype.children = ['variable', 'parent', 'properties'];
    ClassNode.prototype.isStatement = function() {
      return true;
    };
    ClassNode.prototype.makeReturn = function() {
      this.returns = true;
      return this;
    };
    ClassNode.prototype.compileNode = function(o) {
      var _d, _e, _f, _g, access, applied, className, constScope, construct, constructor, extension, func, me, pname, prop, props, pvar, returns, val;
      if (this.variable === '__temp__') {
        this.variable = literal(o.scope.freeVariable());
      }
      extension = this.parent && new ExtendsNode(this.variable, this.parent);
      props = new Expressions();
      o.top = true;
      me = null;
      className = this.variable.compile(o);
      constScope = null;
      if (this.parent) {
        applied = new ValueNode(this.parent, [new AccessorNode(literal('apply'))]);
        constructor = new CodeNode([], new Expressions([new CallNode(applied, [literal('this'), literal('arguments')])]));
      } else {
        constructor = new CodeNode();
      }
      _e = this.properties;
      for (_d = 0, _f = _e.length; _d < _f; _d++) {
        prop = _e[_d];
        _g = [prop.variable, prop.value];
        pvar = _g[0];
        func = _g[1];
        if (pvar && pvar.base.value === 'constructor' && func instanceof CodeNode) {
          if (func.bound) {
            throw new Error("cannot define a constructor as a bound function.");
          }
          func.name = className;
          func.body.push(new ReturnNode(literal('this')));
          this.variable = new ValueNode(this.variable);
          this.variable.namespaced = include(func.name, '.');
          constructor = func;
          continue;
        }
        if (func instanceof CodeNode && func.bound) {
          if (prop.context === 'this') {
            func.context = className;
          } else {
            func.bound = false;
            constScope || (constScope = new Scope(o.scope, constructor.body, constructor));
            me || (me = constScope.freeVariable());
            pname = pvar.compile(o);
            if (constructor.body.empty()) {
              constructor.body.push(new ReturnNode(literal('this')));
            }
            constructor.body.unshift(literal("this." + (pname) + " = function(){ return " + (className) + ".prototype." + (pname) + ".apply(" + (me) + ", arguments); }"));
          }
        }
        if (pvar) {
          access = prop.context === 'this' ? pvar.base.properties[0] : new AccessorNode(pvar, 'prototype');
          val = new ValueNode(this.variable, [access]);
          prop = new AssignNode(val, func);
        }
        props.push(prop);
      }
      if (me) {
        constructor.body.unshift(literal("" + (me) + " = this"));
      }
      construct = this.idt() + (new AssignNode(this.variable, constructor)).compile(merge(o, {
        sharedScope: constScope
      })) + ';';
      props = !props.empty() ? '\n' + props.compile(o) : '';
      extension = extension ? '\n' + this.idt() + extension.compile(o) + ';' : '';
      returns = this.returns ? '\n' + new ReturnNode(this.variable).compile(o) : '';
      return construct + extension + props + returns;
    };
    return ClassNode;
  })();
  exports.AssignNode = (function() {
    AssignNode = function(_d, _e, _f) {
      this.context = _f;
      this.value = _e;
      this.variable = _d;
      AssignNode.__super__.constructor.call(this);
      return this;
    };
    __extends(AssignNode, BaseNode);
    AssignNode.prototype.PROTO_ASSIGN = /^(\S+)\.prototype/;
    AssignNode.prototype.LEADING_DOT = /^\.(prototype\.)?/;
    AssignNode.prototype["class"] = 'AssignNode';
    AssignNode.prototype.children = ['variable', 'value'];
    AssignNode.prototype.topSensitive = function() {
      return true;
    };
    AssignNode.prototype.isValue = function() {
      return this.variable instanceof ValueNode;
    };
    AssignNode.prototype.makeReturn = function() {
      if (this.isStatement()) {
        return new Expressions([this, new ReturnNode(this.variable)]);
      } else {
        return AssignNode.__super__.makeReturn.call(this);
      }
    };
    AssignNode.prototype.isStatement = function() {
      return this.isValue() && (this.variable.isArray() || this.variable.isObject());
    };
    AssignNode.prototype.compileNode = function(o) {
      var last, match, name, proto, stmt, top, val;
      top = del(o, 'top');
      if (this.isStatement(o)) {
        return this.compilePatternMatch(o);
      }
      if (this.isValue() && this.variable.isSplice()) {
        return this.compileSplice(o);
      }
      stmt = del(o, 'asStatement');
      name = this.variable.compile(o);
      last = this.isValue() ? this.variable.last.replace(this.LEADING_DOT, '') : name;
      match = name.match(this.PROTO_ASSIGN);
      proto = match && match[1];
      if (this.value instanceof CodeNode) {
        if (last.match(IDENTIFIER)) {
          this.value.name = last;
        }
        if (proto) {
          this.value.proto = proto;
        }
      }
      val = this.value.compile(o);
      if (this.context === 'object') {
        return ("" + (name) + ": " + (val));
      }
      if (!(this.isValue() && (this.variable.hasProperties() || this.variable.namespaced))) {
        o.scope.find(name);
      }
      val = ("" + (name) + " = " + (val));
      if (stmt) {
        return ("" + (this.tab) + (val) + ";");
      }
      return top || this.parenthetical ? val : ("(" + (val) + ")");
    };
    AssignNode.prototype.compilePatternMatch = function(o) {
      var _d, _e, _f, accessClass, assigns, code, i, idx, isString, obj, oindex, olength, splat, val, valVar, value;
      valVar = o.scope.freeVariable();
      value = this.value.isStatement(o) ? ClosureNode.wrap(this.value) : this.value;
      assigns = [("" + (this.tab) + (valVar) + " = " + (value.compile(o)) + ";")];
      o.top = true;
      o.asStatement = true;
      splat = false;
      _d = this.variable.base.objects;
      for (i = 0, _e = _d.length; i < _e; i++) {
        obj = _d[i];
        idx = i;
        if (this.variable.isObject()) {
          if (obj instanceof AssignNode) {
            _f = [obj.value, obj.variable.base];
            obj = _f[0];
            idx = _f[1];
          } else {
            idx = obj;
          }
        }
        if (!(obj instanceof ValueNode || obj instanceof SplatNode)) {
          throw new Error('pattern matching must use only identifiers on the left-hand side.');
        }
        isString = idx.value && idx.value.match(IS_STRING);
        accessClass = isString || this.variable.isArray() ? IndexNode : AccessorNode;
        if (obj instanceof SplatNode && !splat) {
          val = literal(obj.compileValue(o, valVar, oindex = indexOf(this.variable.base.objects, obj), (olength = this.variable.base.objects.length) - oindex - 1));
          splat = true;
        } else {
          if (typeof idx !== 'object') {
            idx = literal(splat ? ("" + (valVar) + ".length - " + (olength - idx)) : idx);
          }
          val = new ValueNode(literal(valVar), [new accessClass(idx)]);
        }
        assigns.push(new AssignNode(obj, val).compile(o));
      }
      code = assigns.join("\n");
      return code;
    };
    AssignNode.prototype.compileSplice = function(o) {
      var from, l, name, plus, range, to, val;
      name = this.variable.compile(merge(o, {
        onlyFirst: true
      }));
      l = this.variable.properties.length;
      range = this.variable.properties[l - 1].range;
      plus = range.exclusive ? '' : ' + 1';
      from = range.from ? range.from.compile(o) : '0';
      to = range.to ? range.to.compile(o) + ' - ' + from + plus : ("" + (name) + ".length");
      val = this.value.compile(o);
      return "" + (name) + ".splice.apply(" + (name) + ", [" + (from) + ", " + (to) + "].concat(" + (val) + "))";
    };
    return AssignNode;
  })();
  exports.CodeNode = (function() {
    CodeNode = function(_d, _e, tag) {
      this.body = _e;
      this.params = _d;
      CodeNode.__super__.constructor.call(this);
      this.params || (this.params = []);
      this.body || (this.body = new Expressions());
      this.bound = tag === 'boundfunc';
      if (this.bound) {
        this.context = 'this';
      }
      return this;
    };
    __extends(CodeNode, BaseNode);
    CodeNode.prototype["class"] = 'CodeNode';
    CodeNode.prototype.children = ['params', 'body'];
    CodeNode.prototype.compileNode = function(o) {
      var _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, code, empty, func, i, param, params, sharedScope, splat, top, value;
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
      _d = this.params;
      for (i = 0, _e = _d.length; i < _e; i++) {
        param = _d[i];
        if (splat) {
          if (param.attach) {
            param.assign = new AssignNode(new ValueNode(literal('this'), [new AccessorNode(param.value)]));
            this.body.expressions.splice(splat.index + 1, 0, param.assign);
          }
          splat.trailings.push(param);
        } else {
          if (param.attach) {
            _f = param;
            value = _f.value;
            _g = [literal(o.scope.freeVariable()), param.splat];
            param = _g[0];
            param.splat = _g[1];
            this.body.unshift(new AssignNode(new ValueNode(literal('this'), [new AccessorNode(value)]), param));
          }
          if (param.splat) {
            splat = new SplatNode(param.value);
            splat.index = i;
            splat.trailings = [];
            splat.arglength = this.params.length;
            this.body.unshift(splat);
          } else {
            params.push(param);
          }
        }
      }
      params = (function() {
        _h = []; _j = params;
        for (_i = 0, _k = _j.length; _i < _k; _i++) {
          param = _j[_i];
          _h.push(param.compile(o));
        }
        return _h;
      })();
      if (!(empty)) {
        this.body.makeReturn();
      }
      _m = params;
      for (_l = 0, _n = _m.length; _l < _n; _l++) {
        param = _m[_l];
        (o.scope.parameter(param));
      }
      code = this.body.expressions.length ? ("\n" + (this.body.compileWithDeclarations(o)) + "\n") : '';
      func = ("function(" + (params.join(', ')) + ") {" + (code) + (code && this.tab) + "}");
      if (this.bound) {
        return ("" + (utility('bind')) + "(" + (func) + ", " + (this.context) + ")");
      }
      return top ? ("(" + (func) + ")") : func;
    };
    CodeNode.prototype.topSensitive = function() {
      return true;
    };
    CodeNode.prototype.traverseChildren = function(crossScope, func) {
      if (crossScope) {
        return CodeNode.__super__.traverseChildren.call(this, crossScope, func);
      }
    };
    CodeNode.prototype.toString = function(idt) {
      var _d, _e, _f, _g, child, children;
      idt || (idt = '');
      children = (function() {
        _d = []; _f = this.collectChildren();
        for (_e = 0, _g = _f.length; _e < _g; _e++) {
          child = _f[_e];
          _d.push(child.toString(idt + TAB));
        }
        return _d;
      }).call(this).join('');
      return '\n' + idt + children;
    };
    return CodeNode;
  })();
  exports.ParamNode = (function() {
    ParamNode = function(_d, _e, _f) {
      this.splat = _f;
      this.attach = _e;
      this.name = _d;
      ParamNode.__super__.constructor.call(this);
      this.value = literal(this.name);
      return this;
    };
    __extends(ParamNode, BaseNode);
    ParamNode.prototype["class"] = 'ParamNode';
    ParamNode.prototype.children = ['name'];
    ParamNode.prototype.compileNode = function(o) {
      return this.value.compile(o);
    };
    ParamNode.prototype.toString = function(idt) {
      return this.attach ? (literal('@' + this.name)).toString(idt) : this.value.toString(idt);
    };
    return ParamNode;
  })();
  exports.SplatNode = (function() {
    SplatNode = function(name) {
      SplatNode.__super__.constructor.call(this);
      if (!(name.compile)) {
        name = literal(name);
      }
      this.name = name;
      return this;
    };
    __extends(SplatNode, BaseNode);
    SplatNode.prototype["class"] = 'SplatNode';
    SplatNode.prototype.children = ['name'];
    SplatNode.prototype.compileNode = function(o) {
      var _d;
      return (typeof (_d = this.index) !== "undefined" && _d !== null) ? this.compileParam(o) : this.name.compile(o);
    };
    SplatNode.prototype.compileParam = function(o) {
      var _d, _e, assign, end, idx, len, name, pos, trailing, variadic;
      name = this.name.compile(o);
      o.scope.find(name);
      end = '';
      if (this.trailings.length) {
        len = o.scope.freeVariable();
        o.scope.assign(len, "arguments.length");
        variadic = o.scope.freeVariable();
        o.scope.assign(variadic, len + ' >= ' + this.arglength);
        end = this.trailings.length ? (", " + (len) + " - " + (this.trailings.length)) : null;
        _d = this.trailings;
        for (idx = 0, _e = _d.length; idx < _e; idx++) {
          trailing = _d[idx];
          if (trailing.attach) {
            assign = trailing.assign;
            trailing = literal(o.scope.freeVariable());
            assign.value = trailing;
          }
          pos = this.trailings.length - idx;
          o.scope.assign(trailing.compile(o), "arguments[" + (variadic) + " ? " + (len) + " - " + (pos) + " : " + (this.index + idx) + "]");
        }
      }
      return "" + (name) + " = " + (utility('slice')) + ".call(arguments, " + (this.index) + (end) + ")";
    };
    SplatNode.prototype.compileValue = function(o, name, index, trailings) {
      var trail;
      trail = trailings ? (", " + (name) + ".length - " + (trailings)) : '';
      return "" + (utility('slice')) + ".call(" + (name) + ", " + (index) + (trail) + ")";
    };
    SplatNode.compileSplattedArray = function(list, o) {
      var _d, _e, arg, args, code, i, last, prev;
      args = [];
      _d = list;
      for (i = 0, _e = _d.length; i < _e; i++) {
        arg = _d[i];
        code = arg.compile(o);
        prev = args[(last = args.length - 1)];
        if (!(arg instanceof SplatNode)) {
          if (prev && starts(prev, '[') && ends(prev, ']')) {
            args[last] = ("" + (prev.substr(0, prev.length - 1)) + ", " + (code) + "]");
            continue;
          } else if (prev && starts(prev, '.concat([') && ends(prev, '])')) {
            args[last] = ("" + (prev.substr(0, prev.length - 2)) + ", " + (code) + "])");
            continue;
          } else {
            code = ("[" + (code) + "]");
          }
        }
        args.push(i === 0 ? code : (".concat(" + (code) + ")"));
      }
      return args.join('');
    };
    return SplatNode;
  }).call(this);
  exports.WhileNode = (function() {
    WhileNode = function(condition, opts) {
      WhileNode.__super__.constructor.call(this);
      if (opts && opts.invert) {
        if (condition instanceof OpNode) {
          condition = new ParentheticalNode(condition);
        }
        condition = new OpNode('!', condition);
      }
      this.condition = condition;
      this.guard = opts && opts.guard;
      return this;
    };
    __extends(WhileNode, BaseNode);
    WhileNode.prototype["class"] = 'WhileNode';
    WhileNode.prototype.children = ['condition', 'guard', 'body'];
    WhileNode.prototype.isStatement = function() {
      return true;
    };
    WhileNode.prototype.addBody = function(body) {
      this.body = body;
      return this;
    };
    WhileNode.prototype.makeReturn = function() {
      this.returns = true;
      return this;
    };
    WhileNode.prototype.topSensitive = function() {
      return true;
    };
    WhileNode.prototype.compileNode = function(o) {
      var cond, post, pre, rvar, set, top;
      top = del(o, 'top') && !this.returns;
      o.indent = this.idt(1);
      o.top = true;
      this.condition.parenthetical = true;
      cond = this.condition.compile(o);
      set = '';
      if (!(top)) {
        rvar = o.scope.freeVariable();
        set = ("" + (this.tab) + (rvar) + " = [];\n");
        if (this.body) {
          this.body = PushNode.wrap(rvar, this.body);
        }
      }
      pre = ("" + (set) + (this.tab) + "while (" + (cond) + ")");
      if (this.guard) {
        this.body = Expressions.wrap([new IfNode(this.guard, this.body)]);
      }
      if (this.returns) {
        post = '\n' + new ReturnNode(literal(rvar)).compile(merge(o, {
          indent: this.idt()
        }));
      } else {
        post = '';
      }
      return "" + (pre) + " {\n" + (this.body.compile(o)) + "\n" + (this.tab) + "}" + (post);
    };
    return WhileNode;
  })();
  exports.OpNode = (function() {
    OpNode = function(_d, _e, _f, flip) {
      this.second = _f;
      this.first = _e;
      this.operator = _d;
      OpNode.__super__.constructor.call(this);
      this.operator = this.CONVERSIONS[this.operator] || this.operator;
      this.flip = !!flip;
      if (this.first instanceof ValueNode && this.first.base instanceof ObjectNode) {
        this.first = new ParentheticalNode(this.first);
      }
      this.first.tags.operation = true;
      if (this.second) {
        this.second.tags.operation = true;
      }
      return this;
    };
    __extends(OpNode, BaseNode);
    OpNode.prototype.CONVERSIONS = {
      '==': '===',
      '!=': '!=='
    };
    OpNode.prototype.INVERSIONS = {
      '!==': '===',
      '===': '!=='
    };
    OpNode.prototype.CHAINABLE = ['<', '>', '>=', '<=', '===', '!=='];
    OpNode.prototype.ASSIGNMENT = ['||=', '&&=', '?='];
    OpNode.prototype.PREFIX_OPERATORS = ['typeof', 'delete'];
    OpNode.prototype["class"] = 'OpNode';
    OpNode.prototype.children = ['first', 'second'];
    OpNode.prototype.isUnary = function() {
      return !this.second;
    };
    OpNode.prototype.isInvertible = function() {
      var _d;
      return (('===' === (_d = this.operator) || '!==' === _d)) && !(this.first instanceof OpNode) && !(this.second instanceof OpNode);
    };
    OpNode.prototype.isMutator = function() {
      var _d;
      return ends(this.operator, '=') && !(('===' === (_d = this.operator) || '!==' === _d));
    };
    OpNode.prototype.isChainable = function() {
      return include(this.CHAINABLE, this.operator);
    };
    OpNode.prototype.invert = function() {
      return (this.operator = this.INVERSIONS[this.operator]);
    };
    OpNode.prototype.toString = function(idt) {
      return OpNode.__super__.toString.call(this, idt, this["class"] + ' ' + this.operator);
    };
    OpNode.prototype.compileNode = function(o) {
      if (this.isChainable() && this.first.unwrap() instanceof OpNode && this.first.unwrap().isChainable()) {
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
      if (this.first instanceof OpNode && this.first.isMutator()) {
        this.first = new ParentheticalNode(this.first);
      }
      if (this.second instanceof OpNode && this.second.isMutator()) {
        this.second = new ParentheticalNode(this.second);
      }
      return [this.first.compile(o), this.operator, this.second.compile(o)].join(' ');
    };
    OpNode.prototype.compileChain = function(o) {
      var _d, _e, first, second, shared;
      shared = this.first.unwrap().second;
      if (shared.containsType(CallNode)) {
        _d = shared.compileReference(o);
        this.first.second = _d[0];
        shared = _d[1];
      }
      _e = [this.first.compile(o), this.second.compile(o), shared.compile(o)];
      first = _e[0];
      second = _e[1];
      shared = _e[2];
      return "(" + (first) + ") && (" + (shared) + " " + (this.operator) + " " + (second) + ")";
    };
    OpNode.prototype.compileAssignment = function(o) {
      var _d, first, firstVar, second;
      _d = this.first.compileReference(o, {
        precompile: true,
        assignment: true
      });
      first = _d[0];
      firstVar = _d[1];
      second = this.second.compile(o);
      if (this.second instanceof OpNode) {
        second = ("(" + (second) + ")");
      }
      if (first.match(IDENTIFIER)) {
        o.scope.find(first);
      }
      if (this.operator === '?=') {
        return ("" + (first) + " = " + (ExistenceNode.compileTest(o, literal(firstVar))[0]) + " ? " + (firstVar) + " : " + (second));
      }
      return "" + (first) + " " + (this.operator.substr(0, 2)) + " (" + (firstVar) + " = " + (second) + ")";
    };
    OpNode.prototype.compileExistence = function(o) {
      var _d, ref, test;
      _d = ExistenceNode.compileTest(o, this.first);
      test = _d[0];
      ref = _d[1];
      return "" + (test) + " ? " + (ref) + " : " + (this.second.compile(o));
    };
    OpNode.prototype.compileUnary = function(o) {
      var parts, space;
      space = indexOf(this.PREFIX_OPERATORS, this.operator) >= 0 ? ' ' : '';
      parts = [this.operator, space, this.first.compile(o)];
      if (this.flip) {
        parts = parts.reverse();
      }
      return parts.join('');
    };
    return OpNode;
  })();
  exports.InNode = (function() {
    InNode = function(_d, _e) {
      this.array = _e;
      this.object = _d;
      InNode.__super__.constructor.call(this);
      return this;
    };
    __extends(InNode, BaseNode);
    InNode.prototype["class"] = 'InNode';
    InNode.prototype.children = ['object', 'array'];
    InNode.prototype.isArray = function() {
      return this.array instanceof ValueNode && this.array.isArray();
    };
    InNode.prototype.compileNode = function(o) {
      var _d;
      _d = this.object.compileReference(o, {
        precompile: true
      });
      this.obj1 = _d[0];
      this.obj2 = _d[1];
      return this.isArray() ? this.compileOrTest(o) : this.compileLoopTest(o);
    };
    InNode.prototype.compileOrTest = function(o) {
      var _d, _e, _f, i, item, tests;
      tests = (function() {
        _d = []; _e = this.array.base.objects;
        for (i = 0, _f = _e.length; i < _f; i++) {
          item = _e[i];
          _d.push("" + (item.compile(o)) + " === " + (i ? this.obj2 : this.obj1));
        }
        return _d;
      }).call(this);
      return "(" + (tests.join(' || ')) + ")";
    };
    InNode.prototype.compileLoopTest = function(o) {
      var _d, _e, i, l, prefix;
      _d = this.array.compileReference(o, {
        precompile: true
      });
      this.arr1 = _d[0];
      this.arr2 = _d[1];
      _e = [o.scope.freeVariable(), o.scope.freeVariable()];
      i = _e[0];
      l = _e[1];
      prefix = this.obj1 !== this.obj2 ? this.obj1 + '; ' : '';
      return "(function(){ " + (prefix) + "for (var " + (i) + "=0, " + (l) + "=" + (this.arr1) + ".length; " + (i) + "<" + (l) + "; " + (i) + "++) { if (" + (this.arr2) + "[" + (i) + "] === " + (this.obj2) + ") return true; } return false; }).call(this)";
    };
    return InNode;
  })();
  exports.TryNode = (function() {
    TryNode = function(_d, _e, _f, _g) {
      this.ensure = _g;
      this.recovery = _f;
      this.error = _e;
      this.attempt = _d;
      TryNode.__super__.constructor.call(this);
      return this;
    };
    __extends(TryNode, BaseNode);
    TryNode.prototype["class"] = 'TryNode';
    TryNode.prototype.children = ['attempt', 'recovery', 'ensure'];
    TryNode.prototype.isStatement = function() {
      return true;
    };
    TryNode.prototype.makeReturn = function() {
      if (this.attempt) {
        this.attempt = this.attempt.makeReturn();
      }
      if (this.recovery) {
        this.recovery = this.recovery.makeReturn();
      }
      return this;
    };
    TryNode.prototype.compileNode = function(o) {
      var attemptPart, catchPart, errorPart, finallyPart;
      o.indent = this.idt(1);
      o.top = true;
      attemptPart = this.attempt.compile(o);
      errorPart = this.error ? (" (" + (this.error.compile(o)) + ") ") : ' ';
      catchPart = this.recovery ? (" catch" + (errorPart) + "{\n" + (this.recovery.compile(o)) + "\n" + (this.tab) + "}") : '';
      finallyPart = (this.ensure || '') && ' finally {\n' + this.ensure.compile(merge(o)) + ("\n" + (this.tab) + "}");
      return "" + (this.tab) + "try {\n" + (attemptPart) + "\n" + (this.tab) + "}" + (catchPart) + (finallyPart);
    };
    return TryNode;
  })();
  exports.ThrowNode = (function() {
    ThrowNode = function(_d) {
      this.expression = _d;
      ThrowNode.__super__.constructor.call(this);
      return this;
    };
    __extends(ThrowNode, BaseNode);
    ThrowNode.prototype["class"] = 'ThrowNode';
    ThrowNode.prototype.children = ['expression'];
    ThrowNode.prototype.isStatement = function() {
      return true;
    };
    ThrowNode.prototype.makeReturn = function() {
      return this;
    };
    ThrowNode.prototype.compileNode = function(o) {
      return "" + (this.tab) + "throw " + (this.expression.compile(o)) + ";";
    };
    return ThrowNode;
  })();
  exports.ExistenceNode = (function() {
    ExistenceNode = function(_d) {
      this.expression = _d;
      ExistenceNode.__super__.constructor.call(this);
      return this;
    };
    __extends(ExistenceNode, BaseNode);
    ExistenceNode.prototype["class"] = 'ExistenceNode';
    ExistenceNode.prototype.children = ['expression'];
    ExistenceNode.prototype.compileNode = function(o) {
      var test;
      test = ExistenceNode.compileTest(o, this.expression)[0];
      return this.parenthetical ? test.substring(1, test.length - 1) : test;
    };
    ExistenceNode.compileTest = function(o, variable) {
      var _d, first, second;
      _d = variable.compileReference(o, {
        precompile: true
      });
      first = _d[0];
      second = _d[1];
      return [("(typeof " + (first) + " !== \"undefined\" && " + (second) + " !== null)"), second];
    };
    return ExistenceNode;
  }).call(this);
  exports.ParentheticalNode = (function() {
    ParentheticalNode = function(_d) {
      this.expression = _d;
      ParentheticalNode.__super__.constructor.call(this);
      return this;
    };
    __extends(ParentheticalNode, BaseNode);
    ParentheticalNode.prototype["class"] = 'ParentheticalNode';
    ParentheticalNode.prototype.children = ['expression'];
    ParentheticalNode.prototype.isStatement = function(o) {
      return this.expression.isStatement(o);
    };
    ParentheticalNode.prototype.makeReturn = function() {
      return this.expression.makeReturn();
    };
    ParentheticalNode.prototype.topSensitive = function() {
      return true;
    };
    ParentheticalNode.prototype.compileNode = function(o) {
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
      return "(" + (code) + ")";
    };
    return ParentheticalNode;
  })();
  exports.ForNode = (function() {
    ForNode = function(_d, source, _e, _f) {
      var _g;
      this.index = _f;
      this.name = _e;
      this.body = _d;
      ForNode.__super__.constructor.call(this);
      this.index || (this.index = null);
      this.source = source.source;
      this.guard = source.guard;
      this.step = source.step;
      this.raw = !!source.raw;
      this.object = !!source.object;
      if (this.object) {
        _g = [this.index, this.name];
        this.name = _g[0];
        this.index = _g[1];
      }
      this.pattern = this.name instanceof ValueNode;
      if (this.index instanceof ValueNode) {
        throw new Error('index cannot be a pattern matching expression');
      }
      this.returns = false;
      return this;
    };
    __extends(ForNode, BaseNode);
    ForNode.prototype["class"] = 'ForNode';
    ForNode.prototype.children = ['body', 'source', 'guard'];
    ForNode.prototype.isStatement = function() {
      return true;
    };
    ForNode.prototype.topSensitive = function() {
      return true;
    };
    ForNode.prototype.makeReturn = function() {
      this.returns = true;
      return this;
    };
    ForNode.prototype.compileReturnValue = function(val, o) {
      if (this.returns) {
        return '\n' + new ReturnNode(literal(val)).compile(o);
      }
      if (val) {
        return '\n' + val;
      }
      return '';
    };
    ForNode.prototype.compileNode = function(o) {
      var body, codeInBody, forPart, guardPart, index, ivar, lvar, name, namePart, range, returnResult, rvar, scope, source, sourcePart, stepPart, svar, topLevel, varPart, vars;
      topLevel = del(o, 'top') && !this.returns;
      range = this.source instanceof ValueNode && this.source.base instanceof RangeNode && !this.source.properties.length;
      source = range ? this.source.base : this.source;
      codeInBody = this.body.contains(function(n) {
        return n instanceof CodeNode;
      });
      scope = o.scope;
      name = (this.name && this.name.compile(o)) || scope.freeVariable();
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
      if (!(topLevel)) {
        rvar = scope.freeVariable();
      }
      ivar = (function() {
        if (codeInBody) {
          return scope.freeVariable();
        } else if (range) {
          return name;
        } else {
          return index || scope.freeVariable();
        }
      })();
      varPart = '';
      guardPart = '';
      body = Expressions.wrap([this.body]);
      if (range) {
        sourcePart = source.compileVariables(o);
        forPart = source.compile(merge(o, {
          index: ivar,
          step: this.step
        }));
      } else {
        svar = scope.freeVariable();
        sourcePart = ("" + (svar) + " = " + (this.source.compile(o)) + ";");
        if (this.pattern) {
          namePart = new AssignNode(this.name, literal("" + (svar) + "[" + (ivar) + "]")).compile(merge(o, {
            indent: this.idt(1),
            top: true
          })) + '\n';
        } else {
          if (name) {
            namePart = ("" + (name) + " = " + (svar) + "[" + (ivar) + "]");
          }
        }
        if (!(this.object)) {
          lvar = scope.freeVariable();
          stepPart = this.step ? ("" + (ivar) + " += " + (this.step.compile(o))) : ("" + (ivar) + "++");
          forPart = ("" + (ivar) + " = 0, " + (lvar) + " = " + (svar) + ".length; " + (ivar) + " < " + (lvar) + "; " + (stepPart));
        }
      }
      sourcePart = (rvar ? ("" + (rvar) + " = []; ") : '') + sourcePart;
      sourcePart = sourcePart ? ("" + (this.tab) + (sourcePart) + "\n" + (this.tab)) : this.tab;
      returnResult = this.compileReturnValue(rvar, o);
      if (!(topLevel)) {
        body = PushNode.wrap(rvar, body);
      }
      if (this.guard) {
        body = Expressions.wrap([new IfNode(this.guard, body)]);
      }
      if (codeInBody) {
        if (range) {
          body.unshift(literal("var " + (name) + " = " + (ivar)));
        }
        if (namePart) {
          body.unshift(literal("var " + (namePart)));
        }
        if (index) {
          body.unshift(literal("var " + (index) + " = " + (ivar)));
        }
        body = ClosureNode.wrap(body, true);
      } else {
        varPart = (namePart || '') && (this.pattern ? namePart : ("" + (this.idt(1)) + (namePart) + ";\n"));
      }
      if (this.object) {
        forPart = ("" + (ivar) + " in " + (svar));
        if (!(this.raw)) {
          guardPart = ("\n" + (this.idt(1)) + "if (!" + (utility('hasProp')) + ".call(" + (svar) + ", " + (ivar) + ")) continue;");
        }
      }
      body = body.compile(merge(o, {
        indent: this.idt(1),
        top: true
      }));
      vars = range ? name : ("" + (name) + ", " + (ivar));
      return "" + (sourcePart) + "for (" + (forPart) + ") {" + (guardPart) + "\n" + (varPart) + (body) + "\n" + (this.tab) + "}" + (returnResult);
    };
    return ForNode;
  })();
  exports.IfNode = (function() {
    IfNode = function(_d, _e, _f) {
      this.tags = _f;
      this.body = _e;
      this.condition = _d;
      this.tags || (this.tags = {});
      if (this.tags.invert) {
        if (this.condition instanceof OpNode && this.condition.isInvertible()) {
          this.condition.invert();
        } else {
          this.condition = new OpNode('!', new ParentheticalNode(this.condition));
        }
      }
      this.elseBody = null;
      this.isChain = false;
      return this;
    };
    __extends(IfNode, BaseNode);
    IfNode.prototype["class"] = 'IfNode';
    IfNode.prototype.children = ['condition', 'switchSubject', 'body', 'elseBody', 'assigner'];
    IfNode.prototype.topSensitive = function() {
      return true;
    };
    IfNode.prototype.bodyNode = function() {
      return this.body == null ? undefined : this.body.unwrap();
    };
    IfNode.prototype.elseBodyNode = function() {
      return this.elseBody == null ? undefined : this.elseBody.unwrap();
    };
    IfNode.prototype.forceStatement = function() {
      this.tags.statement = true;
      return this;
    };
    IfNode.prototype.switchesOver = function(expression) {
      this.switchSubject = expression;
      return this;
    };
    IfNode.prototype.rewriteSwitch = function(o) {
      var _d, _e, _f, cond, i, variable;
      this.assigner = this.switchSubject;
      if (!(this.switchSubject.unwrap() instanceof LiteralNode)) {
        variable = literal(o.scope.freeVariable());
        this.assigner = new AssignNode(variable, this.switchSubject);
        this.switchSubject = variable;
      }
      this.condition = (function() {
        _d = []; _e = flatten([this.condition]);
        for (i = 0, _f = _e.length; i < _f; i++) {
          cond = _e[i];
          _d.push((function() {
            if (cond instanceof OpNode) {
              cond = new ParentheticalNode(cond);
            }
            return new OpNode('==', i === 0 ? this.assigner : this.switchSubject, cond);
          }).call(this));
        }
        return _d;
      }).call(this);
      if (this.isChain) {
        this.elseBodyNode().switchesOver(this.switchSubject);
      }
      this.switchSubject = undefined;
      return this;
    };
    IfNode.prototype.addElse = function(elseBody, statement) {
      if (this.isChain) {
        this.elseBodyNode().addElse(elseBody, statement);
      } else {
        this.isChain = elseBody instanceof IfNode;
        this.elseBody = this.ensureExpressions(elseBody);
      }
      return this;
    };
    IfNode.prototype.isStatement = function(o) {
      return this.statement || (this.statement = (!!((o && o.top) || this.tags.statement || this.bodyNode().isStatement(o) || (this.elseBody && this.elseBodyNode().isStatement(o)))));
    };
    IfNode.prototype.compileCondition = function(o) {
      var _d, _e, _f, _g, cond, conditions;
      conditions = flatten([this.condition]);
      if (conditions.length === 1) {
        conditions[0].parenthetical = true;
      }
      return (function() {
        _d = []; _f = conditions;
        for (_e = 0, _g = _f.length; _e < _g; _e++) {
          cond = _f[_e];
          _d.push(cond.compile(o));
        }
        return _d;
      })().join(' || ');
    };
    IfNode.prototype.compileNode = function(o) {
      return this.isStatement(o) ? this.compileStatement(o) : this.compileTernary(o);
    };
    IfNode.prototype.makeReturn = function() {
      if (this.isStatement()) {
        this.body && (this.body = this.ensureExpressions(this.body.makeReturn()));
        this.elseBody && (this.elseBody = this.ensureExpressions(this.elseBody.makeReturn()));
        return this;
      } else {
        return new ReturnNode(this);
      }
    };
    IfNode.prototype.ensureExpressions = function(node) {
      return node instanceof Expressions ? node : new Expressions([node]);
    };
    IfNode.prototype.compileStatement = function(o) {
      var body, child, comDent, condO, elsePart, ifDent, ifPart, top;
      if (this.switchSubject) {
        this.rewriteSwitch(o);
      }
      top = del(o, 'top');
      child = del(o, 'chainChild');
      condO = merge(o);
      o.indent = this.idt(1);
      o.top = true;
      ifDent = child || (top && !this.isStatement(o)) ? '' : this.idt();
      comDent = child ? this.idt() : '';
      body = this.body.compile(o);
      ifPart = ("" + (ifDent) + "if (" + (this.compileCondition(condO)) + ") {\n" + (body) + "\n" + (this.tab) + "}");
      if (!(this.elseBody)) {
        return ifPart;
      }
      elsePart = this.isChain ? ' else ' + this.elseBodyNode().compile(merge(o, {
        indent: this.idt(),
        chainChild: true
      })) : (" else {\n" + (this.elseBody.compile(o)) + "\n" + (this.tab) + "}");
      return "" + (ifPart) + (elsePart);
    };
    IfNode.prototype.compileTernary = function(o) {
      var code, elsePart, ifPart;
      this.bodyNode().tags.operation = (this.condition.tags.operation = true);
      if (this.elseBody) {
        this.elseBodyNode().tags.operation = true;
      }
      ifPart = this.condition.compile(o) + ' ? ' + this.bodyNode().compile(o);
      elsePart = this.elseBody ? this.elseBodyNode().compile(o) : 'null';
      code = ("" + (ifPart) + " : " + (elsePart));
      return this.tags.operation ? ("(" + (code) + ")") : code;
    };
    return IfNode;
  })();
  PushNode = (exports.PushNode = {
    wrap: function(array, expressions) {
      var expr;
      expr = expressions.unwrap();
      if (expr.isPureStatement() || expr.containsPureStatement()) {
        return expressions;
      }
      return Expressions.wrap([new CallNode(new ValueNode(literal(array), [new AccessorNode(literal('push'))]), [expr])]);
    }
  });
  ClosureNode = (exports.ClosureNode = {
    wrap: function(expressions, statement) {
      var args, call, func, mentionsArgs, mentionsThis, meth;
      if (expressions.containsPureStatement()) {
        return expressions;
      }
      func = new ParentheticalNode(new CodeNode([], Expressions.wrap([expressions])));
      args = [];
      mentionsArgs = expressions.contains(function(n) {
        return n instanceof LiteralNode && (n.value === 'arguments');
      });
      mentionsThis = expressions.contains(function(n) {
        return (n instanceof LiteralNode && (n.value === 'this')) || (n instanceof CodeNode && n.bound);
      });
      if (mentionsArgs || mentionsThis) {
        meth = literal(mentionsArgs ? 'apply' : 'call');
        args = [literal('this')];
        if (mentionsArgs) {
          args.push(literal('arguments'));
        }
        func = new ValueNode(func, [new AccessorNode(meth)]);
      }
      call = new CallNode(func, args);
      return statement ? Expressions.wrap([call]) : call;
    }
  });
  UTILITIES = {
    "extends": "function(child, parent) {\n    var ctor = function(){};\n    ctor.prototype = parent.prototype;\n    child.prototype = new ctor();\n    child.prototype.constructor = child;\n    if (typeof parent.extended === \"function\") parent.extended(child);\n    child.__super__ = parent.prototype;\n  }",
    bind: "function(func, context) {\n    return function(){ return func.apply(context, arguments); };\n  }",
    hasProp: 'Object.prototype.hasOwnProperty',
    slice: 'Array.prototype.slice'
  };
  TAB = '  ';
  TRAILING_WHITESPACE = /[ \t]+$/gm;
  IDENTIFIER = /^[a-zA-Z\$_](\w|\$)*$/;
  NUMBER = /^(((\b0(x|X)[0-9a-fA-F]+)|((\b[0-9]+(\.[0-9]+)?|\.[0-9]+)(e[+\-]?[0-9]+)?)))\b$/i;
  SIMPLENUM = /^-?\d+/;
  IS_STRING = /^['"]/;
  literal = function(name) {
    return new LiteralNode(name);
  };
  utility = function(name) {
    var ref;
    ref = ("__" + (name));
    Scope.root.assign(ref, UTILITIES[name]);
    return ref;
  };
}).call(this);
