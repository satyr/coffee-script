(function() {
  var CoffeeScript, runScripts;
  CoffeeScript = require('./coffee-script');
  CoffeeScript.require = require;
  CoffeeScript.eval = function(code, options) {
    return eval(CoffeeScript.compile(code, options));
  };
  CoffeeScript.run = function(code, options) {
    if (options != null) {
      options.bare = true;
    }
    return Function(CoffeeScript.compile(code, options))();
  };
  if (!(typeof window !== "undefined" && window !== null)) {
    return;
  }
  CoffeeScript.load = function(url, options) {
    var xhr;
    xhr = new (window.ActiveXObject || XMLHttpRequest)('Microsoft.XMLHTTP');
    xhr.open('GET', url, true);
    if ('overrideMimeType' in xhr) {
      xhr.overrideMimeType('text/plain');
    }
    xhr.onreadystatechange = function() {
      return xhr.readyState === 4 ? CoffeeScript.run(xhr.responseText, options) : undefined;
    };
    return xhr.send(null);
  };
  runScripts = function() {
    var _i, _len, _ref, script;
    _ref = document.getElementsByTagName('script');
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      script = _ref[_i];
      if (script.type === 'text/coffeescript') {
        if (script.src) {
          CoffeeScript.load(script.src);
        } else {
          CoffeeScript.run(script.innerHTML);
        }
      }
    }
    return null;
  };
  if (window.addEventListener) {
    addEventListener('DOMContentLoaded', runScripts, false);
  } else {
    attachEvent('onload', runScripts);
  }
}).call(this);
