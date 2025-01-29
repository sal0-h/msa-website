
////////////////////
// Timeout checker
////////////////////

function getTime() {
  return new Date().getTime();
}

function isIdentifierStart(c) {
  // letter, _, $
  var code = c.charCodeAt(0);
  return ((c == '_') ||
          (c == '$') ||
          ((code >= "a".charCodeAt(0)) && (code <= "z".charCodeAt(0))) ||
          ((code >= "A".charCodeAt(0)) && (code <= "Z".charCodeAt(0)))
          );
}

function isIdentifierPart(c) {
  // start (letter, _, $) or digit
  var code = c.charCodeAt(0);
  return ((isIdentifierStart(c)) ||
          ((code >= "0".charCodeAt(0)) && (code <= "9".charCodeAt(0)))
          );
}

function patchCodeToCheckTimeout(code) {
  var result = "";
  var i0=0; // start of substring to copy to result
  var inString=false, endQuote, inComment=false;
  var inLoopPreColon=false, inLoopPostColon=false;
  var curr;
  var bracketCount=0, parenCount=0;
  for (var i=0; i<code.length; i++) {
    curr = code[i];
    if (inComment)
      inComment = (curr != '\n');
    else if ((!inString) && (curr == '#'))
      inComment = true;
    else if (inString) {
      if (endQuote.length == 3)
        inString = ((curr + code[i-1] + code[i-2]) != endQuote);
      else
        inString = ((curr == '\n') ||
                    ((curr != endQuote) || (code[i-1] == '\\')));
    }
    else if ((curr == '"') || (curr == "'")) {
      inString = true;
      if ((i+2 < code.length) && (code[i+1] == curr) && (code[i+2] == curr))
        { endQuote = curr+curr+curr; i+=2; }
      else
        endQuote = curr;
    }
    else if (inLoopPostColon) {
      // we've seen "while ...:" or "for ...:"
      // so looking for first non-whitespace outside comment or quote
      if ((curr != " ") && (curr != "\t") && (curr != "\n")) {
        // we did it!  time to add the patch!
        result += code.substring(i0,i);
        result += "_w._ct();"
        i0 = i;
        inLoopPostColon = false;
      }
    }
    else if (inLoopPreColon) {
      // we've seen "while..." or "for ..."
      // so we're looking for the first colon outside comment or quote
      // and also outside any [brackets] or (parens)
      if (curr == "(") parenCount += 1;
      else if (curr == ")") parenCount -= 1;
      else if (curr == "[") bracketCount += 1;
      else if (curr == "]") bracketCount -= 1;
      else if ((curr == ":") && (parenCount == 0) && (bracketCount == 0)) {
        inLoopPreColon = false;
        inLoopPostColon = true;
      }
    }
    else if ((i >= 1) &&
             !isIdentifierPart(curr) &&
             isIdentifierPart(code[i-1])) {
      // we're looking for "while" or "for" outside comment or quote
      // and we're just past an identifier, so find it
      var j = i-1;
      while ((j > 0) && isIdentifierStart(code[j-1])) j -= 1;
      var identifier = code.substring(j,i);
      if ((identifier == "for") || (identifier == "while")) {
        if (curr == ":")
          inLoopPostColon = true;
        else {
          inLoopPreColon = true;
          bracketCount = 0;
          parenCount = 0;
        }
      }
    }
  }
  result += code.substring(i0,i); // add last bit of code
  // alert(result);
  return result;
}

// See: https://groups.google.com/forum/#!topic/brython/xLv55qq-L1s
function addHiddenCodeDiv(id, code) {
  var newDiv = document.createElement('pre');
  newDiv.id = id;
  newDiv.style.visibility = 'hidden';
  newDiv.type = 'text/python3';
  newDiv.textContent = code;
  document.body.appendChild(newDiv);
  return newDiv
}

////////////////////
// MBP (Modal Brython Popup)
////////////////////

var MBP = {
  brythonInited: false,
  aceEditor: null,
  code: "# your code",

  runCodeInEditor: function() { MBP.run(null); },

  initThenRun: function(code) {
    if (MBP.brythonInited == true) {
      alert("ModalBrythonPython: Init called more than once!");
      return;
    }
    // init the ACE editor
    MBP.aceEditor = ace.edit("mbpAceEditor");
    MBP.aceEditor.getSession().setMode("ace/mode/python");
    MBP.aceEditor.setTheme("ace/theme/xcode");
    MBP.aceEditor.setFontSize(13);
    MBP.aceEditor.setHighlightActiveLine(false);
    MBP.aceEditor.$blockScrolling = Infinity; // as per ace's error msg
    MBP.aceEditor.commands.addCommand({
      name: "run",
      bindKey: {win: "Ctrl-R", mac: "Ctrl-R"},
      exec: function(editor) { MBP.runCodeInEditor(); },
      readOnly: true
      });
    $("#modalBrythonPopup").on("shown.bs.modal", function() {
      MBP.aceEditor.resize(true); // force synchronous update
      MBP.evalBrython(MBP.code);
    });
    MBP.brythonInited = true;
    MBP.run(MBP.code);
  },

  run: function(code) {
    if (code != null) {
      code = $('<textarea />').html(code).text(); // unconvert &gt to >, etc
      //console.log(code);
    }
    MBP.code = code;
    if (MBP.brythonInited == false) {
      MBP.initThenRun();
      return;
    }
    if (code == null) {
      code = MBP.aceEditor.getValue();
      code = $('<textarea />').html(code).text(); // unconvert &gt to >, etc
    }
    else {
      MBP.aceEditor.setValue(code);
      MBP.aceEditor.clearSelection();
    }
    MBP.code = code;
    $("#mbpConsole").html("");
    if (!$('#modalBrythonPopup').is(':visible')) {
      $("#modalBrythonPopup").modal("show"); // will run with on("shown")
    }
    else {
      // @TODO: not use a timeout here.  We use it so that
      // the mbpConsole has time to actually clear (otherwise
      // the previous output remains there until the end of the run)
      setTimeout(function() { MBP.evalBrython(MBP.code); }, 10);
    }
  },

  onRun: function(runButton) {
    MBP.runCodeInEditor();
  },

  onClose: function(closeButton) {
    $("#modalBrythonPopup").modal("hide");
  },

  onAboutBrython: function(onAboutBrythonButton) {
    window.open("http://www.brython.info/",'_blank');
  },

  consoleLogFn: function(line) {
      var mbpConsole = $("#mbpConsole");
      if (!mbpConsole) alert("ModalBrythonPopup: missing console!");
      // @TODO: clean up "import _sys from VFS" lines more cleanly
      if ((line.indexOf("import ") == 0) && (line.indexOf("from VFS") > 0)) {
        // bogus line, just eat it
        return;
      }
      // Can't just mbpConsole.append(line) since we have to escape strings
      $(document.createTextNode(line)).appendTo(mbpConsole);
      mbpConsole.scrollTop(mbpConsole.innerHeight());
  },

  evalBrython: function(code) {
    code = patchCodeToCheckTimeout(code);

    // now capture console
    var _log = console.log;
    console.log = function() {
      var args, i;
      args = []; for (i=0; i<arguments.length; i++) args.push(arguments[i]);
      MBP.consoleLogFn(args.toString());
    };
    try {
          brython({debug:1});
          var brythonCode = `
from browser import window as _w, alert as _a
import sys as _s

def _ct():
    if (_w.getTime() - _w._t0 > 3000):
        raise Exception('Timeout! (Perhaps you have an infinite loop?)')
_w._ct = _ct

def _run():
    _w._t0 = _w.getTime()
    try:
      exec(_w._code, globals())
      _w._t1 = _w.getTime()
      print(f'[completed in {_w._t1-_w._t0} ms]')
    except Exception as e:
      exc_info = _s.exc_info()
      exc_class = exc_info[0].__name__
      exc_msg = str(exc_info[1])
      tb = exc_info[2]
      if exc_info[0] is SyntaxError:
          args = exc_info[1].args
          info, filename, lineno, offset, line = args
          print(f"  line {lineno}")
          print("    " + line)
          print("    " + offset * " " + "^")
          print("SyntaxError:", info)
      else:
        print("Traceback (most recent call last):")
        while tb is not None:
            frame = tb.tb_frame
            code = frame.f_code
            name = code.co_name
            #filename = code.co_filename
            if (name != '_run'):
              inFn = '' if (name == '<module>') else f', in {name}'
              print(f"  line {tb.tb_lineno}{inFn}")
              print(f"    {tb.tb_lasti}")
            tb = tb.tb_next
        print(f"{exc_class}: {exc_msg}")
_run()
`;
         window._code = code;
          __BRYTHON__.run_script(brythonCode, "__main__", true);
    }
    catch (err) {
        errMsg = err.toString();
        if (errMsg != "Error") {
          // ignore generic "Error", since Brython will output Python err
          console.log("Brython Error: " + errMsg);
          console.log("<completed (error)>");
        }
    }
    finally {
      console.log = _log;
    }
  },

  /*
  evalBrython_OLD: function(code) {
    code = patchCodeToCheckTimeout(code);
    var pyScript = addHiddenCodeDiv('pyScript', code);
    // need pyScriptRunner to deal with cascading tracebacks
    var codeRunnerCode = (
      'from browser import window, document, alert' + '\n' +
      'import traceback' + '\n' +
      'src = document["pyScript"].textContent' + '\n' +
      'try:' + '\n' +
      //'   #alert("src=" + src)' + '\n' +
      '   exec(src,globals())' + '\n' +
      'except Exception as exc:' + '\n' +
      //'   traceback.print_exc()' + '\n' +
      //'   # eat leading frames (from this wrapper code)
      '   lines = traceback.format_exc().splitlines()' + '\n' +
      '   print(lines[0])' + '\n' +
      '   for line in lines[5:]:' + '\n' +
      '     print(line.replace("module exec_1 ",""))' + '\n' +
      ''
    );

    var pyScriptRunner = addHiddenCodeDiv('pyScriptRunner', codeRunnerCode);
    // now capture console
    var _log = console.log;
    console.log = function() {
      var args, i;
      args = []; for (i=0; i<arguments.length; i++) args.push(arguments[i]);
      MBP.consoleLogFn(args.toString());
    };
    // run brython(), based on Pierre's suggested approach
    try {
          // Timing idea from Brython website
          var t0 = (new Date()).getTime();
          resetTimeout();
          brython({debug:1, ipy_id:['pyScriptRunner']});
          var t1 = (new Date()).getTime();
          console.log("[completed in "+(t1-t0)+" ms]");
    }
    catch (err) {
        errMsg = err.toString();
        if (errMsg != "Error") {
          // ignore generic "Error", since Brython will output Python err
          console.log("Brython Error: " + errMsg);
          console.log("<completed (error)>");
        }
    }
    finally {
      console.log = _log;
    }
    document.body.removeChild(pyScript);
    document.body.removeChild(pyScriptRunner);
  },
  */

  modalBrythonPopupHtml: (
  '<!-- begin ModalBrythonPopup -->' + '\n' +
  '<style type="text/css">' + '\n' +
  '@media (min-width: 768px) { .modal-xl { width: 90%; max-width:1200px; } }' + '\n' +
  '</style>' + '\n' +
  '<div class="modal fade" id="modalBrythonPopup" tabindex="-1" role="dialog" aria-labelledby="myModalLabel">' + '\n' +
  '    <div class="modal-dialog modal-xl" role="document">' + '\n' +
  '      <div class="modal-content">' + '\n' +
  '        <div class="modal-body" id="modalBrythonPopupBody">' + '\n' +
  '          <div style="margin-bottom:5px">' + '\n' +
  '            <button type="button" class="btn btn-primary btn-xs" onclick="MBP.onRun(this)">' + '\n' +
  '              <span class="glyphicon glyphicon-play" aria-hidden="true"></span>' + '\n' +
  '              Run' + '\n' +
  '            </button>' + '\n' +
  '            <button type="button" class="btn btn-primary btn-xs pull-right"' + '\n' +
  '                    onclick="MBP.onClose(this)">' + '\n' +
  '              <span class="glyphicon glyphicon-remove" aria-hidden="true"></span>' + '\n' +
  '              Close' + '\n' +
  '            </button>' + '\n' +
  '            <button type="button" class="btn btn-primary btn-xs pull-right"' + '\n' +
  '                    style="margin-right:10px;"' + '\n' +
  '                    onclick="MBP.onAboutBrython(this)">' + '\n' +
  '              About Brython' + '\n' +
  '            </button>' + '\n' +
  '          </div>' + '\n' +
  '          <div id="mbpAceEditor" style="width:100%; height:250px; margin-bottom:5px;">' + '\n' +
  '            # Your code goes here' + '\n' +
  '          </div>' + '\n' +
  '          <div id="mbpConsoleDiv">' + '\n' +
  '            <pre id="mbpConsole" ' + '\n' +
  '                 style="background-color:#F0F8FF;' + '\n' +
  '                        width:100%; height:250px;">' + '\n' +
  '            </pre>' + '\n' +
  '          </div>' + '\n' +
  '        </div>' + '\n' +
  '      </div>' + '\n' +
  '    </div>' + '\n' +
  '  </div>' + '\n' +
  '<!-- end ModalBrythonPopup -->' + '\n' +
  ''),

  insertModalBrythonPopupHtml: function() {
    $("body").append(MBP.modalBrythonPopupHtml);
  },
};

