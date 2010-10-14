//
// Firesheep.js
// Part of the Firesheep project.
//
// Copyright (C) 2010 Eric Butler
//
// Authors:
//   Eric Butler <eric@codebutler.com>
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

Components.utils.import('resource://firesheep/util/Observers.js');
Components.utils.import('resource://firesheep/util/ScriptParser.js');
Components.utils.import('resource://firesheep/FiresheepConfig.js');
Components.utils.import('resource://firesheep/FiresheepSession.js');
Components.utils.import('resource://firesheep/util/Utils.js');
Components.utils.import('resource://firesheep/util/underscore.js');

const Cc = Components.classes;
const Ci = Components.interfaces;

var EXPORTED_SYMBOLS = [ 'Firesheep' ];

var Firesheep = {  
  config: FiresheepConfig,
  
  _captureSession: null,
  
  _loaded: false,
  
  _results: null,
  
  load: function () {
    if (!this._loaded) {
      this.config.load();
      
      this.clearSession();
      
      this._loaded = true;
      
      // Watch for config changes.
      Observers.add('FiresheepConfig', function (data) {
        if (data.action == 'scripts_changed')
          Firesheep.reloadScripts();
      });
    }
  },
  
  /*
  saveSession: function () {
    
  },
  
  loadSession: function () {
    
  },
  */
  
  clearSession: function () {
    this.stopCapture();
    this._results = [];
    this._captureSession = null;

    if (this._loaded)
      Observers.notify('Firesheep', { action: 'session_loaded' });
  },
  
  startCapture: function () {
    try {
      if (this.isCapturing)
        return;

      var prefs = Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefBranch);
      var iface = prefs.getCharPref('firesheep.capture_interface');
      if (iface == null || iface == '')
        throw 'Invalid interface';
    
      var filter = prefs.getCharPref('firesheep.capture_filter');
      if (filter == null || filter == '')
        throw 'Invalid filter';
    
      this._captureSession = new FiresheepSession(this, iface, filter);
      this._captureSession.start();
    } catch (e) {
      Observers.notify('Firesheep', { action: 'error', error: e });
    }
  },
  
  stopCapture: function () {
    try {
      if (this._captureSession)
        this._captureSession.stop();
    } catch (e) {
      Observers.notify('Firesheep', { action: 'error', error: e });
    }
  },
  
  toggleCapture: function () {
    if (!this.isCapturing)
      this.startCapture();
    else
      this.stopCapture();
  },
  
  get isCapturing () {
    return ((this._captureSession != null) && this._captureSession.isCapturing); 
  },
  
  get results () {
    return this._results;
  },
  
  get handlers () {
    var handlers = {
      domains: {},
      dynamic: []
    };
    
    function loadScript(scriptText, scriptId) {
      var obj = ScriptParser.parseScript(scriptText);
      if (obj != null) {
        // Sort by domain.
        obj.domains.forEach(function (domain) {
          handlers.domains[domain] = obj;
        });
        
        // Dynamic handlers
        if (typeof(obj.matchPacket) == 'function') {
          dynamic.push(obj);
        }
      } else {
        dump('Failed to load script: ' + scriptName + '\n');
      }
    }
    
    _.each(this.builtinScripts, loadScript);
    _.each(this.config.userScripts, loadScript);
    
    return handlers;
  },
  
  get _scriptsDir () {
    var em = Cc["@mozilla.org/extensions/manager;1"].getService(Ci.nsIExtensionManager);
    var file = em.getInstallLocation('firesheep@codebutler.com').location;
    file.append('firesheep@codebutler.com');
    file.append('handlers');
    return file;
  },
  
  get builtinScripts () {
    var builtinScripts = {};
    var files = this._scriptsDir.directoryEntries;
    while (files.hasMoreElements()) {
      var file = files.getNext().QueryInterface(Ci.nsILocalFile);
      if (file.leafName.match(/\.js$/)) {
        var scriptId = file.leafName;
        var scriptText = Utils.readAllText(file);
        builtinScripts[scriptId] = scriptText;
      }
    }
    return builtinScripts;
  },
    
  _handleResult: function (result) {
    this._results.push(result);
    Observers.notify('Firesheep', { action: 'result_added', result: result });
  }
};

Firesheep.load();