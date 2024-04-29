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

import { 
  ZitiBrowzerCore,
  ZITI_CONSTANTS,
} from '@openziti/ziti-browzer-core';

import {Workbox} from'workbox-window';
import { Base64 } from 'js-base64';
import { isUndefined, isNull, isEqual } from 'lodash-es';
import CookieInterceptor from 'cookie-interceptor';
import { v4 as uuidv4 } from 'uuid';
import jwtDecode from 'jwt-decode';

import pjson from '../package.json';
import { flatOptions } from './utils/flat-options'
import { defaultOptions } from './options'
import { ZBR_CONSTANTS } from './constants';
import { ZitiXMLHttpRequest } from './http/ziti-xhr';
import { ZitiDummyWebSocketWrapper } from './http/ziti-dummy-websocket-wrapper';
import { ZitiProgressEventWrapper } from './http/ziti-event-wrapper';
import { buildInfo } from './buildInfo'
import { ZitiBrowzerLocalStorage } from './utils/localstorage';
import { Auth0Client } from '@auth0/auth0-spa-js';
import Bowser from 'bowser'; 
import uPlot from 'uplot';
import * as msal from '@azure/msal-browser';
import { stringify } from './urlon';
import * as oidc from 'oauth4webapi'
import {
  getPKCERedirectURI, 
  pkceLogin, 
  pkceLogout,
  pkceLogoutIsNeeded,
  pkceCallback,
  PKCEToken,
} from './oidc/utils';
import { jspi } from "wasm-feature-detect";


/**
 * 
 */
(function(){var e="ZBR Logging Begins...";if(navigator&&navigator.userAgent){var o=navigator.userAgent.match(/opera|chrome|safari|firefox|msie|trident(?=\/)/i);if(o&&o[0].search(/trident|msie/i)<0)return window.console.log("%cZiti BrowZer Runtime is now Bootstrapping","color:white;font-size:x-large;font-weight:bold;background-image: linear-gradient(to right, #0965f3, #e10c5c) !important;"),void window.console.log("%c"+e,"font-size:large;")}window.console.log("Ziti BrowZer Runtime is now Bootstrapping\n"+e)})();

/**
 *  origin trial token decode
 */
function base64decode(str) {
  return new Uint8Array([...atob(str)].map(a => a.charCodeAt(0)));
}
function decodeOriginTrialToken(token) {
  const buf = base64decode(token);
  const view = new DataView(buf.buffer)
  const version = view.getUint8()
  const signature = buf.slice(1, 65)
  const length = view.getUint32(65, false)
  const payload = JSON.parse((new TextDecoder()).decode(buf.slice(69, 69 + length)))
  return {payload, version, length, signature}
}

/**
 * 
 */
if (typeof window._ziti_realFetch === 'undefined') {
  window._ziti_realFetch          = window.fetch;
  window._ziti_realXMLHttpRequest = window.XMLHttpRequest;
  window._ziti_realWebSocket      = window.WebSocket;
  window._ziti_realInsertBefore   = Element.prototype.insertBefore;
  window._ziti_realAppendChild    = Element.prototype.appendChild;
  window._ziti_realSetAttribute   = Element.prototype.setAttribute;
  window._ziti_realDocumentDomain = window.document.domain;
}

var regexZBSW = new RegExp( /ziti-browzer-sw\.js/, 'gi' );

var regexAuth0URL   = new RegExp( ZBR_CONSTANTS.AUTH0_URL_REGEX, 'gi' );
var regexAzureADURL = new RegExp( ZBR_CONSTANTS.AZURE_AD_URL_REGEX, 'gi' );

function delay(time) { return new Promise(resolve => setTimeout(resolve, time)); }

/**
 * sendMessage() is used instead of wb.messageSW() for msgs where 
 * usage of wb.messageSW is unavailable.
 */
function sendMessage(message) {
  // This wraps the message posting/response in a promise, which will resolve if the response doesn't
  // contain an error, and reject with the error if it does. 
  return new Promise(function(resolve, reject) {
    var messageChannel = new MessageChannel();
    messageChannel.port1.onmessage = function(event) {
      if (event.data.error) {
        reject(event.data.error);
      } else {
        resolve(event.data);
      }
    };      
    // This sends the message data as well as transferring messageChannel.port2 to the service worker.
    navigator.serviceWorker.controller.postMessage(message,
      [messageChannel.port2]);
  });
}

/**
 * 
 */
function isTokenExpired(access_token) {
  let decoded_access_token = jwtDecode(access_token);
  let exp = decoded_access_token.exp;
  let isExpired = false;
  if (Date.now() >= exp * 1000) {
    isExpired = true;
    window.zitiBrowzerRuntime.logger.trace(`IdP token has expired`);
  }
  return isExpired;
}

/**
 * 
 */
function getOIDCConfig() {

  let oidcConfig = {
    name:                       'ZitiBrowzerRuntimeOIDCConfig',
    issuer:                     window.zitiBrowzerRuntime.zitiConfig.idp.host,
    client_id:                  window.zitiBrowzerRuntime.zitiConfig.idp.clientId,
    scopes:                     ['openid', 'email'],
    enablePKCEAuthentication:   true,
    token_endpoint_auth_method: 'none',
    redirect_uri:               getPKCERedirectURI().toString(),
    code_verifier:              oidc.generateRandomCodeVerifier(),
  };

  return oidcConfig;
}

class ZitiBrowZerRuntimeServiceWorkerRegistrationMock {

  /**
   * 
   * @param {*} options 
   * 
   */
  constructor(options) {
  }
  
  get waiting() {
    console.log(`ZitiBrowZerRuntimeServiceWorkerRegistrationMock.waiting() entered`);
    return null;
  }

  addEventListener(type, listener, useCapture) {
    console.log(`ZitiBrowZerRuntimeServiceWorkerRegistrationMock.addEventListener() entered`);
  }

}

/**
 * 
 */
class ZitiBrowzerRuntimeServiceWorkerMock {

  /**
   * 
   * @param {*} options 
   * 
   */
  constructor(options) {
  }

  /**
   * 
   */
  register(scriptURL, options) {
    // console.log(`ZitiBrowzerRuntimeServiceWorkerMock.register() entered [${scriptURL}] `, options);

    if ( (scriptURL.match( regexZBSW )) ) {

      return this._ziti_realRegister(scriptURL, options);

    } else {

      return new Promise((resolve) => {
        let zbrSWRM = new ZitiBrowZerRuntimeServiceWorkerRegistrationMock();
        return resolve( zbrSWRM );
      });
  
    }
  }

  /**
   * 
   */
  getRegistration() {
    console.log(`ZitiBrowzerRuntimeServiceWorkerMock.getRegistration() entered`);
  }

  /**
   * 
   */
  getRegistrations() {
    console.log(`ZitiBrowzerRuntimeServiceWorkerMock.getRegistrations() entered`);
  }

  /**
   * 
   */
  startMessages() {
    console.log(`ZitiBrowzerRuntimeServiceWorkerMock.startMessages() entered`);
  }

}

/**
 * 
 */
class ZitiBrowzerRuntime {

  /**
   * 
   * @param {*} options 
   * 
   */
  constructor(options) {
    
    let _options = flatOptions(options, defaultOptions);

    this.initialized    = false;

    /**
     *  Detect unsupported browsers based on platform we are running on. If an unsupported browser
     *  is detected, issue a Toast msg, and halt.
     */
    var browser = Bowser.getParser(window.navigator.userAgent);
    this.ua = Bowser.parse(window.navigator.userAgent);
    const isSupportedBrowser = browser.satisfies({

      // iOS must be using Safari because Chromium-based browsers have been
      // hobbled by Apple such that they lack Service Worker support.
      iOS: {
        safari: ">=10"
      },
        
      /**
      *  Otherwise, we must have one of the following browsers
      */
      chrome: ">=97",     // Chrome, Brave
      edge:   ">=97",     // Microsoft Edge
      safari: ">=10",     // Safari
      electron: ">=27",   // Electron
      googlebot: ">=2.1"  // squelch Googlebot spam

    });
    if (!isSupportedBrowser) {

      let errStr = `The browser you are using:\n\n${this.ua.browser.name} v${this.ua.browser.version}\n\nis currently unsupported by\nOpenZiti BrowZer Runtime v${_options.version}.`;

      this.browzer_error({
        status:   409,
        code:     ZBR_CONSTANTS.ZBR_ERROR_CODE_UNSUPPORTED_BROWSER,
        title:    `The browser you are using is: ${this.ua.browser.name} v${this.ua.browser.version}.`,
        message:  `This browser is currently unsupported by BrowZer Runtime v${_options.version}.`
      });

    }
     
    this._uuid          = uuidv4();

    this.version        = _options.version;
    this.core           = _options.core;
    this.localStorage   = _options.localStorage;
    this.authTokenName  = _options.authTokenName;

    this.zitiConfig     = this.getZitiConfig();

    this.logLevel       = this.zitiConfig.browzer.runtime.logLevel;
    this.hotKey         = this.zitiConfig.browzer.runtime.hotKey;
    this.controllerApi  = this.zitiConfig.controller.api;

    this.regexControllerAPI = new RegExp( this._controllerApi, 'g' );

    this.noActiveChannelDetectedEnabled    = false;
    this.noActiveChannelDetectedCounter    = 0;
    this.noActiveChannelDetectedThreshold  = _options.noActiveChannelDetectedThreshold;

    window.zitiBrowzerRuntime = this;

    let self = zitiBrowzerRuntime;
  
    CookieInterceptor.write.use( function ( cookie ) {
      cookie = cookie.replace('%25','%');
      let name = cookie.substring(0, cookie.indexOf("="));
      let value = cookie.substring(cookie.indexOf("=") + 1);
      let cookie_value = value.substring(0, value.indexOf(";"));
      if (isEqual(cookie_value, '')) {
        cookie_value = value;
      }
  
      if (!isEqual(name, self.authTokenName)) {
        window.zitiBrowzerRuntime.wb.messageSW({
          type: 'SET_COOKIE', 
          payload: {
            name: name, 
            value: cookie_value
          } 
        });
      }
  
      return cookie;
    });  

    const loadedViaBootstrapper = document.getElementById('from-ziti-browzer-bootstrapper');

    if (!loadedViaBootstrapper) {

      // Toast infra
      this.PolipopCreated = false;
      setTimeout(this._createPolipop, 1000, this);

      // HotKey infra
      setTimeout(this._createHotKey, 5000, this);    

      // Click intercept infra
      setTimeout(this._createClickIntercept, 3000, this);
    
    }

    this.authClient = null;
    this.idp = null;

    this.xgressEventData = [
      [(Date.now() / 1000)],  // timestamp
      [0],                    // tx len
      [0],                    // rx len
    ];

  }  

  /**
   * 
   */
  _determineReloadNeeded() {

    if (!window.zitiBrowzerRuntime.noActiveChannelDetectedEnabled) return false;

    let activeChannelCount = window.zitiBrowzerRuntime.core.context.activeChannelCount();

    // window.zitiBrowzerRuntime.logger.trace(`activeChannelCount is ${activeChannelCount}`);

    if (activeChannelCount < 1) {
      // If there are active Channels, increment the number of times we've seen that state
      window.zitiBrowzerRuntime.noActiveChannelDetectedCounter ++;
      window.zitiBrowzerRuntime.logger.trace(`noActiveChannelDetectedCounter is ${window.zitiBrowzerRuntime.noActiveChannelDetectedCounter}`);

      // If we have seen too many cycles where there are no active Channels, then trigger a reboot
      if (window.zitiBrowzerRuntime.noActiveChannelDetectedCounter > window.zitiBrowzerRuntime.noActiveChannelDetectedThreshold) {
        return true;
      }
    } else {
      // If there are active channels, then reset the threshold
      window.zitiBrowzerRuntime.noActiveChannelDetectedCounter == 0;
    }

    return false;
  }
  
  _reloadNeededHeartbeat(self) {

    if (self.logger) {

      // self.logger.trace(`_reloadNeededHeartbeat: visibilityState is ${document.visibilityState}`);

      if (document.visibilityState === "visible") {

        if (window.zitiBrowzerRuntime._determineReloadNeeded()) {

          window.zitiBrowzerRuntime.toastWarning(`No active Channels -- Page reboot needed.`);

          setTimeout(function() {
            window.zitiBrowzerRuntime.logger.warn(`No active Channels -- Page reboot needed`);
            window.zitiBrowzerRuntime.wb.messageSW({
              type: 'UNREGISTER', 
              payload: {
              } 
            });
          }, 500);
        }
      }
    }

    setTimeout(self._reloadNeededHeartbeat, 1000*5, self );
  }

  _obtainBootStrapperURL() {
    let url;

    if (window.zitiBrowzerRuntime.zitiConfig.browzer.loadbalancer.host) {
      url = `https://${window.zitiBrowzerRuntime.zitiConfig.browzer.bootstrapper.self.host}:${window.zitiBrowzerRuntime.zitiConfig.browzer.loadbalancer.port}`;
    } else {
      url = `${window.zitiBrowzerRuntime.zitiConfig.browzer.bootstrapper.self.scheme}://${window.zitiBrowzerRuntime.zitiConfig.browzer.bootstrapper.self.host}:${window.zitiBrowzerRuntime.zitiConfig.browzer.bootstrapper.self.port}`;
    }
    return url;
  }

  /**
   *  Do a periodic fetch of a (cached) file so that the SW will not deactivate when the browser tab is minimized
   */
  _serviceWorkerKeepAliveHeartBeat(self) {
    fetch(`${ self._obtainBootStrapperURL() }/ziti-browzer-logo.svg`);
    setTimeout(self._serviceWorkerKeepAliveHeartBeat, 1000*20, self );
  }

  /**
   *  Do a periodic fetch of the 'latest' browZer release number (the one sitting out in GHCR)
   */
  async _getLatestBrowZerReleaseVersion(self) {
    let resp = await window._ziti_realFetch(`${ self._obtainBootStrapperURL() }/ziti-browzer-latest-release-version`);
    const json = await resp.json();
    window.zitiBrowzerRuntime.zitiConfig.browzer.bootstrapper.self.latestReleaseVersion = json.latestBrowZerReleaseVersion;
    setTimeout(self._getLatestBrowZerReleaseVersion, (1000 * 60 * 5) /* every 5 minutes */, self );
  }
  
  _zbrPing(self) {
    window.zitiBrowzerRuntime.wb.messageSW({
      type: 'ZBR_PING', 
      payload: {
        timestamp: Date.now()
      } 
    });
    setTimeout(self._zbrPing, 1000, self );
  }

  /**
   *  Determine if the specified DOM element contains the `download` attribute
   */
  _isAElementWithDownloadAttr(target) {
    if (target) {
      if (isEqual(target.nodeName, 'A')) {
        if (!isNull(target.attributes.getNamedItem('download'))) {
          return true;
        } else {
          return false;
        }
      }
    }
  }

  /**
   *  Intercept mouse clicks that occur anywhere in the DOM.
   *  We need to do this in order to properly handle attempts to 
   *  download items in the web app's UI that contain the `download` 
   *  attribute.
   */
  _createClickIntercept(self) {

    const bodyEls = document.getElementsByTagName('body');

    if (bodyEls.length > 0) {

      bodyEls[0].onclick = function(e) {

        // Some web apps will wrap the <a> element in an <svg> element,
        // or ever deeped, with a <path> element.  We therefore need to
        // walk the DOM tree up a few levels to determine if there is an
        // <a> element involved.  We limit the search, however, to 3.
        let maxDepth = 3;

        let target = e.target;
        let found = false;

        // Walk the DOM
        while (!found && target && (maxDepth > 0)) {
          if (self._isAElementWithDownloadAttr(target)) {
            found = true;
          } else {
            target = target.parentElement;
          }
          maxDepth--;
        }

        // If we determined that an <a download> element is involved
        if (found) {

          e.preventDefault(); // Take control of the click
          
          // Cause the browser to do a download over Ziti
          let hrefURL = new URL( target.href );
          if (!hrefURL.searchParams.has('download')) {
            hrefURL.searchParams.append('download', '1');
          }
          window.location = hrefURL.toString();
        }

      }
    }

  }

  _createPolipop(self) {

    if (!self.PolipopCreated) {
      try {
        if (document.body && (typeof Polipop !== 'undefined')) {
          self.polipop = new Polipop('ziti-browzer-toast', {
            layout: 'popups',
            position: 'center',
            insert: 'after',
            theme: 'compact',
            pool: 10,
            sticky: false,
            progressbar: true,
            headerText: 'OpenZiti browZer',
            effect: 'slide',
            closer: false,
            life: 3000,
            icons: true,
          });
          self.PolipopCreated = true;
          self.logger?.debug(`_createPolipop: Polipop bootstrap completed`);
        }
        else {
          self.logger?.debug(`_createPolipop: awaiting Polipop bootstrap`);
          setTimeout(self._createPolipop, 100, self);
        }
      }
      catch (e) {
        self.logger?.error(`_createPolipop: bootstrap error`, e);
        setTimeout(self._createPolipop, 1000, self);
      }
    }
  }

  _createHotKey(self) {
    if (typeof hotkeys !== 'undefined') {

      hotkeys(self.hotKey, function (event, handler){
        switch (handler.key) {
          case self.hotKey: 
            self.hotKeyModal.open("#zbrHotKeyModal")
            break;
          default: alert(event);
        }
      });

      self._createHotKeyModal(self);

    } else {
      setTimeout(self._createHotKey, 1000, self);
    }
  }

  async _saveLogLevel(loglevelValue) {
    await window.zitiBrowzerRuntime.localStorage.setWithExpiry(
      'ZITI_BROWZER_RUNTIME_LOGLEVEL',
      loglevelValue, 
      new Date(8640000000000000)
    );
  }

  _generateLogLevelOption(option, logLevel) {
    let html = isEqual(option.toLowerCase(), logLevel) ? `<option value="${option.toLowerCase()}" selected>${option}</option>` : `<option value="${option.toLowerCase()}">${option}</option>`;
    return html;
  }
  _generateLogLevelOptions() {

    let html = '<option value="">Choose</option>';
        html += window.zitiBrowzerRuntime._generateLogLevelOption('Silent', window.zitiBrowzerRuntime.logLevel);
        html += window.zitiBrowzerRuntime._generateLogLevelOption('Error', window.zitiBrowzerRuntime.logLevel);
        html += window.zitiBrowzerRuntime._generateLogLevelOption('Warning', window.zitiBrowzerRuntime.logLevel);
        html += window.zitiBrowzerRuntime._generateLogLevelOption('Info', window.zitiBrowzerRuntime.logLevel);
        html += window.zitiBrowzerRuntime._generateLogLevelOption('Debug', window.zitiBrowzerRuntime.logLevel);
        html += window.zitiBrowzerRuntime._generateLogLevelOption('Trace', window.zitiBrowzerRuntime.logLevel);

    return html;
  }

  _xgressEventPing(self) {

    zitiBrowzerRuntime.updateXgressEventData({
      type: ZITI_CONSTANTS.ZITI_EVENT_XGRESS_TX,
      len: 0
    });

    // Remove all data-points that are too old
    let MAX_AGE_SECONDS = 60;
    let now = Math.floor(Date.now() / 1000);
    function isTooOld(ts) {
      let age = now - ts;
      let youngEnough = (age < MAX_AGE_SECONDS);
      return youngEnough;
    }
    zitiBrowzerRuntime.xgressEventData[0] = zitiBrowzerRuntime.xgressEventData[0].filter( isTooOld );
    zitiBrowzerRuntime.xgressEventData[1].splice(0, zitiBrowzerRuntime.xgressEventData[1].length - zitiBrowzerRuntime.xgressEventData[0].length);
    zitiBrowzerRuntime.xgressEventData[2].splice(0, zitiBrowzerRuntime.xgressEventData[2].length - zitiBrowzerRuntime.xgressEventData[0].length);

    zitiBrowzerRuntime.xgressEventChart.setData( zitiBrowzerRuntime.xgressEventData);

    setTimeout(self._xgressEventPing, 1000, self );
  }

  _createStatusBar(self) {

    if (isNull(document.body)) {
      let b = document.createElement("body");
      document.body = b;
    }

    let div = document.createElement("div");
    div.setAttribute('class', 'zitiBrowzerRuntime_bottom-bar');

    let css = document.createElement("link");
    css.setAttribute('rel', 'stylesheet');
    css.setAttribute('href', `${self._obtainBootStrapperURL()}/ziti-browzer-css.css`);
    div.appendChild(css);

    let div2 = document.createElement("div");
    div2.setAttribute('class', 'zitiBrowzerRuntime_bottom-bar__content');

    let img = document.createElement("img");
    img.setAttribute('style', 'width: 5%;');
    img.setAttribute('src', `${self._obtainBootStrapperURL()}/ziti-browzer-logo.svg`);
    div2.appendChild(img);

    div.appendChild(div2);

    let chartEl = document.createElement("div");
    chartEl.setAttribute('id', 'zitiBrowzerRuntime_bottom-bar__chart');
    div2.appendChild(chartEl);

    /**
     * 
     */
    const { bars } = uPlot.paths;

    // generate bar builder with 60% bar (40% gap) & 100px max bar width
    const _bars60_100 = bars({
      size: [0.6, 100],
    });            

    const opts = {
      width:  800,
      height: 250,
      title: `Loading Status for Ziti Service [${zitiBrowzerRuntime.zitiConfig.browzer.bootstrapper.target.service}]  --  BrowZer xgress (bytes)`,
      scales: {
        "y": {
          auto: true,
        }
      },    
      series: [
        {
        },
        {
          label:  "Send",
          stroke: "blue",
          width:  2,
          paths:  _bars60_100,
          points: {show: true},
        },
        {
          label:  "Recv",
          stroke: "green",
          width:  2,
          paths:  _bars60_100,
          points: {show: true},
        },
      ],
    };      

    zitiBrowzerRuntime.xgressEventChart = new uPlot(opts, zitiBrowzerRuntime.xgressEventData, chartEl);

    setTimeout(zitiBrowzerRuntime._xgressEventPing, 10, zitiBrowzerRuntime );

    let moveLabel = document.createElement("label");
    moveLabel.setAttribute('id', 'zitiBrowzerRuntime_bottom-bar__move');
    moveLabel.innerText = 'Click Here and Drag to Move';
    div2.appendChild(moveLabel);

    let closeLabel = document.createElement("label");
    closeLabel.setAttribute('id', 'zitiBrowzerRuntime_bottom-bar__close');
    closeLabel.setAttribute('class', 'zitiBrowzerRuntime_bottom-bar__close');
    closeLabel.innerText = 'Click Here to Close';
    div2.appendChild(closeLabel);

    document.body.appendChild(div);

    function dragElement(elmnt) {

      var pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

      function dragMouseDown(e) {
        e = e || window.event;
        e.preventDefault();
        // get the mouse cursor position at startup:
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = closeDragElement;
        // call a function whenever the cursor moves:
        document.onmousemove = elementDrag;
      }

      function elementDrag(e) {
        e = e || window.event;
        e.preventDefault();
        // calculate the new cursor position:
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        // set the element's new position:
        elmnt.parentElement.parentElement.style.top = (elmnt.parentElement.parentElement.offsetTop - pos2) + "px";
        elmnt.parentElement.parentElement.style.left = (elmnt.parentElement.parentElement.offsetLeft - pos1) + "px";
      }

      function closeDragElement() {
        // stop moving when mouse button is released:
        document.onmouseup = null;
        document.onmousemove = null;
      }

      
      if (document.getElementById(elmnt.id)) {
        // if present, the header is where you move the DIV from:
        document.getElementById(elmnt.id).onmousedown = dragMouseDown;
      } else {
        // otherwise, move the DIV from anywhere inside the DIV:
        elmnt.onmousedown = dragMouseDown;
      }

    }

    dragElement(document.getElementById('zitiBrowzerRuntime_bottom-bar__move'));

  }

  _createHotKeyModal(self) {

    if (isNull(document.body)) return;

    let div = document.createElement("div");
    div.setAttribute('class', 'hystmodal');
    div.setAttribute('id', 'zbrHotKeyModal');
    div.setAttribute('aria-hidden', 'true');
    document.body.appendChild(div);

    let div2 = document.createElement("div");
    div2.setAttribute('class', 'hystmodal__wrap');
    div.appendChild(div2);

    let div3 = document.createElement("div");
    div3.setAttribute('class', 'hystmodal__window');
    div3.setAttribute('role', 'dialog');
    div3.setAttribute('aria-hidden', 'true');
    div2.appendChild(div3);

    let btn = document.createElement("button");
    btn.setAttribute('class', 'hystmodal__close');
    btn.setAttribute('data-hystclose', 'data-hystclose');
    div3.appendChild(btn);

    let div4 = document.createElement("div");
    div4.setAttribute('class', 'hystmodal__styled');
    div3.appendChild(div4);

    let div5 = document.createElement("div");
    div5.setAttribute('class', 'zitiBrowzerRuntimeSettings');
    div4.appendChild(div5);

    let css = document.createElement("link");
    css.setAttribute('rel', 'stylesheet');
    css.setAttribute('href', `${self._obtainBootStrapperURL()}/ziti-browzer-css.css`);
    div5.appendChild(css);

    let img = document.createElement("img");
    img.setAttribute('src', `${self._obtainBootStrapperURL()}/ziti-browzer-logo.svg`);
    img.setAttribute('style', 'width: 15%;');

    let span1 = document.createElement("span");
    span1.setAttribute('style', 'margin-bottom: 30px; color: #2a6eda; font-weight: 600; font-size: 20px; line-height: 36px; display: table; margin: 0px auto; margin-top: 10px;');
    span1.appendChild(img);

    let span2 = document.createElement("span");
    span2.textContent = `OpenZiti BrowZer (v${window.zitiBrowzerRuntime.zitiConfig.browzer.bootstrapper.self.version}) Settings`;

    let updateAvailable = '';
    if (!isUndefined(window.zitiBrowzerRuntime.zitiConfig.browzer.bootstrapper.self.latestReleaseVersion)) {
      updateAvailable = isEqual(window.zitiBrowzerRuntime.zitiConfig.browzer.bootstrapper.self.version, window.zitiBrowzerRuntime.zitiConfig.browzer.bootstrapper.self.latestReleaseVersion) ? '' 
        : `A New BrowZer Release <span style="color:#ec1f2d;font-size: 18px;font-weight:600">(v${window.zitiBrowzerRuntime.zitiConfig.browzer.bootstrapper.self.latestReleaseVersion})</span> is Available`;
    }

    span1.appendChild(span2);
    div5.appendChild(span1);

    let htmlString = `
<div class="container" style="width:580px;">
    <div class="row">
        <section class="col-xs-12 col-sm-8 col-sm-offset-2 col-xl-6 col-xl-offset-3 my-4" style="margin-left: auto;">
            <div>
            <br/>
            <form action="${window.zitiBrowzerRuntime._obtainBootStrapperURL()}">
                <fieldset>
                    <div class="row" style="position: relative">
                        <div class="form-group col-xs-12" id="Client-side_Logging_Level__div">
                          <label for="Client-side_Logging_Level">Client-side Loglevel</label>
                          <div>
                            <select name="ziti-browzer-loglevel" id="ziti-browzer-loglevel" required="required" autofocus="autofocus" class="form-control">
                              ${window.zitiBrowzerRuntime._generateLogLevelOptions()}
                            </select>
                            <button type="submit" id="ziti-browzer-hidden-button" class="hiddenButton" style="display:none"></button>
                            <button type="button" id="ziti-browzer-save-button"   class="btn btn-primary" style="position: absolute;top: 25px;left: 170px; height: 32px;">
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
                                <path d="M10 3.75a2 2 0 1 0-4 0 2 2 0 0 0 4 0ZM17.25 4.5a.75.75 0 0 0 0-1.5h-5.5a.75.75 0 0 0 0 1.5h5.5ZM5 3.75a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1 0-1.5h1.5a.75.75 0 0 1 .75.75ZM4.25 17a.75.75 0 0 0 0-1.5h-1.5a.75.75 0 0 0 0 1.5h1.5ZM17.25 17a.75.75 0 0 0 0-1.5h-5.5a.75.75 0 0 0 0 1.5h5.5ZM9 10a.75.75 0 0 1-.75.75h-5.5a.75.75 0 0 1 0-1.5h5.5A.75.75 0 0 1 9 10ZM17.25 10.75a.75.75 0 0 0 0-1.5h-1.5a.75.75 0 0 0 0 1.5h1.5ZM14 10a2 2 0 1 0-4 0 2 2 0 0 0 4 0ZM10 16.25a2 2 0 1 0-4 0 2 2 0 0 0 4 0Z" />
                              </svg>
                              Save and Activate Loglevel
                            </button>
                          </div>
                        </div>
                    </div>
                    
                    <hr/>
                    
                    <div class="row">
                      <div class="form-group col-xs-12" id="changelog___div">
                        <div>
                          <div class="changelogButtonContainer" data-canny-changelog="true" style="position: relative;">
                            <button type="button" class="btn btn-primary">
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
                                <path fill-rule="evenodd" d="M15.312 11.424a5.5 5.5 0 0 1-9.201 2.466l-.312-.311h2.433a.75.75 0 0 0 0-1.5H3.989a.75.75 0 0 0-.75.75v4.242a.75.75 0 0 0 1.5 0v-2.43l.31.31a7 7 0 0 0 11.712-3.138.75.75 0 0 0-1.449-.39Zm1.23-3.723a.75.75 0 0 0 .219-.53V2.929a.75.75 0 0 0-1.5 0V5.36l-.31-.31A7 7 0 0 0 3.239 8.188a.75.75 0 1 0 1.448.389A5.5 5.5 0 0 1 13.89 6.11l.311.31h-2.432a.75.75 0 0 0 0 1.5h4.243a.75.75 0 0 0 .53-.219Z" clip-rule="evenodd" />
                              </svg>
                              View Changelog
                            </button>
                          </div>
                          <label style="position: absolute;top: 10px;left: 260px; height: 32px;">
                            ${updateAvailable}
                          </label>
                        </div>
                      </div>
                    </div>

                    <br/>

                    <div class="row">
                      <div class="form-group col-xs-12" id="feedback___div">
                        <div data-canny="true" style="position: relative;">
                          <button type="button" class="btn btn-primary" id="ziti-browzer-feedback-button">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
                              <path d="M3.505 2.365A41.369 41.369 0 0 1 9 2c1.863 0 3.697.124 5.495.365 1.247.167 2.18 1.108 2.435 2.268a4.45 4.45 0 0 0-.577-.069 43.141 43.141 0 0 0-4.706 0C9.229 4.696 7.5 6.727 7.5 8.998v2.24c0 1.413.67 2.735 1.76 3.562l-2.98 2.98A.75.75 0 0 1 5 17.25v-3.443c-.501-.048-1-.106-1.495-.172C2.033 13.438 1 12.162 1 10.72V5.28c0-1.441 1.033-2.717 2.505-2.914Z" />
                              <path d="M14 6c-.762 0-1.52.02-2.271.062C10.157 6.148 9 7.472 9 8.998v2.24c0 1.519 1.147 2.839 2.71 2.935.214.013.428.024.642.034.2.009.385.09.518.224l2.35 2.35a.75.75 0 0 0 1.28-.531v-2.07c1.453-.195 2.5-1.463 2.5-2.915V8.998c0-1.526-1.157-2.85-2.729-2.936A41.645 41.645 0 0 0 14 6Z" />
                            </svg>
                            Give Feedback
                          </button>
                        </div>  
                      </div>
                    </div>
                </fieldset>
            </form>
            </div>
        </section>
    </div>
</div>
`;

    div5.insertAdjacentHTML('beforeend', htmlString);

    let feedbackButton = document.getElementById("ziti-browzer-feedback-button");
    feedbackButton.onclick = function() {
      // Render Feedback widget
      Canny('render', {
        boardToken: 'c505a4cb-95c5-1682-47b4-99f9d75607fd',
        basePath: null,
        ssoToken: null,
        theme: 'light',
      });        
    };


    let saveButton = document.getElementById("ziti-browzer-save-button");

    saveButton.onclick = function() {

      let hiddenButton = document.getElementById("ziti-browzer-hidden-button");

      hiddenButton.onclick = function(e) {

        let loglevel = document.getElementById("ziti-browzer-loglevel");
        let loglevelValue = loglevel.value;
        if (!isEqual(loglevelValue, '')) {
          window.zitiBrowzerRuntime._saveLogLevel(loglevelValue);
          e.preventDefault();
          window.zitiBrowzerRuntime.toastSuccess(`New logLevel of '${loglevelValue}' now in effect`);
          window.zitiBrowzerRuntime.hotKeyModal.close();
          window.zitiBrowzerRuntime.toastWarning(`Page will now reload...`);
          setTimeout(function() {
            zitiBrowzerRuntime.logger.debug(`################ doing page reload now ################`);
            window.location.replace(window.zitiBrowzerRuntime._obtainBootStrapperURL() + zitiBrowzerRuntime.zitiConfig.browzer.bootstrapper.target.path);
          }, 2000);
        }

        /**
         * TODO: send rating to browZer Bootstrapper
         */

        // let rating = document.getElementById("ziti-browzer-rating");
        // let ratingValue = rating.value;

      };
  
      hiddenButton.click();
    };




    self.hotKeyModal = new HystModal({
      linkAttributeName:false,
      catchFocus: true,
      waitTransitions: true,
      closeOnEsc: true,
      beforeOpen: function(modal){
          console.log('Message before opening the modal');
          console.log(modal); //modal window object

          // Render Changelog widget
          Canny('initChangelog', {
            appID: '662b9d8df9e077a4f734779d',
            position: 'bottom',
            align: 'left',
            theme: 'light',
            omitNonEssentialCookies: true,
          });
          
          // Animate the badge if there are changelog items the user hasn't yet seen.
          setTimeout(async function() {

            var cbEl = document.getElementsByClassName('Canny_Badge');
            if (cbEl[0]) {
              cbEl[0].classList.add("fas");
              cbEl[0].classList.add("fa-bell");
            } else {
              var clbcEl = document.getElementsByClassName('changelogButtonContainer');
              if (clbcEl[0]) {
                clbcEl[0].classList.remove("changelogButtonContainer");
              }
            }
  
          }, 1000);      

      },
      afterClose: function(modal){
          console.log('Message after modal has closed');
          console.log(modal); //modal window object
      },
    });
  
    self.hotKeyModal.init();

  }

  /**
   * Extract the zitiConfig object from the Cookie sent from browZer Bootstrapper
   */
  getZitiConfig() {

    let zitiConfig = this.getCookie('__ziti-browzer-config');
    zitiConfig = decodeURIComponent(zitiConfig);
    zitiConfig = Base64.decode(zitiConfig);
    zitiConfig = JSON.parse(zitiConfig);

    return zitiConfig;
  }

  doIdpLogout() {

    window.zitiBrowzerRuntime.toastError(`Your browZer Session has expired -- Re-Authentication required -- stand by.`);

    window.zitiBrowzerRuntime.logger.trace( `doIdpLogout: token has expired and will be torn down`);

    setTimeout(async function() {

      window.zitiBrowzerRuntime.wb.messageSW({
        type: 'UNREGISTER', 
        payload: {
        } 
      });

      pkceLogout( getOIDCConfig(), getPKCERedirectURI().toString() );

    }, 5000);
  }

  idpAuthHealthEventHandler(idpAuthHealthEvent) {  

    this.logger.trace(`idpAuthHealthEventHandler() `, idpAuthHealthEvent);

    if (idpAuthHealthEvent.expired) {

      // Only initiate reboot once
      if (!window.zitiBrowzerRuntime.reauthInitiated) {

        window.zitiBrowzerRuntime.reauthInitiated = true;

        window.zitiBrowzerRuntime.doIdpLogout();

      }
    }
  }

  browzer_error( browzer_error_data_json ) {

    setTimeout(function() {
      window.location.href = `
        ${window.zitiBrowzerRuntime._obtainBootStrapperURL()}/browzer_error?browzer_error_data=${stringify(JSON.stringify(browzer_error_data_json))}
      `;
    }, 10);

  }

  originTrialTokenInvalidEventHandler(originTrialTokenUndefinedEvent) {
    window.zitiBrowzerRuntime.browzer_error({
      status:   409,
      code:     ZBR_CONSTANTS.ZBR_ERROR_CODE_ORIGIN_TRIAL_TOKEN_INVALID,
      title:    `OriginTrial token invalid or unspecified`,
      message:  `Possible network configuration issue exists.`
    });
  }

  originTrialSubDomainMismatchEventHandler(originTrialSubDomainMismatchEvent) {

    window.zitiBrowzerRuntime.browzer_error({
      status:   409,
      code:     ZBR_CONSTANTS.ZBR_ERROR_CODE_ORIGIN_TRIAL_SUBDOMAIN_MISMATCH,
      title:    `OriginTrial subdomain mismatch for feature [${originTrialSubDomainMismatchEvent.feature}]`,
      message:  `Expected origin [${originTrialSubDomainMismatchEvent.expectedOrigin}] but is accessed from [${originTrialSubDomainMismatchEvent.actualOrigin}]`
    });

  }

  noConfigForServiceEventHandler(noConfigForServiceEvent) {

    this.logger.trace(`noConfigForServiceEventHandler() `, noConfigForServiceEvent);

    window.zitiBrowzerRuntime.browzer_error({
      status:   409,
      code:     ZBR_CONSTANTS.ZBR_ERROR_CODE_SERVICE_HAS_NO_CONFIG,
      title:    `Ziti Service [${noConfigForServiceEvent.serviceName}] has no associated configs.`,
      message:  `Possible network configuration issue exists.`
    });

  }

  noConfigProtocolForServiceEventHandler(noConfigProtocolForServiceEvent) {

    this.logger.trace(`noConfigProtocolForServiceEventHandler() `, noConfigProtocolForServiceEvent);

    window.zitiBrowzerRuntime.browzer_error({
      status:   409,
      code:     ZBR_CONSTANTS.ZBR_ERROR_CODE_SERVICE_HAS_NO_CONFIG_PROTOCOL,
      title:    `Ziti Service [${noConfigProtocolForServiceEvent.serviceName}] lacks 'TCP' intercept|forward protocol in its config.`,
      message:  `Possible network configuration issue exists.`
    });

  }

  noServiceEventHandler(noServiceEvent) {

    this.logger.trace(`noServiceEventHandler() `, noServiceEvent);

    var distance = function (a, b) {
      var _a;
      if (a.length === 0)
          return b.length;
      if (b.length === 0)
          return a.length;
      if (a.length > b.length)
          _a = [b, a], a = _a[0], b = _a[1];
      var row = [];
      for (var i = 0; i <= a.length; i++)
          row[i] = i;
      for (var i = 1; i <= b.length; i++) {
          var prev = i;
          for (var j = 1; j <= a.length; j++) {
              var val = void 0;
              if (b.charAt(i - 1) === a.charAt(j - 1))
                  val = row[j - 1];
              else
                  val = Math.min(row[j - 1] + 1, prev + 1, row[j] + 1);
              row[j - 1] = prev;
              prev = val;
          }
          row[a.length] = prev;
      }
      return row[a.length];
    };

    var closestMatch = function (target, array, showOccurrences) {
      if (showOccurrences === void 0) { showOccurrences = false; }
      if (array.length === 0)
          return null;
      var vals = [];
      var found = [];
      for (var i = 0; i < array.length; i++)
          vals.push((0, distance)(target, array[i]));
      var min = Math.min.apply(Math, vals);
      for (var i = 0; i < vals.length; i++) {
          if (vals[i] === min)
              found.push(array[i]);
      }
      return showOccurrences ? found : found[0];
    };  
  
    let cm = closestMatch(noServiceEvent.serviceName, noServiceEvent.serviceList, true);

    window.zitiBrowzerRuntime.browzer_error({
      status:   409,
      code:     ZBR_CONSTANTS.ZBR_ERROR_CODE_SERVICE_NOT_IN_LIST,
      title:    `Ziti Service [${noServiceEvent.serviceName}] not found in list of Services your Identity can access.`,
      message:  `Closest match [${cm}] -- Possible network configuration issue exists.`
    });

  }

  sessionCreationErrorEventHandler(sessionCreationErrorEvent) {

    this.logger.trace(`sessionCreationErrorEventHandler() `, sessionCreationErrorEvent);

    window.zitiBrowzerRuntime.wb.messageSW({
      type: 'UNREGISTER', 
      payload: {
      } 
    });

    window.zitiBrowzerRuntime.browzer_error({
      status:   409,
      code:     ZBR_CONSTANTS.ZBR_ERROR_CODE_SERVICE_UNREACHABLE,
      title:    `Ziti Service [${window.zitiBrowzerRuntime.zitiConfig.browzer.bootstrapper.target.service}] cannot be reached -- [${sessionCreationErrorEvent.error}]`,
      message:  `Access was revoked from your Identity, or the Service might be down.`
    });

  }

  invalidAuthEventHandler(invalidAuthEvent) {

    this.logger.trace(`invalidAuthEventHandler() `, invalidAuthEvent);

    window.zitiBrowzerRuntime.browzer_error({
        status:   511,
        code:     ZBR_CONSTANTS.ZBR_ERROR_CODE_INVALID_AUTH,
        title:    `User [${invalidAuthEvent.email}] cannot be authenticated onto Ziti Network`,
        message:  `Check that this 'externalId' exists and has case-sensitive match`
    });

  }

  channelConnectFailEventHandler(channelConnectFailEvent) {

    this.logger.trace(`channelConnectFailEventHandler() `, channelConnectFailEvent);

    window.zitiBrowzerRuntime.wb.messageSW({
      type: 'UNREGISTER', 
      payload: {
      } 
    });

    window.zitiBrowzerRuntime.browzer_error({
      status:   409,
      code:     ZBR_CONSTANTS.ZBR_ERROR_CODE_SERVICE_UNREACHABLE,
      title:    `Ziti Service [${channelConnectFailEvent.serviceName}] connect attempt failed on Ziti Network.`,
      message:  `Access was revoked from your Identity, or the Service might be down.`
    });

  }

  requestFailedWithNoResponseEventHandler(requestFailedWithNoResponseEvent) {

    this.logger.trace(`requestFailedWithNoResponseEventHandler() `, requestFailedWithNoResponseEvent);

    if (requestFailedWithNoResponseEvent.url.toLowerCase().includes( zitiBrowzerRuntime.controllerApi.toLowerCase() )) {   // seeking Ziti Controller

      window.zitiBrowzerRuntime.browzer_error({
        status:   503,
        code:     ZBR_CONSTANTS.ZBR_ERROR_CODE_CONTROLLER_REQ_FAIL,
        title:    `HTTP Request to [${requestFailedWithNoResponseEvent.url}] failed.`,
        message:  `Possible server-side certificate issue exists.`
      });

    }

  }

  noWSSRoutersEventHandler(noWSSRoutersEvent) {

    this.logger.trace(`noWSSRoutersEventHandler() `, noWSSRoutersEvent);

    window.zitiBrowzerRuntime.browzer_error({
      status:   503,
      code:     ZBR_CONSTANTS.ZBR_ERROR_CODE_NO_WSS_ROUTERS,
      title:    `Cannot connect to Ziti Network Edge -- No WSS-Enabled Routers found.`,
      message:  `Current network is incompatible with BrowZer.`
    });

  }

  synchronousXHREncounteredEventHandler(syncXHREvent) {

    this.logger.trace(`synchronousXHREncounteredEventHandler() `, syncXHREvent);

    /**
     *  Bypass this for now
     */
    
    // window.zitiBrowzerRuntime.browzer_error({
    //   status:   503,
    //   code:     ZBR_CONSTANTS.ZBR_ERROR_CODE_SYNC_XHR_ENCOUNTERED,
    //   title:    `Ziti Service [${window.zitiBrowzerRuntime.zitiConfig.browzer.bootstrapper.target.service}] is using SynchronousXHR.`,
    //   message:  `This web application is incompatible with BrowZer.`
    // });

  }

  pkceCallbackErrorEventHandler(pkceCallbackErrorEvent) {

    this.logger.trace(`pkceCallbackErrorEventHandler() `, pkceCallbackErrorEvent);

    window.zitiBrowzerRuntime.browzer_error({
      status:   409,
      code:     ZBR_CONSTANTS.ZBR_ERROR_CODE_PKCE_CALLBACK_ERROR,
      title:    `PKCE Error: clientId[${pkceCallbackErrorEvent.client_id}] at OIDC issuer[${pkceCallbackErrorEvent.issuer}] must be a 'Single Page Application'.`,
      message:  `Possible IdP configuration issue exists.`
    });
    
  }


  updateXgressEventData(event) {

    zitiBrowzerRuntime.xgressEventData[0].push( Math.floor(Date.now() / 1000) );

    if (isEqual(event.type, ZITI_CONSTANTS.ZITI_EVENT_XGRESS_TX)) {
      zitiBrowzerRuntime.xgressEventData[1].push( event.len);
      zitiBrowzerRuntime.xgressEventData[2].push(0);
    }
    else if (isEqual(event.type, ZITI_CONSTANTS.ZITI_EVENT_XGRESS_RX)) {
      zitiBrowzerRuntime.xgressEventData[1].push(0);
      zitiBrowzerRuntime.xgressEventData[2].push(event.len);
    }

  }

  xgressEventHandler(xgressEvent) {

    zitiBrowzerRuntime.updateXgressEventData(xgressEvent);

  }

  nestedTLSHandshakeTimeoutEventHandler(tlsHandshakeTimeoutEvent) {

    this.logger.trace(`nestedTLSHandshakeTimeoutEventHandler() `, tlsHandshakeTimeoutEvent);

    window.zitiBrowzerRuntime.browzer_error({
      status:   503,
      code:     ZBR_CONSTANTS.ZBR_ERROR_CODE_NESTED_TLS_HANDSHAKE_TIMEOUT,
      title:    `TLS Handshake timeout connecting to Ziti Service [${tlsHandshakeTimeoutEvent.serviceName}]`,
      message:  `Please verify that destination server [${tlsHandshakeTimeoutEvent.dst_hostname}:${tlsHandshakeTimeoutEvent.dst_port}] is listening on HTTPS`
    });

  }

  /**
   * 
   */
  isOnMobile() {
    let check = false;
    (function(a){if(/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(a)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0,4))) check = true;})(navigator.userAgent||navigator.vendor||window.opera);
    return check;
  }
  
  /**
   * Instantiate the IdP auth client
   * 
   *  TODO: delete all this once we have tested the new OIDC support with AzureAD
   */
  async authClient_instantiate() {

    /**
     *  Identify the IdP
     */
    if ( (this.zitiConfig.idp.host.match( regexAuth0URL )) ) {
      this.idp = ZBR_CONSTANTS.AUTH0_IDP
    }
    else if ( (this.zitiConfig.idp.host.match( regexAzureADURL )) ) {
      this.idp = ZBR_CONSTANTS.AZURE_AD_IDP
    }
    else {

      window.zitiBrowzerRuntime.browzer_error({
        status:   409,
        code:     ZBR_CONSTANTS.ZBR_ERROR_CODE_INVALID_IDP_CONFIG,
        title:    `Invalid IdP config [${JSON.stringify(this.zitiConfig.idp)}]`,
        message:  `Cannot identify the specified IdP type`
      });
  
    }

    /**
     *  Instantiate the appropriate client
     */
    if ( isEqual(this.idp, ZBR_CONSTANTS.KEYCLOAK_IDP) ) {

      this.authClient = new Keycloak({
        url: this.zitiConfig.idp.host,
        realm: this.zitiConfig.idp.realm,
        clientId: this.zitiConfig.idp.clientId
      });
    
    }

    else if ( isEqual(this.idp, ZBR_CONSTANTS.AUTH0_IDP) ) {

      this.authClient = new Auth0Client({
        domain:   this.zitiConfig.idp.host,
        clientId: this.zitiConfig.idp.clientId,
        cacheLocation: 'localstorage', // valid values are: 'memory' or 'localstorage',
        authorizationParams: {
          redirect_uri: `${window.location.origin}`
        }    
      });

    } else if ( isEqual(this.idp, ZBR_CONSTANTS.AZURE_AD_IDP) ) {

      let msalConfig = {

        auth: {  
          clientId:     `${this.zitiConfig.idp.clientId}`,
          authority:    `${this.zitiConfig.idp.host}`,
          redirectUri:  `${window.location.origin}`,
          postLogoutRedirectUri: `${window.location.origin}`,
        },
        cache: {
            cacheLocation: "sessionStorage",
            storeAuthStateInCookie: false,
        },
        system: {
            loggerOptions: {
                loggerCallback: (level, message, containsPii) => {
                    if (containsPii) {
                        return;
                    }
                    switch (level) {
                        case msal.LogLevel.Error:
                            window.zitiBrowzerRuntime.logger.error(`${message}`);
                            return;
                        case msal.LogLevel.Info:
                            window.zitiBrowzerRuntime.logger.info(`${message}`);
                            return;
                        case msal.LogLevel.Verbose:
                            window.zitiBrowzerRuntime.logger.debug(`${message}`);
                            return;
                        case msal.LogLevel.Warning:
                            window.zitiBrowzerRuntime.logger.warn(`${message}`);
                            return;
                        default:
                            window.zitiBrowzerRuntime.logger.info(`${message}`);
                            return;
                    }
                }
            }
          }
      };

      window.zitiBrowzerRuntime.authClient = new msal.PublicClientApplication(msalConfig);
      window.zitiBrowzerRuntime.authClient.initialize().then(() => {
        window.zitiBrowzerRuntime.authClient.handleRedirectPromise().then(window.zitiBrowzerRuntime.handleAADRedirectResponse).catch(error => {
          window.zitiBrowzerRuntime.logger.error(`${error}`);
        });
      });
              
    }

  }

  handleAADRedirectResponse(resp) {

    window.zitiBrowzerRuntime.logger.trace(`handleAADRedirectResponse() resp: `, resp);

    if (resp !== null) {

      window.zitiBrowzerRuntime.authClient.setActiveAccount(resp.account);

    } else {

      const currentAccounts = window.zitiBrowzerRuntime.authClient.getAllAccounts();
      window.zitiBrowzerRuntime.logger.trace(`handleAADRedirectResponse() currentAccounts: `, currentAccounts);

      if (!currentAccounts || currentAccounts.length < 1) {
          return;
      } else {
          const activeAccount = currentAccounts[0];
          window.zitiBrowzerRuntime.authClient.setActiveAccount(activeAccount);
      }
      
    }

  }

  /**
   * Determine if the AAD client is currently authenticated
   */
  async authClient_isAuthenticated_AzureAD() {

    if (!isUndefined(window.zitiBrowzerRuntime.zitiConfig.access_token)) {
      return true;
    }

    let accounts = window.zitiBrowzerRuntime.authClient.getAllAccounts();

    // If no accounts found, it means we need to do an AzureAD login
    if (accounts.length === 0) {

      // Only initiate login redirect if one is not already in flight...
      if (isNull( sessionStorage.getItem("msal.interaction.status") )) {

        let msal_loginRequest = {
          scopes: ZBR_CONSTANTS.AZURE_AD_SCOPES,
        };
        
        await window.zitiBrowzerRuntime.authClient.loginRedirect( msal_loginRequest );
  
      }
  
      await window.zitiBrowzerRuntime.await_azure_ad_accountId();

      /**
       *  Control will not return here from the loginRedirect() call, but instead, 
       *  AzureAD will redirect to the root of the web app ZBR is embedded in, and 
       *  this time when authClient_isAuthenticated_AzureAD() is called during 
       *  bootstrap, the getAllAccounts() call will return an account for the user 
       *  that just authenticated, and we will proceed below this if-closure, and 
       *  obtain the token we need.
       */
    }

    let msal_tokenRequest = {
        scopes: ZBR_CONSTANTS.AZURE_AD_SCOPES,
    }

    let response = await window.zitiBrowzerRuntime.authClient.acquireTokenSilent( msal_tokenRequest ).catch (error => {
      window.zitiBrowzerRuntime.logger.warn(`${error}`);
      window.zitiBrowzerRuntime.isAuthenticated = false;
      return false;
    });

    if (response) {

      window.zitiBrowzerRuntime.zitiConfig.token_type = 'Bearer';
      window.zitiBrowzerRuntime.zitiConfig.access_token = response.idToken;
      window.zitiBrowzerRuntime.logger.trace(`authClient_isAuthenticated_AzureAD() access_token: ${window.zitiBrowzerRuntime.zitiConfig.access_token}`);
      document.cookie = window.zitiBrowzerRuntime.authTokenName + "=" + window.zitiBrowzerRuntime.zitiConfig.access_token + "; path=/";

      return true;

    }

    return false;
  }


  async await_azure_ad_accountId() {
    return new Promise((resolve, _reject) => {
      (async function waitFor_azure_ad_accountId() {
        const currentAccounts = window.zitiBrowzerRuntime.authClient.getAllAccounts();
        if (currentAccounts.length === 0) {
          setTimeout(waitFor_azure_ad_accountId, 100);
        } else {
          return resolve( 0 );
        }
      })();
    });
  }

  
  /**
   * 
   */
  async shouldUseJSPI() {
    
    // If the client browser has JSPI enabled
    if (await jspi()) {
      // ...then by all means, load JSPI WASM, regardless of whether the target web app needs nestedTLS or not
      return true;
    }

    // If the target web app doesn't need nestedTLS
    if (isEqual(this.zitiConfig.browzer.bootstrapper.target.scheme, 'http')) {
      // ...then we can use the NO-JSPI WASM
      return false;
    }

    let errStr = `The browser you are using:\n\n${this.ua.browser.name} v${this.ua.browser.version}\n\ndoes not currently have JSPI enabled.`;

    this.browzer_error({
      status:   409,
      code:     ZBR_CONSTANTS.ZBR_ERROR_CODE_JSPI_NOT_ENABLED,
      title:    `${errStr}`,
      message:  `WebAssembly JavaScript Promise Integration (JSPI) is required to access the Ziti Service known as [${this.zitiConfig.browzer.bootstrapper.target.service}]\n\nTo enable it:\n\n1) Enter chrome://flags in the address bar, 2) Search for "JSPI", 3) Enable it, 4) Relaunch the browser as suggested for it to take effect.`
    });

    return false;

  }

  /**
   * Initialize the ZitiBrowzerRuntime
   *
   * @param {Options} [options]
   * 
   */
  async initialize(options) {

    // Initialize eruda if it's present in the DOM
    if (typeof eruda !== 'undefined') {
      eruda.init({
        tool: [
          'console',
          'resources',
          'info',
        ],
        useShadowDom: true,
        autoScale: true,
        defaults: {
            displaySize: 50,
            transparency: 0.9,
            theme: 'Monokai Pro'
        }
      });
    }

    let logLevel = await window.zitiBrowzerRuntime.localStorage.get(
      'ZITI_BROWZER_RUNTIME_LOGLEVEL',
    );
    this.logLevel = logLevel ? logLevel : this.logLevel;
    this.zitiConfig.browzer.runtime.logLevel = this.logLevel;

    this.logger = this.core.createZitiLogger({
      logLevel: this.logLevel,
      suffix: 'ZBR'  // run-time
    });
    this.logger.trace(`ZitiBrowzerRuntime ${this._uuid} initializing`);

    // Skip the status bar (for now)
    // if (!this.isOnMobile()) {
    //   this._createStatusBar(this);
    // }

    // Facilitate removal of the bottom bar
    document.addEventListener("click", function(e) {
      if (typeof e.target.className.indexOf == 'function') {
        if (e.target.className.indexOf("zitiBrowzerRuntime_bottom-bar__close") !== -1) {
          document.body.remove(e.target.parentElement);    
        }
      }
    });


    let initResults = {
      authenticated:  true,
      unregisterSW:   false,
      loadedViaBootstrapper: options.loadedViaBootstrapper
    };

    this.zitiConfig.token_type = 'Bearer';

    /** ===================================================================
     *  Loded via the BrowZer Bootstrapper
    /** ================================================================= */
    if (options.loadedViaBootstrapper) {

      this.logger.trace(`initialize() Loaded via BOOTSTRAPPER`);

      // Pull the token from session storage
      this.zitiConfig.access_token  = PKCEToken.get();

      // If we have a token, determine if it has expired
      if (!isEqual(this.zitiConfig.access_token, null)) {  
        this.logger.trace(`initialize() session token found`);
        if (isTokenExpired(this.zitiConfig.access_token)) {
          this.isAuthenticated = false;
        } else {
          this.isAuthenticated = true;
        }
      } else {
        this.logger.trace(`initialize() session token NOT found`);
        this.isAuthenticated = false;
      }

      // If we don't have a valid token yet
      if (!this.isAuthenticated) {

        // If we are coming back from an IdP redirect, obtain the token by leveraging the URL parms
        if (window.location.search.includes("code=") && window.location.search.includes("state=")) {

          this.logger.trace(`initialize() calling pkceCallback`);

          await pkceCallback( getOIDCConfig(), getPKCERedirectURI().toString() ).catch(error => {
            window.zitiBrowzerRuntime.logger.error(`${error}`);
            window.zitiBrowzerRuntime.pkceCallbackErrorEventHandler(error);
          });

          this.zitiConfig.access_token = PKCEToken.get();

          window.location.replace(getPKCERedirectURI().toString());

          await delay(5000); // shouldn't get here

        } 
        
        /**
         *  No token, and no IdP redirect means we need to do the full-blown IdP login
         */
        else {

          this.logger.trace(`initialize() no token, and no IdP 'code/state' redirect detected`);

          // Local data indicates that the user is not authenticated, however, the IdP might still think the authentication
          // is alive/valid (a common Auth0 situation), so, we will force/tell the IdP to do a logout. 
          
          if (pkceLogoutIsNeeded(getOIDCConfig())) {
            let logoutInitiated = this.getCookie( this.authTokenName + '_logout_initiated' );
            if (isEqual(logoutInitiated, '')) {
              document.cookie = this.authTokenName + '_logout_initiated' + "=" + "yes" + "; path=/";
              this.logger.trace(`initialize() calling pkceLogout`);
              pkceLogout( getOIDCConfig(), getPKCERedirectURI().toString() );
              await delay(1000); // we need to pause a bit or the 'login' call below will cancel the 'logout'
            }
            document.cookie = this.authTokenName + '_logout_initiated'+'=; Max-Age=-99999999;';
          }

          this.logger.trace(`initialize() calling pkceLogin`);

          await pkceLogin( getOIDCConfig(), getPKCERedirectURI().toString() );

          await delay(5000);  // stall here while we await the redirect from the IdP,
                              // which will cause us to reload/reinit, and process
                              // the 'code' and 'state' returned from the IdP
        }

      }
      
      this.logger.trace(`initialize() isAuthenticated[${this.isAuthenticated}]`);
  
      if (!this.isAuthenticated) {
        initResults.authenticated = false;
      }

    }

    /** ===================================================================
     *  Loded via the BrowZer ZBSW
    /** ================================================================= */
    else {

      this.logger.trace(`initialize() Loaded via ZBSW`);

      // Pull the token from session storage
      this.zitiConfig.access_token  = PKCEToken.get();

      if (isEqual(this.zitiConfig.access_token, null)) {  

        this.logger.trace(`initialize() session token NOT found`);

        // If we were loaded by the ZBSW, but the auth token is NOT present in session storage, 
        // then let's try to get it from the ZBSW.

        const swVersionObject = await sendMessage({type: 'GET_VERSION'});

        this.logger.trace(`initialize() session token ACQUIRED from ZBSW`);

        PKCEToken.set(swVersionObject.zitiConfig.access_token);

      } else {

        this.logger.trace(`initialize() session token found`);

        // If we have a token, determine if it has expired
        if (!isEqual(this.zitiConfig.access_token, null)) {  
          if (isTokenExpired(this.zitiConfig.access_token)) {
            this.isAuthenticated = false;
            initResults.authenticated = false;
            initResults.unregisterSW = true;
          }
        }
      }

    }

    this.logger.trace(`initialize() initResults: `, initResults);

    this.isAuthenticated = initResults.authenticated;

    if (initResults.authenticated) {

      this.zitiContext = this.core.createZitiContext({

        logger:         this.logger,
        controllerApi:  this.controllerApi,

        sdkType:        pjson.name,
        sdkVersion:     pjson.version,
        sdkBranch:      buildInfo.sdkBranch,
        sdkRevision:    buildInfo.sdkRevision,
    
        token_type:     this.zitiConfig.token_type,
        access_token:   this.zitiConfig.access_token,

        apiSessionHeartbeatTimeMin: (1),
        apiSessionHeartbeatTimeMax: (2),
    
      });
      this.logger.trace(`initialize() ZitiContext created`);

      this.zbrSWM = new ZitiBrowzerRuntimeServiceWorkerMock();

      navigator.serviceWorker._ziti_realRegister = navigator.serviceWorker.register;
      navigator.serviceWorker.register = this.zbrSWM.register;

      this.zitiContext.setKeyTypeEC();

      window._zitiContext = this.zitiContext; // allow WASM to find us

      this.zitiConfig.jspi = await this.shouldUseJSPI(); // determine which WASM to instantiate

      await this.zitiContext.initialize({
        loadWASM: !options.loadedViaBootstrapper,    // instantiate the WASM ONLY if we were not injected by the browZer Bootstrapper
        jspi:     this.zitiConfig.jspi,           // indicate which WASM to instantiate
        target:   this.zitiConfig.browzer.bootstrapper.target
      });

      this.initialized = true;

      this.logger.trace(`ZitiBrowzerRuntime ${this._uuid} has been initialized`);

      this.zitiContext.listControllerVersion();

      this.zitiContext.on(ZITI_CONSTANTS.ZITI_EVENT_IDP_AUTH_HEALTH,        this.idpAuthHealthEventHandler);
      this.zitiContext.on(ZITI_CONSTANTS.ZITI_EVENT_NO_CONFIG_FOR_SERVICE,  this.noConfigForServiceEventHandler);
      this.zitiContext.on(ZITI_CONSTANTS.ZITI_EVENT_NO_SERVICE,             this.noServiceEventHandler);
      this.zitiContext.on(ZITI_CONSTANTS.ZITI_EVENT_SESSION_CREATION_ERROR, this.sessionCreationErrorEventHandler);
      this.zitiContext.on(ZITI_CONSTANTS.ZITI_EVENT_INVALID_AUTH,           this.invalidAuthEventHandler);
      this.zitiContext.on(ZITI_CONSTANTS.ZITI_EVENT_CHANNEL_CONNECT_FAIL,   this.channelConnectFailEventHandler);
      this.zitiContext.on(ZITI_CONSTANTS.ZITI_EVENT_NO_WSS_ROUTERS,         this.noWSSRoutersEventHandler);
      this.zitiContext.on(ZITI_CONSTANTS.ZITI_EVENT_XGRESS,                 this.xgressEventHandler);
      this.zitiContext.on(ZITI_CONSTANTS.ZITI_EVENT_NESTED_TLS_HANDSHAKE_TIMEOUT,  this.nestedTLSHandshakeTimeoutEventHandler);
      this.zitiContext.on(ZITI_CONSTANTS.ZITI_EVENT_NO_CONFIG_PROTOCOL_FOR_SERVICE,  this.noConfigProtocolForServiceEventHandler);

      if (options.eruda) {
        this.zitiConfig.eruda = true;
      } else {
        this.zitiConfig.eruda = false;
      }

    }

    return initResults;
  };


  /**
   * Remain in lazy-sleepy loop until initialization is complete.
   * 
   */
  awaitInitializationComplete() {
    return new Promise((resolve) => {
      (function waitForInitializationComplete() {
        if (!window.zitiBrowzerRuntime.initialized) {
          // zitiBrowzerRuntime.logger.trace(`waitForInitializationComplete() on ${zitiBrowzerRuntime._uuid} still not initialized`);
          setTimeout(waitForInitializationComplete, 100);  
        } else {
          // zitiBrowzerRuntime.logger.trace(`waitForInitializationComplete() on ${zitiBrowzerRuntime._uuid} completed`);
          return resolve();
        }
      })();
    });
  }
  

  /**
   * 
   */
  getCookie(name) {
    name = name + "=";
    let ca = document.cookie.split(';');
    for(let i = 0; i <ca.length; i++) {
      let c = ca[i];
      while (c.charAt(0) == ' ') {
        c = c.substring(1);
      }
      if (c.indexOf(name) == 0) {
        return c.substring(name.length, c.length);
      }
    }
    return "";
  }

  
  /**
   * 
   */
  _toast(self, content, type) {
    if (self.polipop) {
      self.polipop.add({content: content, title: `OpenZiti BrowZer`, type: type});
    } else {
      setTimeout(self._toast, 1000, self, content, type);
    }
  }
  
  toastInfo(content) {
    this._toast(this, content, `info`);
  }
  async toastInfoThrottled(content) {
    let timeStamp = await window.zitiBrowzerRuntime.localStorage.get(
      'ZITI_BROWZER_RUNTIME_TOAST_INFO_TIMESTAMP',
    );
    let delta = 999999;
    if (timeStamp) {
      console.log(`existing toastInfoTimeStamp is [${timeStamp}]`);
      delta = Date.now() - timeStamp;
      console.log(`existing toastInfoTimeStamp delta is [${delta}]`);
    }
    if (delta > (1000*60)) {
      this._toast(this, content, `info`);
    }
    window.zitiBrowzerRuntime.localStorage.setWithExpiry(
      'ZITI_BROWZER_RUNTIME_TOAST_INFO_TIMESTAMP',
      Date.now(), 
      new Date(8640000000000000)
    );
  }
  toastSuccess(content) {
    this._toast(this, content, `success`);
  }
  toastWarning(content) {
    this._toast(this, content, `warning`);
  }
  toastError(content) {
    this._toast(this, content, `error`);
  }
}

/**
 * Instantiate the Ziti browZer Runtime.
 * 
 * Use 'zitiConfig' values passed to us from the Ziti BrowZer Bootstrapper.
 * 
 */ 
if (isUndefined(window.zitiBrowzerRuntime)) {

  const zitiBrowzerRuntime = new ZitiBrowzerRuntime({

    version: pjson.version,

    core: new ZitiBrowzerCore(
      {
      }
    ),

    localStorage: new ZitiBrowzerLocalStorage({}),
  });

  window.zitiBrowzerRuntime = zitiBrowzerRuntime;

  // Ensure we have originTrial subdomain alignment
  let originTrialToken = document.querySelector('meta[id="ziti-browzer-origin-trial"]').content;
  if (isUndefined(originTrialToken)) {
    window.zitiBrowzerRuntime.originTrialTokenInvalidEventHandler({});
  }
  let decodedOriginTrialToken;
  try {
    decodedOriginTrialToken = decodeOriginTrialToken(originTrialToken)
  } catch (e) {
    window.zitiBrowzerRuntime.originTrialTokenInvalidEventHandler({});
  }
  console.log('decodedOriginTrialToken: ', decodedOriginTrialToken)
  let currentOriginURL = new URL( window.location.origin );
  let actualOrigin = currentOriginURL.hostname.split(/\./).slice(-2).join('.');
  let originTrialURL = new URL( decodedOriginTrialToken.payload.origin );
  let expectedOrigin = originTrialURL.hostname.split(/\./).slice(-2).join('.');
  if (!isEqual(actualOrigin, expectedOrigin)) {
    window.zitiBrowzerRuntime.originTrialSubDomainMismatchEventHandler({
      feature:        decodedOriginTrialToken.payload.feature,
      expectedOrigin: `*.${expectedOrigin}`,
      actualOrigin:   `*.${actualOrigin}`,
    });
  }

  window.zitiBrowzerRuntime._reloadNeededHeartbeat(window.zitiBrowzerRuntime);

  window.zitiBrowzerRuntime.loadedViaBootstrapper = document.getElementById('from-ziti-browzer-bootstrapper');

  /**
   * Use an async IIFE to initialize the runtime and register the SW.
   */
  (async () => {

    async function await_serviceWorker_controller() {
      return new Promise((resolve, _reject) => {
        (function waitFor_serviceWorker_controller() {
          if (!navigator.serviceWorker.controller) {
            window.zitiBrowzerRuntime.logger.trace(`waitFor_serviceWorker_controller: ...waiting for [navigator.serviceWorker.controller]`);
            setTimeout(waitFor_serviceWorker_controller, 10);
          } else {
            return resolve();
          }
        })();
      });
    }

    async function await_serviceWorker_activated() {
      return new Promise((resolve, _reject) => {
        (function waitFor_serviceWorker_activated() {
          if (!zitiBrowzerRuntime.swActivated) {
            window.zitiBrowzerRuntime.logger.trace(`waitFor_serviceWorker_activated: ...waiting for [zitiBrowzerRuntime.swActivated]`);
            setTimeout(waitFor_serviceWorker_activated, 10);
          } else {
            return resolve();
          }
        })();
      });
    }

    const loadedViaBootstrapper = document.getElementById('from-ziti-browzer-bootstrapper');

    const loadedViaSW = document.getElementById('from-ziti-browzer-sw');
    let loadedViaSWConfigNeeded = false;
    if (loadedViaSW) {
      let className = loadedViaSW.className;
      if (isEqual(className, `ziti-browzer-sw-config-needed`)) {
        loadedViaSWConfigNeeded = true;
      } 
    }

    /**
     * 
     */
    let initResults = await zitiBrowzerRuntime.initialize(
      {
        loadedViaBootstrapper: (loadedViaBootstrapper ? true : false),
        eruda: (typeof eruda !== 'undefined') ? true : false,
      }
    );

    zitiBrowzerRuntime.wb = new Workbox(
      zitiBrowzerRuntime._obtainBootStrapperURL()
      + '/'
      + zitiBrowzerRuntime.zitiConfig.browzer.sw.location 
      + '?swVersion='     + encodeURIComponent(zitiBrowzerRuntime.zitiConfig.browzer.sw.version)
      + '&controllerApi=' + encodeURIComponent(zitiBrowzerRuntime.zitiConfig.controller.api)
      + '&logLevel='      + encodeURIComponent(zitiBrowzerRuntime.zitiConfig.browzer.runtime.logLevel)
      + '&eruda='         + encodeURIComponent(zitiBrowzerRuntime.zitiConfig.eruda)
    );
  
    CookieInterceptor.init(); // Hijack the `document.cookie` object
    
    if (initResults.authenticated && !initResults.loadedViaBootstrapper) {

      /**
       * 
       */
      await window.zitiBrowzerRuntime.zitiContext.enroll();

    }

    window.addEventListener('online', (e) => {
      window.zitiBrowzerRuntime.logger.trace(`ZitiBrowzerRuntime ${window.zitiBrowzerRuntime._uuid} 'networkOnlineEvent' has been received:  `, e);
      window.zitiBrowzerRuntime.toastSuccess(`The network has come back online`);
      window.zitiBrowzerRuntime.toastWarning(`Page will reload in 5 seconds...`);
      setTimeout(function() {
        window.zitiBrowzerRuntime.wb.messageSW({
          type: 'UNREGISTER', 
          payload: {
          } 
        });
      }, 5000);
    });
    window.addEventListener('offline', (e) => {
      window.zitiBrowzerRuntime.logger.trace(`ZitiBrowzerRuntime ${window.zitiBrowzerRuntime._uuid} 'networkOfflineEvent' has been received: `, e);
      window.zitiBrowzerRuntime.toastError(`The network has gone offline`);    
    });

    const terminationEvent = 'onpagehide' in self ? 'pagehide' : 'unload';
    window.addEventListener(terminationEvent, (e) => {

      // some web apps
      if (!window.location.href.includes('#!')) {
        setTimeout(function() {
          window.zitiBrowzerRuntime.logger.trace(`ZitiBrowzerRuntime page-terminationEvent setting window.location to: ${window.zitiBrowzerRuntime.zitiConfig.browzer.bootstrapper.target.path}`);
          window.location = window.zitiBrowzerRuntime.zitiConfig.browzer.bootstrapper.target.path;
        }, 5);
      }
      window.zitiBrowzerRuntime.logger.trace(`ZitiBrowzerRuntime page-terminationEvent '${terminationEvent}' has been received: `, e);
    }, { capture: true });
    
    /**
     * 
     */
    if ('serviceWorker' in navigator) {

      /**
       * The very first time our service worker installs, it will NOT have intercepted any fetch events for
       * the page page load.  We therefore reload the page after the service worker is engaged so it will 
       * begin intercepting HTTP requests.
       */
      zitiBrowzerRuntime.wb.addEventListener('installed', async event => {
        zitiBrowzerRuntime.logger.info(`received SW 'installed' event`);
      
        /**
         *  Ensure the SW is controlling this page before continuing, else the msgs we attempt to send the SW will fail, leading to bootstrapping hangs
         */
        await await_serviceWorker_controller();

        const swVersionObject = await sendMessage({type: 'GET_VERSION'});
        zitiBrowzerRuntime.logger.info(`SW version is now: ${swVersionObject.version}`);
        zitiBrowzerRuntime.logger.info(`SW zitiConfig is now: ${swVersionObject.zitiConfig}`);

        //
        if (isUndefined(swVersionObject.zitiConfig)) {

          zitiBrowzerRuntime.logger.debug(`################ sending SET_CONFIG to SW now ################`, zitiBrowzerRuntime.zitiConfig);

          // const swConfig = await sendMessage({
          //   type: 'SET_CONFIG', 
          //   payload: {
          //     zitiConfig: zitiBrowzerRuntime.zitiConfig
          //   } 
          // });
          zitiBrowzerRuntime.wb.messageSW({
            type: 'SET_CONFIG', 
            payload: {
              zitiConfig: zitiBrowzerRuntime.zitiConfig
            } 
          });

        }
        else {

          zitiBrowzerRuntime.logger.debug(`################ received zitiConfig from SW  ################`, swVersionObject.zitiConfig);

        }

        if (!event.isUpdate) {
          if (!zitiBrowzerRuntime.reloadPending) {
            zitiBrowzerRuntime.reloadPending = true;

            if (zitiBrowzerRuntime.ua.browser.name === 'Safari') {
              setTimeout(function() {
                zitiBrowzerRuntime.logger.debug(`################ doing Safari page reload now ################`);
                window.location.href = window.location.href;
              }, 1000);
            } else {
                setTimeout(function() {
                  zitiBrowzerRuntime.logger.debug(`################ doing Chromium page reload now ################`);
                  window.location.reload();  
                }, 1000);
            }

          }
        }

      });


      /**
       * As mentioned above, the very first time our service worker finishes activating it may (or may not) 
       * have started controlling the page. For this reason, we cannot leverage the activate event 
       * as a way of knowing when the service worker is in control of the page. 
       * 
       * However, if we need to know when the SW 'activate' logic is complete, this is where we find out.
       * 
       * 
       */
      zitiBrowzerRuntime.wb.addEventListener('activated', async event => {
        zitiBrowzerRuntime.logger.info(`received SW 'activated' event`);

        zitiBrowzerRuntime.swActivated = true;
      });

      
      /**
       * 
       */
      zitiBrowzerRuntime.wb.addEventListener('waiting', event => {
        zitiBrowzerRuntime.logger.info(`received SW 'waiting' event`);
      });


      /**
       * Once our new service worker is installed and starts controlling the page, 
       * all subsequent fetch events will go through that service worker.  If our 
       * service worker adds any special logic to handle particular fetch event, 
       * this is the point when we know that logic will run.
       * 
       * The very first time our service worker is installed, it should be controlling 
       * the current page because our service worker calls clients.claim() in its activate 
       * event.
       * 
       * This event is not dispatched if the page was already controlled prior to registration.
       */
      zitiBrowzerRuntime.wb.addEventListener('controlling', event => {
        zitiBrowzerRuntime.logger.info(`received SW 'controlling' event`);
      });
      

      /**
       * 
       */
      zitiBrowzerRuntime.wb.addEventListener('message', event => {

        // zitiBrowzerRuntime.logger.info(`SW event (message) type: ${event.data.type}`);
        
        if (event.data.type === 'XGRESS_EVENT') {

          zitiBrowzerRuntime.updateXgressEventData(event.data.payload.event);
      
        }
        else if (event.data.type === 'LOG_MESSAGE_EVENT') {

          zitiBrowzerRuntime.logger[event.data.payload.logObj.type](`ZBSW: ${event.data.payload.logObj.args[0]}`);

        }

        // else if (event.data.type === 'GET_BASEURI') {
        //   event.ports[0].postMessage( document.baseURI );
        // }

        else if (event.data.type === 'CACHE_UPDATED') {
          const {updatedURL} = event.data.payload;
          zitiBrowzerRuntime.logger.info(`A newer version of ${updatedURL} is available!`);
        }
        
        else if (event.data.type === 'SET_COOKIE') {
          let cookie = event.data.payload.replace(/HttpOnly/gi,'');
          // zitiBrowzerRuntime.logger.info(`A COOKIE has arrived with val ${event.data.payload}`);
          // zitiBrowzerRuntime.logger.info(`document.cookie before: `, document.cookie);
          document.cookie = cookie;
          // zitiBrowzerRuntime.logger.info(`document.cookie after: `, document.cookie);
          event.ports[0].postMessage( 'OK' );
        }

        else if (event.data.type === 'IDP_TOKEN_RESET_NEEDED') {

          zitiBrowzerRuntime.logger.info(`A ${event.data.type} msg was received!`);

          event.ports[0].postMessage( {result: 'OK' } );

          setTimeout(function() {
            zitiBrowzerRuntime.logger.debug(`################ doing root-page page reload now ################`);
            window.location.replace(window.zitiBrowzerRuntime._obtainBootStrapperURL() + zitiBrowzerRuntime.zitiConfig.browzer.bootstrapper.target.path);
          }, 100);
        }

        else if (event.data.type === 'RELOAD') {

          zitiBrowzerRuntime.logger.info(`A ${event.data.type} msg was received!`);

          zitiBrowzerRuntime.toastWarning(`Page reload initiated - stand by`);

          setTimeout(function() {
            zitiBrowzerRuntime.logger.debug(`################ doing root-page page reload now ################`);
            window.location.replace(window.zitiBrowzerRuntime._obtainBootStrapperURL() + zitiBrowzerRuntime.zitiConfig.browzer.bootstrapper.target.path);
          }, 2500);
        }

        else if (event.data.type === 'ACCESS_TOKEN_EXPIRED') {

          zitiBrowzerRuntime.logger.info(`A ${event.data.type} msg was received!`);

          // Only initiate reboot once
          if (!window.zitiBrowzerRuntime.reauthInitiated) {

            window.zitiBrowzerRuntime.reauthInitiated = true;

            window.zitiBrowzerRuntime.doIdpLogout();

          }

        }

        else if (event.data.type === 'ZITI_CONFIG_NEEDED') {

          setTimeout(async function() {
            
            // First send all existing cookies to the sw
            let theCookies = document.cookie.split(';');
            for (var i = 0 ; i < theCookies.length; i++) {
              let cookie = theCookies[i].split('=');
              zitiBrowzerRuntime.logger.debug(`sending cookie to SW ${cookie[0]} ${cookie[1]}`);
              zitiBrowzerRuntime.wb.messageSW({
                type: 'SET_COOKIE', 
                payload: {
                  name: cookie[0], 
                  value: cookie[1]
                } 
              });
            }

            zitiBrowzerRuntime.logger.debug(`sending SET_CONFIG reply to SW`);
            zitiBrowzerRuntime.wb.messageSW({
              type: 'SET_CONFIG', 
              payload: {
                zitiConfig: zitiBrowzerRuntime.zitiConfig
              } 
            });
            // const swConfig = await sendMessage({
            //   type: 'SET_CONFIG', 
            //   payload: {
            //     zitiConfig: zitiBrowzerRuntime.zitiConfig
            //   } 
            // });  
            zitiBrowzerRuntime.logger.debug(`SET_CONFIG reply has ben sent to SW`);
          }, 25);

        }

        else if (event.data.type === 'SERVICE_UNAVAILABLE_TO_IDENTITY') {

          window.zitiBrowzerRuntime.toastWarning(`${event.data.payload.message}`);

        }

        else if (event.data.type === 'NO_CONFIG_FOR_SERVICE') {

          window.zitiBrowzerRuntime.noConfigForServiceEventHandler(event.data.payload.event);

        }

        else if (event.data.type === 'NO_CONFIG_PROTOCOL_FOR_SERVICE') {

          window.zitiBrowzerRuntime.noConfigProtocolForServiceEventHandler(event.data.payload.event);

        }

        else if (event.data.type === 'SESSION_CREATION_ERROR') {

          window.zitiBrowzerRuntime.sessionCreationErrorEventHandler(event.data.payload.event);

        }

        else if (event.data.type === 'NO_SERVICE') {

          window.zitiBrowzerRuntime.noServiceEventHandler(event.data.payload.event);

        }

        else if (event.data.type === 'INVALID_AUTH') {

          window.zitiBrowzerRuntime.invalidAuthEventHandler(event.data.payload.event);

        }

        else if (event.data.type === 'CHANNEL_CONNECT_FAIL') {

          window.zitiBrowzerRuntime.channelConnectFailEventHandler(event.data.payload.event);

        }

        else if (event.data.type === 'NO_WSS_ROUTERS') {

          window.zitiBrowzerRuntime.noWSSRoutersEventHandler(event.data.payload.event);

        }

        else if (event.data.type === 'REQUEST_FAILED_WITH_NO_RESPONSE') {

          window.zitiBrowzerRuntime.requestFailedWithNoResponseEventHandler(event.data.payload.event);

        }

        else if (event.data.type === 'NESTED_TLS_HANDSHAKE_TIMEOUT_EVENT') {

          window.zitiBrowzerRuntime.nestedTLSHandshakeTimeoutEventHandler(event.data.payload.event);
      
        }

        else if (event.data.type === 'PING') {
          event.ports[0].postMessage('PONG');
        }
        
      });
      
      zitiBrowzerRuntime.wb.register();
      zitiBrowzerRuntime.logger.debug(`################ SW register completed ################`);

      /**
       * 
       */      
      if (initResults.authenticated && initResults.loadedViaBootstrapper) {

        /**
         * 
         */
        window.fetch = zitiFetch;
        window.XMLHttpRequest = ZitiXMLHttpRequest;
        window.document.zitidomain = zitiDocumentDomain;

        /**
         *  Ensure the SW is controlling this page before continuing, else the msgs we attempt to send the SW will fail, leading to bootstrapping hangs
         */
        // await await_serviceWorker_controller();


        if (initResults.unregisterSW) {
          window.zitiBrowzerRuntime.wb.messageSW({
            type: 'UNREGISTER', 
            payload: {
            } 
          });
          await delay(5000);  // stall here while we await the reboot of the page
        }
            
        /**
         *  Let the SW know that the ZBR has completed initialization
         */
        if (navigator.serviceWorker.controller) {
          zitiBrowzerRuntime.logger.debug(`sending msg: ZBR_INIT_COMPLETE`);
          navigator.serviceWorker.controller.postMessage({
            type: 'ZBR_INIT_COMPLETE',
            payload: {
              zitiConfig: window.zitiBrowzerRuntime.zitiConfig
            }
          });
        }
          
        /**
         *  Provide the SW with the latest zitiConfig
         */
        window.zitiBrowzerRuntime.logger.debug(`sending msg: SET_CONFIG`);

        const swConfig = await window.zitiBrowzerRuntime.wb.messageSW({
          type: 'SET_CONFIG', 
          payload: {
            zitiConfig: window.zitiBrowzerRuntime.zitiConfig
          } 
        });
        // const swConfig = await sendMessage({
        //   type: 'SET_CONFIG', 
        //   payload: {
        //     zitiConfig: zitiBrowzerRuntime.zitiConfig
        //   } 
        // });

        /**
         *  Provide the SW with the current set of Cookies
         */
        let theCookies = document.cookie.split(';');
        for (var i = 0 ; i < theCookies.length; i++) {
          let cookie = theCookies[i].split('=');
          cookie[0] = cookie[0].replace(' ', '');
          if (!isEqual(cookie[0], window.zitiBrowzerRuntime.authTokenName)) {
            zitiBrowzerRuntime.logger.debug(`sending msg: SET_COOKIE - ${cookie[0]} ${cookie[1]}`);
            zitiBrowzerRuntime.wb.messageSW({
              type: 'SET_COOKIE', 
              payload: {
                name: cookie[0], 
                value: cookie[1]
              } 
            });
          }
        }

        zitiBrowzerRuntime.logger.debug(`################ loadedViaBootstrapper detected -- doing page reload in 1sec ################`);
        if (!zitiBrowzerRuntime.reloadPending) {
          zitiBrowzerRuntime.reloadPending = true;
          setTimeout(function() {
            window.location.reload();
          }, 1000);
        }


      }

      /**
       *  If the ZBR was loaded via a SW bootstrap, and the SW still needs the config, then send the config, then
       *  reload the page to complete the bootstrap cycle with a fully configured SW
       */
      if (loadedViaSW) {

        zitiBrowzerRuntime.logger.debug(`################ loadedViaSW detected ################`);

        if (loadedViaSWConfigNeeded) {
          /**
           *  Provide the SW with the latest zitiConfig
           */
          window.zitiBrowzerRuntime.logger.debug(`sending msg: SET_CONFIG`);

          const swConfig = await window.zitiBrowzerRuntime.wb.messageSW({
            type: 'SET_CONFIG', 
            payload: {
              zitiConfig: window.zitiBrowzerRuntime.zitiConfig
            } 
          });

          if (!zitiBrowzerRuntime.reloadPending) {
            zitiBrowzerRuntime.reloadPending = true;
            setTimeout(function() {
              zitiBrowzerRuntime.logger.debug(`################ loadedViaSWConfigNeeded detected -- doing page reload now ################`);
              window.location.reload();
            }, 1000);
            }
        }
      }

      setTimeout(window.zitiBrowzerRuntime._zbrPing, 1000, window.zitiBrowzerRuntime );

      setTimeout(window.zitiBrowzerRuntime._getLatestBrowZerReleaseVersion, 1000, window.zitiBrowzerRuntime );

      /**
       * 
       */
      let logLevel = await window.zitiBrowzerRuntime.localStorage.get(
        'ZITI_BROWZER_RUNTIME_LOGLEVEL',
      );
      window.zitiBrowzerRuntime.logLevel = logLevel ? logLevel : window.zitiBrowzerRuntime.logLevel;
      window.zitiBrowzerRuntime.zitiConfig.browzer.sw.logLevel = logLevel ? logLevel : window.zitiBrowzerRuntime.zitiConfig.browzer.sw.logLevel;
      window.zitiBrowzerRuntime.zitiConfig.browzer.runtime.logLevel = logLevel ? logLevel : window.zitiBrowzerRuntime.zitiConfig.browzer.runtime.logLevel;  
      window.zitiBrowzerRuntime.logger.logLevel = window.zitiBrowzerRuntime.logLevel;

    }

    // Gather list of Services right up front, since some WebSocket intercept logic needs it
    try {
      await zitiBrowzerRuntime.zitiContext.fetchServices();
    }
    catch (e) {
    }

  })();

}


var regex = new RegExp( `${window.zitiBrowzerRuntime._obtainBootStrapperURL()}`, 'gi' );
var regexSlash = new RegExp( /^\//, 'g' );
var regexDotSlash = new RegExp( /^\.\//, 'g' );
var regexZBR      = new RegExp( /ziti-browzer-runtime-\w{8}\.js/, 'g' );
var regexZBWASM   = new RegExp( /libcrypto.*.wasm/, 'g' );


/**
 * Intercept all 'fetch' requests and route them over Ziti if the target host:port matches an active Ziti Service Config
 *
 * @param {String} url
 * @param {Object} opts
 * @return {Promise}
 * @api public
 */

const zitiFetch = async ( urlObj, opts ) => {

  let url;
  if (urlObj instanceof Request) {
    url = urlObj.url;
  } else {
    url = urlObj;
  }

  if (url.match( regexZBR ) || url.match( regexZBWASM )) { // the request seeks z-b-r/wasm
    return window._ziti_realFetch(urlObj, opts);
  }

  if (!window.zitiBrowzerRuntime.loadedViaBootstrapper) {
    await window.zitiBrowzerRuntime.awaitInitializationComplete();
  }

  if (!window.zitiBrowzerRuntime.isAuthenticated) {
    return window._ziti_realFetch(urlObj, opts);
  }

  let targetHost;
  if (!url.startsWith('/')) {
    url = new URL(url, `https://${window.zitiBrowzerRuntime.zitiConfig.browzer.bootstrapper.self.host}`);
    targetHost = url.hostname;
  } else {
    url = new URL(`https://${window.zitiBrowzerRuntime.zitiConfig.browzer.bootstrapper.self.host}${url}`);
    targetHost = window.zitiBrowzerRuntime.zitiConfig.browzer.bootstrapper.self.host;
  }
  if (isEqual(targetHost, window.zitiBrowzerRuntime.zitiConfig.browzer.bootstrapper.self.host)) {
    let protocol = url.protocol;
    if (!isEqual(protocol, 'https:')) {
      url.protocol = 'https:';
      url = url.toString();
      return window._ziti_realFetch(url, opts);
    }
  }

  if (opts && opts.method && isEqual(opts.method, 'GET')) {
    if (!isUndefined(opts.body)) {
      opts.body = undefined;
    }
  }
  return window._ziti_realFetch(urlObj, opts);

  if (url.match( regexZBWASM )) { // the request seeks z-b-r/wasm
    window.zitiBrowzerRuntime.logger.trace('zitiFetch: seeking Ziti z-b-r/wasm, bypassing intercept of [%s]', url);
    return window._ziti_realFetch(urlObj, opts);
  }

  await window.zitiBrowzerRuntime.awaitInitializationComplete();

  // window.zitiBrowzerRuntime.noActiveChannelDetectedEnabled = true;


  let serviceName;

  // We want to intercept fetch requests that target the Ziti BrowZer Bootstrapper... that is...
  // ...we want to intercept any request from the web app that targets the server from which the app was loaded.

  if (url.match( regexZBWASM )) { // the request seeks z-b-r/wasm
    window.zitiBrowzerRuntime.logger.trace('zitiFetch: seeking Ziti z-b-r/wasm, bypassing intercept of [%s]', url);
    return window._ziti_realFetch(urlObj, opts);
  }
  else if (url.match( regex )) { // yes, the request is targeting the Ziti BrowZer Bootstrapper

    var newUrl = new URL( url );
    newUrl.hostname = window.zitiBrowzerRuntime.zitiConfig.browzer.bootstrapper.target.service;
    newUrl.port = window.zitiBrowzerRuntime.zitiConfig.browzer.bootstrapper.target.port;

    var pathnameArray = newUrl.pathname.split('/');
    var targetpathnameArray = window.zitiBrowzerRuntime.zitiConfig.browzer.bootstrapper.target.path.split('/');

    if (!isEqual(pathnameArray[1], targetpathnameArray[1])) {

    // if (!newUrl.pathname.startsWith(window.zitiBrowzerRuntime.zitiConfig.browzer.bootstrapper.target.path)) {
      newUrl.pathname = window.zitiBrowzerRuntime.zitiConfig.browzer.bootstrapper.target.path + newUrl.pathname;
      newUrl.pathname = newUrl.pathname.replace('//','/');
    // }
      window.zitiBrowzerRuntime.logger.trace( 'zitiFetch: transformed URL: ', newUrl.toString());
    }

    serviceName = await window.zitiBrowzerRuntime.zitiContext.shouldRouteOverZiti( newUrl );

    window.zitiBrowzerRuntime.logger.trace( 'zitiFetch: serviceName: ', serviceName);

    if (isUndefined(serviceName)) { // If we have no serviceConfig associated with the hostname:port, do not intercept
      zitiBrowzerRuntime.logger.warn('zitiFetch(): no associated serviceConfig, bypassing intercept of [%s]', url);
      return window._ziti_realFetch(urlObj, opts);
    }  

    url = newUrl.toString();

  } else if ( (url.match( regexSlash )) || ((url.match( regexDotSlash ))) ) { // the request starts with a slash, or dot-slash

    let baseURIUrl = new URL( document.baseURI );
    let newUrl = new URL( `${baseURIUrl.origin}${url}` );

    if (baseURIUrl.hostname === zitiBrowzerRuntime.zitiConfig.browzer.bootstrapper.self.host) {
      newUrl.hostname = zitiBrowzerRuntime.zitiConfig.browzer.bootstrapper.target.service;
    }
    zitiBrowzerRuntime.logger.debug( 'zitiFetch: transformed URL: ', newUrl.toString());

    serviceName = await zitiBrowzerRuntime.zitiContext.shouldRouteOverZiti( newUrl );

    if (isUndefined(serviceName)) { // If we have no serviceConfig associated with the hostname:port, do not intercept
      zitiBrowzerRuntime.logger.warn('zitiFetch(): no associated serviceConfig, bypassing intercept of [%s]', url);
      return window._ziti_realFetch(urlObj, opts);
    }  

    url = newUrl.toString();

  } 
  else if (!url.toLowerCase().startsWith('http')) {

    // We have a 'relative' URL

    let baseURIUrl = new URL( document.baseURI );
    let newUrl = new URL( `${baseURIUrl.origin}${url}` );
    newUrl.pathname = url;

    if (newUrl.hostname === zitiBrowzerRuntime.zitiConfig.browzer.bootstrapper.self.host) {
      newUrl.hostname = zitiBrowzerRuntime.zitiConfig.browzer.bootstrapper.target.service;
    }

    let href;

    // if (url.includes('/')) {
    //   href = `${window.location.origin}${zitiBrowzerRuntime.zitiConfig.browzer.bootstrapper.target.path}/${url}`;
    // } else {
    //   const substrings = window.location.pathname.split('/');
    //   let pathname = substrings.length === 1
    //         ? window.location.pathname // delimiter is not part of the string
    //         : substrings.slice(0, -1).join('/');
    //   href = `${window.location.origin}${pathname}/${url}`;
    // }
  
    // let newUrl;
    // let baseURIUrl = new URL( href );
    // if (baseURIUrl.hostname === zitiBrowzerRuntime.zitiConfig.browzer.bootstrapper.self.host) {
  
    //   newUrl = new URL( href );
    //   newUrl.hostname = zitiBrowzerRuntime.zitiConfig.browzer.bootstrapper.target.service;
    //   newUrl.port = zitiBrowzerRuntime.zitiConfig.browzer.bootstrapper.target.port;

    // } else {
    //   let baseURI = document.baseURI.replace(/\.\/$/, '');
    //   newUrl = new URL( baseURI + url );
    // }
    zitiBrowzerRuntime.logger.debug( 'zitiFetch: transformed URL: ', newUrl.toString());

    serviceName = await zitiBrowzerRuntime.zitiContext.shouldRouteOverZiti( newUrl );

    if (isUndefined(serviceName)) { // If we have no serviceConfig associated with the hostname:port, do not intercept
      zitiBrowzerRuntime.logger.warn('zitiFetch(): no associated serviceConfig, bypassing intercept of [%s]', url);
      return window._ziti_realFetch(urlObj, opts);
    }

    url = newUrl.toString();

  }
  if (url.toLowerCase().includes( zitiBrowzerRuntime.controllerApi.toLowerCase() )) {   // seeking Ziti Controller
  // if (url.match( zitiBrowzerRuntime.regexControllerAPI )) {   // seeking Ziti Controller
    zitiBrowzerRuntime.logger.trace('zitiFetch: seeking Ziti Controller, bypassing intercept of [%s]', url);
    return window._ziti_realFetch(urlObj, opts);
  }
  else {  // the request is targeting the raw internet

    var newUrl = new URL( url );

    serviceName = await zitiBrowzerRuntime.zitiContext.shouldRouteOverZiti( newUrl );

    if (isUndefined(serviceName)) { // If we have no serviceConfig associated with the hostname:port

      zitiBrowzerRuntime.logger.warn('zitiFetch(): no associated serviceConfig, bypassing intercept of [%s]', url);
      return window._ziti_realFetch(urlObj, opts);
  
    }  
  }

  /** ----------------------------------------------------
   *  ------------ Now Routing over Ziti -----------------
   *  ----------------------------------------------------
   */ 

  window.zitiBrowzerRuntime.noActiveChannelDetectedEnabled = true;

  zitiBrowzerRuntime.logger.trace('zitiFetch: serviceConfig match; intercepting [%s]', url);

  opts = opts || {};

  opts.serviceName = serviceName;
  opts.serviceScheme = window.zitiBrowzerRuntime.zitiConfig.browzer.bootstrapper.target.scheme;
  opts.serviceConnectAppData = await zitiBrowzerRuntime.zitiContext.getConnectAppDataByServiceName(serviceName);
  opts.urlObj = urlObj;

  /**
   * Let ziti-browzer-core.context do the needful
   */
  var zitiResponse = await zitiBrowzerRuntime.zitiContext.httpFetch( url, opts);

  zitiBrowzerRuntime.logger.trace(`Got zitiResponse: `, zitiResponse);

  /**
   * Now that ziti-browzer-core has returned us a ZitiResponse, instantiate a fresh native Response object that we 
   * will return to the Browser. This requires us to:
   * 
   * 1) propagate the HTTP headers, status, etc
   * 2) pipe the HTTP response body 
   */

  var zitiHeaders = zitiResponse.headers.raw();
  var headers = new Headers();
  const keys = Object.keys(zitiHeaders);
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const val = zitiHeaders[key][0];
    headers.append( key, val);
    zitiBrowzerRuntime.logger.trace( 'zitiResponse.headers: ', key, val);
  }
  headers.append( 'x-openziti-browzer-runtime', pjson.version );

  var responseBlob = await zitiResponse.blob();
  var responseBlobStream = responseBlob.stream();               
  const responseStream = new ReadableStream({
      start(controller) {
          function push() {
              var chunk = responseBlobStream.read();
              if (chunk) {
                  controller.enqueue(chunk);
                  push();  
              } else {
                  controller.close();
                  return;
              }
          };
          push();
      }
  });

  let response;

  if (zitiResponse.status === 204) {
    response = new Response( undefined, { "status": zitiResponse.status, "headers":  headers } );
  } else {
    response = new Response( responseStream, { "status": zitiResponse.status, "headers":  headers } );
  }
        
  return response;

}

const zitiDocumentDomain = ( arg ) => {
  console.log('zitiDocumentDomain entered: arg is: ', arg);
}


/**
 * 
 */
window.fetch = zitiFetch;
window.XMLHttpRequest = ZitiXMLHttpRequest;
window.document.zitidomain = zitiDocumentDomain;
window.WebSocket = ZitiDummyWebSocketWrapper;
window.ProgressEvent = ZitiProgressEventWrapper;