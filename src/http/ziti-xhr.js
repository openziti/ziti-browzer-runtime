/*
Copyright NetFoundry, Inc.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

https://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { isEqual, isNull, isUndefined } from "lodash-es";
import { ZitiProgressEventWrapper } from './ziti-event-wrapper';

function ZitiXMLHttpRequest () {

  /**
   * Private variables
   */
  var self = this;

  // Holds http.js objects
  var request;
  var response;

  // Request settings
  var settings = {};

  var headers = {};
  var headersCase = {};

  // These headers are not user setable.
  // The following are allowed but banned in the spec:
  // * user-agent
  var forbiddenRequestHeaders = [
    "accept-charset",
    "accept-encoding",
    "access-control-request-headers",
    "access-control-request-method",
    "connection",
    "content-length",
    "content-transfer-encoding",
    "cookie",
    "cookie2",
    "date",
    "expect",
    "host",
    "keep-alive",
    "origin",
    "referer",
    "te",
    "trailer",
    "transfer-encoding",
    "upgrade",
    "via"
  ];

  // These request methods are not allowed
  var forbiddenRequestMethods = [
    "TRACE",
    "TRACK",
    "CONNECT"
  ];

  // Send flag
  var sendFlag = false;
  // Error flag, used when errors occur or abort is called
  var errorFlag = false;

  // Event listeners
  var listeners = {};

  // If the target URL is the bootstrapper, just use the native XHR
  const shouldUseNative = (url) => {

    let targetURL;
    try {
      targetURL = new URL(url);
    }
    catch (e) {
      return false;
    }
    if (isEqual(targetURL.host, window.zitiBrowzerRuntime.zitiConfig.browzer.bootstrapper.self.host) && isEqual(targetURL.port, window.zitiBrowzerRuntime.zitiConfig.browzer.bootstrapper.self.port)) {
      return true;
    } else {
      return false;
    }    
  };

  /**
   * Constants
   */

  this.UNSENT = 0;
  this.OPENED = 1;
  this.HEADERS_RECEIVED = 2;
  this.LOADING = 3;
  this.DONE = 4;

  /**
   * Public vars
   */

  // Current state
  this.readyState = this.UNSENT;

  // default ready state change handler in case one is not set or is set late
  this.onreadystatechange = null;

  // default abort handler in case one is not set or is set late
  this.onabort = null;

  // Result & response
  this.responseBodyText = "";
  this.responseText = "";
  this.responseXML = "";
  this.status = null;
  this.statusText = null;

  // Whether cross-site Access-Control requests should be made using
  // credentials such as cookies or authorization headers
  this.withCredentials = false;

  // Save a ref to the native XHR
  this.xhr = new window._ziti_realXMLHttpRequest();
  this.usingNativeXHR = false;

  /**
   * Private methods
   */

  /**
   * Check if the specified header is allowed.
   *
   * @param string header Header to validate
   * @return boolean False if not allowed, otherwise true
   */
  var isAllowedHttpHeader = function(header) {
    return (header && forbiddenRequestHeaders.indexOf(header.toLowerCase()) === -1);
  };

  /**
   * Check if the specified method is allowed.
   *
   * @param string method Request method to validate
   * @return boolean False if not allowed, otherwise true
   */
  var isAllowedHttpMethod = function(method) {
    return (method && forbiddenRequestMethods.indexOf(method) === -1);
  };

  /**
   * Public methods
   */

  /**
   * Open the connection. Currently supports local server requests.
   *
   * @param string method Connection method (eg GET, POST)
   * @param string url URL for the connection.
   * @param boolean async Asynchronous connection. Default is true.
   * @param string user Username for basic authentication (optional)
   * @param string password Password for basic authentication (optional)
   */
  this.open = function(method, url, async, user, password) {

    if (!isUndefined(async)) { // default is true
      if (!async) {
        window.zitiBrowzerRuntime.synchronousXHREncounteredEventHandler({url: url});
      }
    }

    if (shouldUseNative(url)) {
      console.log('Falling back to native XHR for:', url);
      this.usingNativeXHR = true;
      return this.xhr.open(method, url, async, user, password);
    }

    errorFlag = false;

    // Check for valid request method
    if (!isAllowedHttpMethod(method)) {
      throw new Error("SecurityError: Request method not allowed");
    }

    this.settings = {
      "method": method,
      "url": url.toString(),
      "async": (typeof async !== "boolean" ? true : async),
      "user": user || null,
      "password": password || null
    };

    // Hack for ScadaLTS web app
    if (this.settings.url.includes(':undefined')) {
      this.settings.url = this.settings.url.replace(':undefined', '');
    }

    this.setState(this.OPENED);
  };

  /**
   * Sets a header for the request or appends the value if one is already set.
   *
   * @param string header Header name
   * @param string value Header value
   */
  this.setRequestHeader = function(header, value) {
    if (this.usingNativeXHR) {
      this.xhr.setRequestHeader(header, value);
      return;
    }
    if (this.readyState !== this.OPENED) {
      throw new Error("INVALID_STATE_ERR: setRequestHeader can only be called when state is OPEN");
    }
    if (!isAllowedHttpHeader(header)) {
      console.warn("Refused to set unsafe header \"" + header + "\"");
      return;
    }
    if (sendFlag) {
      throw new Error("INVALID_STATE_ERR: send flag is true");
    }
    header = headersCase[header.toLowerCase()] || header;
    headersCase[header.toLowerCase()] = header;
    headers[header] = headers[header] ? headers[header] + ', ' + value : value;
  };

  /**
   * Gets a header from the server response.
   *
   * @param string header Name of header to get.
   * @return string Text of the header or null if it doesn't exist.
   */
  this.getResponseHeader = function(header) {
    if (this.usingNativeXHR) {
      return this.xhr.getResponseHeader(header);
    }
    if (typeof header === "string"
      && this.readyState > this.OPENED
      && response
      && response.headers
      && !errorFlag
    ) {
      for (var pair of response.headers.entries()) {
        if (header.toLowerCase() === pair[0].toLowerCase()) {
          return pair[1].toLowerCase();
        }
      }
      return null;
    }
    return null;
  };

  /**
   * Gets all the response headers.
   *
   * @return string A string with all response headers separated by CR+LF
   */
  this.getAllResponseHeaders = function() {
    if (this.usingNativeXHR) {
      return this.xhr.getAllResponseHeaders();
    }
    if (this.readyState < this.HEADERS_RECEIVED || errorFlag) {
      return "";
    }

    let headersObject = Object.fromEntries(this.responseObject.headers.entries());

    let str = '';

    for (var prop in headersObject) {
      if (Object.prototype.hasOwnProperty.call(headersObject, prop)) {
        str = str + (prop + ':' + headersObject[prop] + '\r\n');
      }
    }

    return str;
  };

  /**
   * Gets a request header
   *
   * @param string name Name of header to get
   * @return string Returns the request header or empty string if not set
   */
  this.getRequestHeader = function(name) {
    if (this.usingNativeXHR) {
      return this.xhr.getRequestHeader(name);
    }
    if (typeof name === "string" && headersCase[name.toLowerCase()]) {
      return headers[headersCase[name.toLowerCase()]];
    }

    return "";
  };

  /**
   * Sends the request to the server.
   *
   * @param string data Optional data to send as request body.
   */
  this.send = async function(data) {
    if (this.usingNativeXHR) {
      return this.xhr.send(data);
    }

    if (this.readyState !== this.OPENED) {
      throw new Error("INVALID_STATE_ERR: connection must be opened before send() is called");
    }

    if (sendFlag) {
      throw new Error("INVALID_STATE_ERR: send has already been called");
    }

    errorFlag = false;
    sendFlag = true;

    // As per spec, this is called here for historical reasons.
    this.dispatchEvent("readystatechange");

    this.dispatchEvent("loadstart");

    this.settings.body = data;

    this.settings.headers = headers;

    await window.zitiBrowzerRuntime.awaitInitializationComplete();

    let url;
    let targetHost;
    // if (settings.url.startsWith('http')) {
    //   try {
    //     url = new URL(settings.url);
    //     targetHost = url.hostname;
    //   } catch (e) {
    //     debugger
    //   }
    // }
    if (!this.settings.url.startsWith('/')) {
      url = new URL(this.settings.url, `https://${window.zitiBrowzerRuntime.zitiConfig.browzer.bootstrapper.self.host}`);
      targetHost = url.hostname;
    } else {
      url = new URL(`https://${window.zitiBrowzerRuntime.zitiConfig.browzer.bootstrapper.self.host}${this.settings.url}`);
      targetHost = window.zitiBrowzerRuntime.zitiConfig.browzer.bootstrapper.self.host;
    }
    if (isEqual(targetHost, window.zitiBrowzerRuntime.zitiConfig.browzer.bootstrapper.self.host)) {
      let protocol = url.protocol;
      if (!isEqual(protocol, 'https:')) {
        url.protocol = 'https:';
        this.settings.url = url.toString();
      }
    }

    response = await fetch(this.settings.url, this.settings);

    this.status = response.status;
    this.statusText = (response.status == 200) ? 'OK' : '';

    let self = this;

    response.blob().then(async function(blob) {
      if (isEqual(blob.type, 'application/pkix-cert')) {
        self.response = await blob.arrayBuffer();
      }
      else {
        self.responseBodyText = await blob.text();
        self.responseText = self.responseBodyText;
        self.response = self.responseBodyText;
        self.responseXML = self.responseBodyText;
        self.responseURL = self.settings.url;
        self.responseType = '';  
      }

      // create the (potential) XML DOM object 
      try {
        let parser = new DOMParser();
        self.responseXML = parser.parseFromString(self.responseBodyText, "text/xml");
      } catch (e) { /* NOP */ }
  
      self.responseObject = response;
      sendFlag = false;
      self.setState(self.DONE);
    });

  };

  /**
   * 
   */
  this.done = async function() {
    let self = this;
    return new Promise((resolve, _reject) => {
      (function waitFor_Done() {
        if (self.readyState !== self.DONE) {
          setTimeout(waitFor_Done, 100);
        } else {
          return resolve();
        }
      })();
    });
  }


  /**
   * Called when an error is encountered to deal with it.
   */
  this.handleError = function(error) {
    this.status = 0;
    this.statusText = error;
    this.responseText = error.stack;
    errorFlag = true;
    this.setState(this.DONE);
    this.dispatchEvent('error');
  };

  /**
   * Aborts a request.
   */
  this.abort = function() {
    if (this.usingNativeXHR) {
      return this.xhr.abort();
    }
    if (request) {
      request.abort();
      request = null;
    }

    // headers = defaultHeaders;
    this.status = 0;
    this.responseText = "";
    this.responseXML = "";

    errorFlag = true;

    if (this.readyState !== this.UNSENT
        && (this.readyState !== this.OPENED || sendFlag)
        && this.readyState !== this.DONE) {
      sendFlag = false;
      this.setState(this.DONE);
    }
    this.readyState = this.UNSENT;
    this.dispatchEvent('abort');
  };

  /**
   * Adds an event listener. Preferred method of binding to events.
   */
  this.addEventListener = function(event, callback) {
    if (this.usingNativeXHR) {
      return this.xhr.addEventListener(event, callback);
    }
    if (!(event in listeners)) {
      listeners[event] = [];
    }
    // Currently allows duplicate callbacks. Should it?
    listeners[event].push(callback);
  };

  /**
   * Remove an event callback that has already been bound.
   * Only works on the matching funciton, cannot be a copy.
   */
  this.removeEventListener = function(event, callback) {
    if (this.usingNativeXHR) {
      return this.xhr.removeEventListener(event, callback);
    }
    if (event in listeners) {
      // Filter will return a new array with the callback removed
      listeners[event] = listeners[event].filter(function(ev) {
        return ev !== callback;
      });
    }
  };

  /**
   * Dispatch any events, including both "on" methods and events attached using addEventListener.
   */
  this.dispatchEvent = function(event) {
    if (this.usingNativeXHR) {
      return this.xhr.dispatchEvent(event);
    }
    if (typeof self["on" + event.type] === "function") {
      self["on" + event.type]();
    }
    else if (typeof self["on" + event] === "function") {
      self["on" + event]();
    }
    if (event.type in listeners) {
      for (var i = 0, len = listeners[event.type].length; i < len; i++) {
        listeners[event.type][i].call(event, event);
      }
    }
    else if (event in listeners) {
      for (var i = 0, len = listeners[event].length; i < len; i++) {
        self.target = self;
        listeners[event][i].call(self, self);
      }
    }
  };

  /**
   * Changes readyState and calls onreadystatechange.
   *
   * @param int state New state
   */
  this.setState = function(state) {
    if (this.usingNativeXHR) {
      return this.xhr.setState(state);
    }

    if (state == self.LOADING || self.readyState !== state) {
      self.readyState = state;

      if (self.settings.async || self.readyState < self.OPENED || self.readyState === self.DONE) {
        self.dispatchEvent("readystatechange");
      }

      if (self.readyState === self.DONE && !errorFlag) {

        let pe = new ZitiProgressEventWrapper("load", {
          loaded: true
        });
        pe.currentTarget = self;
        pe.target = self;
        pe.status = self.status;
        pe.success = (self.status == 200) ? true : false;
        pe.responseType = self.responseType;
        pe.responseText= self.responseText;

        self.dispatchEvent(pe);      
        // self.dispatchEvent("load");
        self.dispatchEvent("loadend");
      }
    }
  };

  this.upload = {
      addEventListener: function(arg1, arg2, arg3) {},
      removeEventListener: function(arg1, arg2, arg3) {},
  }

};


export {
  ZitiXMLHttpRequest
};
