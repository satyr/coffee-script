(function() {
  var extend, indexOf;
  indexOf = (exports.indexOf = Array.indexOf || (Array.prototype.indexOf ? function(array, item, from) {
    return array.indexOf(item, from);
  } : function(array, item, from) {
    var _len, _ref, index, other;
    _ref = array;
    for (index = 0, _len = _ref.length; index < _len; index++) {
      other = _ref[index];
      if (other === item && (!from || (from <= index))) {
        return index;
      }
    }
    return -1;
  }));
  exports.include = function(list, value) {
    return indexOf(list, value) >= 0;
  };
  exports.starts = function(string, literal, start) {
    return literal === string.substr(start, literal.length);
  };
  exports.ends = function(string, literal, back) {
    var len;
    len = literal.length;
    return literal === string.substr(string.length - len - (back || 0), len);
  };
  exports.compact = function(array) {
    var _i, _len, _ref, _result, item;
    _result = []; _ref = array;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      item = _ref[_i];
      if (item) {
        _result.push(item);
      }
    }
    return _result;
  };
  exports.count = function(string, letter) {
    var num, pos;
    num = (pos = 0);
    while (pos = 1 + string.indexOf(letter, pos)) {
      num++;
    }
    return num;
  };
  exports.merge = function(options, overrides) {
    return extend(extend({}, options), overrides);
  };
  extend = (exports.extend = function(object, properties) {
    var _ref, key, val;
    _ref = properties;
    for (key in _ref) {
      val = _ref[key];
      object[key] = val;
    }
    return object;
  });
  exports.flatten = function(array) {
    return array.concat.apply([], array);
  };
  exports.del = function(obj, key) {
    var val;
    val = obj[key];
    delete obj[key];
    return val;
  };
  exports.last = function(array, back) {
    return array[array.length - (back >>> 0) - 1];
  };
}).call(this);
