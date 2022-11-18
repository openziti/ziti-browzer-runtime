/*
Copyright Netfoundry, Inc.

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
  ZitiHttpRequest,
  HttpResponse,
  ZitiFormData,
  BrowserStdout,
  http,
} from '@openziti/ziti-browzer-core';

import {Workbox} from'workbox-window';
import jwt_decode from "jwt-decode";
import { Base64 } from 'js-base64';
import { isUndefined, isNull, isEqual } from 'lodash-es';
import CookieInterceptor from 'cookie-interceptor';
import { v4 as uuidv4 } from 'uuid';
import { withTimeout, Semaphore } from 'async-mutex';

import pjson from '../package.json';
import { flatOptions } from './utils/flat-options'
import { defaultOptions } from './options'
import { ZitiXMLHttpRequest } from './http/ziti-xhr';
import { buildInfo } from './buildInfo'
import { ZitiBrowzerLocalStorage } from './utils/localstorage';



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

    this._uuid          = uuidv4();

    this.version        = _options.version;
    this.core           = _options.core;
    this.localStorage   = _options.localStorage;

    this.zitiConfig     = this.getZitiConfig();

    this.logLevel       = this.zitiConfig.browzer.runtime.logLevel;
    this.hotKey         = this.zitiConfig.browzer.runtime.hotKey;
    this.controllerApi  = this.zitiConfig.controller.api;

    this.regexControllerAPI = new RegExp( this._controllerApi, 'g' );

    this.noActiveChannelDetectedEnabled    = false;
    this.noActiveChannelDetectedCounter    = 0;
    this.noActiveChannelDetectedThreshold  = _options.noActiveChannelDetectedThreshold;

    this.wb             = new Workbox(
      'https://' + this.zitiConfig.httpAgent.self.host + '/' 
      + this.zitiConfig.browzer.sw.location 
      + '?swVersion='     + encodeURIComponent(this.zitiConfig.browzer.sw.version)
      + '&controllerApi=' + encodeURIComponent(this.zitiConfig.controller.api)
      + '&logLevel='      + encodeURIComponent(this.zitiConfig.browzer.sw.logLevel)
    );

    CookieInterceptor.init(); // Hijack the `document.cookie` object

    CookieInterceptor.write.use( function ( cookie ) {
      
      let name = cookie.substring(0, cookie.indexOf("="));
      let value = cookie.substring(cookie.indexOf("=") + 1);
      let cookie_value = value.substring(0, value.indexOf(";"));

      window.zitiBrowzerRuntime.wb.messageSW({
        type: 'SET_COOKIE', 
        payload: {
          name: name, 
          value: cookie_value
        } 
      });

      return cookie;
    });

    // Toast infra
    this.PolipopCreated = false;
    setTimeout(this._createPolipop, 1000, this);

    // HotKey infra
    setTimeout(this._createHotKey, 5000, this);    

    // Click intercept infra
    setTimeout(this._createClickIntercept, 3000, this);        
  }


  /**
   * 
   */
  _determineReloadNeeded() {

    if (!window.zitiBrowzerRuntime.noActiveChannelDetectedEnabled) return false;

    let activeChannelCount = window.zitiBrowzerRuntime.core.context.activeChannelCount();

    window.zitiBrowzerRuntime.logger.trace(`activeChannelCount is ${activeChannelCount}`);

    if (activeChannelCount < 1) {
      // If there are active Channels, increment the nuber of times we've seen that state
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

      self.logger.trace(`_reloadNeededHeartbeat: visibilityState is ${document.visibilityState}`);

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
    if (isEqual(target.nodeName, 'A')) {
      if (!isNull(target.attributes.getNamedItem('download'))) {
        return true;
      } else {
        return false;
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
        while (!found && (maxDepth > 0)) {
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

    if (!this.PolipopCreated) {
      try {
        if (typeof Polipop !== 'undefined') {
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
          this.PolipopCreated = true;
          self.logger.debug(`_createPolipop: Polipop bootstrap completed`);
        }
        else {
          self.logger.debug(`_createPolipop: awaiting Polipop bootstrap`);
          setTimeout(this._createPolipop, 1000, this);
        }
      }
      catch (e) {
        self.logger.debug(`_createPolipop: bootstrap error ${e}`);
        setTimeout(this._createPolipop, 1000, this);
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

  _createHotKeyModal(self) {

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
    css.setAttribute('href', `https://${window.zitiBrowzerRuntime.zitiConfig.httpAgent.self.host}/ziti-browzer-css.css`);
    div5.appendChild(css);

    let img = document.createElement("img");
    img.setAttribute('src', `https://${window.zitiBrowzerRuntime.zitiConfig.httpAgent.self.host}/ziti-browzer-logo.svg`);
    img.setAttribute('style', 'width: 14%;');
    div5.appendChild(img);

    let span1 = document.createElement("span");
    span1.textContent = 'OpenZiti BrowZer Advanced Settings';
    span1.setAttribute('style', 'margin-bottom: 30px; color: #2a6eda; font-weight: 600; font-size: 20px; line-height: 36px; display: table; margin: 0px auto; margin-top: -50px;');
    div5.appendChild(span1);

    let htmlString = `
<div class="container" style="width:580px;">
    <div class="row">
        <section class="col-xs-12 col-sm-8 col-sm-offset-2 col-xl-6 col-xl-offset-3 my-4">
            <div>
            <br/>
            <form action="https://browzercurt.ziti.netfoundry.io">
                <fieldset>
                    <div class="row">
                        <div class="form-group col-xs-12" id="Client-side_Logging_Level__div">
                        <label for="Client-side_Logging_Level">Client-side Logging Level *</label>
                        <select name="ziti-browzer-loglevel" id="ziti-browzer-loglevel" required="required" autofocus="autofocus" class="form-control">
                          ${window.zitiBrowzerRuntime._generateLogLevelOptions()}
                        </select>
                        </div>
                    </div>
                    <br/>
                    <br/>
                    <hr>
                    <div class="row">
                        <div class="form-group col-xs-12" id="How_would_you_rate_OpenZiti_BrowZer___div">
                        <label for="How_would_you_rate_OpenZiti_BrowZer_">On a scale from 0-10, how likely are you to recommend OpenZiti BrowZer to a friend or colleague?</label>
                        <select name="ziti-browzer-nps" id="ziti-browzer-nps" class="form-control">
                            <option value="">Choose</option>
                            <option value="10">10 - Extremely likely</option>
                            <option value="9">9</option>
                            <option value="8">8</option>
                            <option value="7">7</option>
                            <option value="6">6</option>
                            <option value="5">5</option>
                            <option value="4">4</option>
                            <option value="3">3</option>
                            <option value="2">2</option>
                            <option value="1">1</option>
                            <option value="0">0 - Not at all likely</option>
                        </select>
                        </div>
                    </div>
                    <div class="row">
                        <div class="form-group col-xs-12" id="What_do_you_think_needs_improvement___div">
                        <label for="What_do_you_think_needs_improvement_">What do you think needs improvement?</label>
                        <textarea name="ziti-browzer-improvement" id="ziti-browzer-improvement" class="form-control"></textarea>
                        </div>
                    </div>
                    <br>
                    <div class="row" style="padding-bottom: 15px;>
                        <div class="col-xs-12">
                          <button type="submit" id="ziti-browzer-hidden-button" class="hiddenButton" style="display:none"></button>
                          <button type="button" id="ziti-browzer-save-button"   class="btn btn-primary">Save</button>
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
          window.zitiBrowzerRuntime.toastWarning(`Page will reload in 5 seconds...`);
          setTimeout(function() {
            window.zitiBrowzerRuntime.wb.messageSW({
              type: 'UNREGISTER', 
              payload: {
              } 
            });
          }, 3000);    
        }

        /**
         * TODO: send rating to HTTP Agent
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
      },
      afterClose: function(modal){
          console.log('Message after modal has closed');
          console.log(modal); //modal window object
      },
    });
  
    self.hotKeyModal.init();

  }

  /**
   * Extract the zitiConfig object from the Cookie sent from HTTP Agent
   */
  getZitiConfig() {

    let zitiConfig = this.getCookie('__Secure-ziti-browzer-config');
    zitiConfig = decodeURIComponent(zitiConfig);
    zitiConfig = Base64.decode(zitiConfig);
    zitiConfig = JSON.parse(zitiConfig);

    return zitiConfig;
  }


  /**
   * Extract the JWT object from the Cookie sent from HTTP Agent
   */
   getJWT() {

    let jwt = this.getCookie('__Secure-ziti-browzer-jwt');
    let decodedJWT = jwt_decode(jwt);

    return decodedJWT;
  }


  /**
   * Initialize the ZitiBrowzerRuntime
   *
   * @param {Options} [options]
   * 
   */
  async initialize(options) {

    this.logger = this.core.createZitiLogger({
      logLevel: this.logLevel,
      suffix: 'RT'  // run-time
    });
    this.logger.trace(`ZitiBrowzerRuntime ${this._uuid} initializing`);

    this.zitiConfig.decodedJWT = this.getJWT();

    this.zitiContext = this.core.createZitiContext({

      logger:         this.logger,
      controllerApi:  this.controllerApi,

      sdkType:        pjson.name,
      sdkVersion:     pjson.version,
      sdkBranch:      buildInfo.sdkBranch,
      sdkRevision:    buildInfo.sdkRevision,
  
      token_type:     this.zitiConfig.decodedJWT.token_type,
      access_token:   this.zitiConfig.decodedJWT.access_token,

    });
    this.logger.trace(`ZitiContext created`);

    this.zitiContext.setKeyTypeEC();

    window._zitiContext = this.zitiContext; // allow WASM to find us

    await this.zitiContext.initialize({
      loadWASM: !options.loadedViaHTTPAgent   // instantiate the internal WebAssembly ONLY if we were not injected by the HTTP Agent
    });

    this.initialized = true;

    this.logger.trace(`ZitiBrowzerRuntime ${this._uuid} has been initialized`);

    window.zitiBrowzerRuntime.controllerVersion = await zitiBrowzerRuntime.zitiContext.listControllerVersion();

    this.logger.trace(`ZitiBrowzerRuntime connected to Controller ${window.zitiBrowzerRuntime.controllerVersion.version}`);


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
 * Use 'zitiConfig' values passed to us from the Ziti HTTP Agent.
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

  window.zitiBrowzerRuntime._reloadNeededHeartbeat(window.zitiBrowzerRuntime);

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

    console.log('now inside async IIFE to initialize the runtime and register the SW');

    const loadedViaHTTPAgent = document.getElementById('from-ziti-http-agent');

    const loadedViaSWBootstrap = document.getElementById('ziti-browzer-sw-bootstrap');

    /**
     * 
     */
    await zitiBrowzerRuntime.initialize({loadedViaHTTPAgent: (loadedViaHTTPAgent ? true : false)});

    console.log('returned from call to zitiBrowzerRuntime.initialize');

    if (!loadedViaHTTPAgent) {  

      /**
       * 
       */
      await window.zitiBrowzerRuntime.zitiContext.enroll();

      /**
       * 
       */
      window.WebSocket = zitiBrowzerRuntime.zitiContext.zitiWebSocketWrapper;

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
          window.zitiBrowzerRuntime.logger.trace(`ZitiBrowzerRuntime page-terminationEvent setting window.location to: ${window.zitiBrowzerRuntime.zitiConfig.httpAgent.target.path}`);
          window.location = window.zitiBrowzerRuntime.zitiConfig.httpAgent.target.path;
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
      
        const swVersionObject = await zitiBrowzerRuntime.wb.messageSW({type: 'GET_VERSION'});
        zitiBrowzerRuntime.logger.info(`SW version is now: ${swVersionObject.version}`);
        zitiBrowzerRuntime.logger.info(`SW zitiConfig is now: ${swVersionObject.zitiConfig}`);

        //
        if (isUndefined(swVersionObject.zitiConfig)) {

          const swConfig = await zitiBrowzerRuntime.wb.messageSW({
            type: 'SET_CONFIG', 
            payload: {
              zitiConfig: zitiBrowzerRuntime.zitiConfig
            } 
          });
        }

        if (!event.isUpdate) {
          setTimeout(function() {
            zitiBrowzerRuntime.logger.debug(`################ doing page reload now ################`);
            window.location.reload();
          }, 100);
        }

      });


      /**
       * As mentioned above, the very first time our service worker finishes activating it may (or may not) 
       * have started controlling the page. For this reason, we cannot leverage the activate event 
       * as a way of knowing when the service worker is in control of the page. 
       * 
       * However, if we need to know when the SW 'activate' logic is complete, this is where we find out.
       * 
       * Here is what we do on this event:
       *  - acquire and log the service worker's version
       *  - acquire a keypair froma the service worker
       * 
       */
      zitiBrowzerRuntime.wb.addEventListener('activated', async event => {
        zitiBrowzerRuntime.logger.info(`received SW 'activated' event`);
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

        zitiBrowzerRuntime.logger.info(`SW event (message) type: ${event.data.type}`);
        
        if (event.data.type === 'CACHE_UPDATED') {
          const {updatedURL} = event.data.payload;
          zitiBrowzerRuntime.logger.info(`A newer version of ${updatedURL} is available!`);
        }
        
        else if (event.data.type === 'SET_COOKIE') {
          let cookie = event.data.payload.replace('HttpOnly','');
          zitiBrowzerRuntime.logger.info(`A COOKIE has arrived with val ${event.data.payload}`);
          zitiBrowzerRuntime.logger.info(`document.cookie before: `, document.cookie);
          document.cookie = cookie;
          zitiBrowzerRuntime.logger.info(`document.cookie after: `, document.cookie);
          event.ports[0].postMessage( 'OK' );
        }

        else if (event.data.type === 'IDP_TOKEN_RESET_NEEDED') {

          zitiBrowzerRuntime.logger.info(`A ${event.data.type} msg was received!`);

          event.ports[0].postMessage( {result: 'OK' } );

          setTimeout(function() {
            zitiBrowzerRuntime.logger.debug(`################ doing root-page page reload now ################`);
            window.location.replace('https://' + zitiBrowzerRuntime.zitiConfig.httpAgent.self.host + zitiBrowzerRuntime.zitiConfig.httpAgent.target.path);
          }, 100);
        }

        else if (event.data.type === 'RELOAD') {

          zitiBrowzerRuntime.logger.info(`A ${event.data.type} msg was received!`);

          zitiBrowzerRuntime.toastWarning(`Page reload initiated - stand by`);

          setTimeout(function() {
            zitiBrowzerRuntime.logger.debug(`################ doing root-page page reload now ################`);
            window.location.replace('https://' + zitiBrowzerRuntime.zitiConfig.httpAgent.self.host + zitiBrowzerRuntime.zitiConfig.httpAgent.target.path);
          }, 2500);
        }

        else if (event.data.type === 'ZITI_CONFIG_NEEDED') {

          setTimeout(function() {
            
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
            zitiBrowzerRuntime.logger.debug(`SET_CONFIG reply has ben sent to SW`);
          }, 25);

        }

        else if (event.data.type === 'SERVICE_UNAVAILABLE_TO_IDENTITY') {

          window.zitiBrowzerRuntime.toastWarning(`${event.data.payload.message}`);

        }

        else if (event.data.type === 'PING') {
          event.ports[0].postMessage('PONG');
        }
        
      });
      
      /**
       * 
       */
      zitiBrowzerRuntime.wb.register();
      zitiBrowzerRuntime.logger.debug(`################ SW register completed ################`);

      /**
       * 
       */
      window.fetch = zitiFetch;
      window.XMLHttpRequest = ZitiXMLHttpRequest;

      /**
       *  Ensure the SW is controlling this page before continuing, else the msgs we attempt to send the SW will fail, leading to bootstrapping hangs
       */
      await await_serviceWorker_controller();

      window.zitiBrowzerRuntime.logLevel = await window.zitiBrowzerRuntime.localStorage.get(
        'ZITI_BROWZER_RUNTIME_LOGLEVEL',
      );
      window.zitiBrowzerRuntime.logger.trace(`local ZITI_BROWZER_RUNTIME_LOGLEVEL is [${window.zitiBrowzerRuntime.logLevel}]`);
      window.zitiBrowzerRuntime.zitiConfig.browzer.sw.logLevel = window.zitiBrowzerRuntime.logLevel;
      window.zitiBrowzerRuntime.zitiConfig.browzer.runtime.logLevel = window.zitiBrowzerRuntime.logLevel;  
      window.zitiBrowzerRuntime.logger.logLevel = window.zitiBrowzerRuntime.logLevel;

      /**
       *  Let the SW know that the ZBR has completed initialization
       */
       zitiBrowzerRuntime.logger.debug(`sending msg: ZBR_INIT_COMPLETE`);
       navigator.serviceWorker.controller.postMessage({
         type: 'ZBR_INIT_COMPLETE',
         payload: {
          zitiConfig: window.zitiBrowzerRuntime.zitiConfig
        }
       });
         
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

      /**
       *  Provide the SW with the current set of Cookies
       */
      let theCookies = document.cookie.split(';');
      for (var i = 0 ; i < theCookies.length; i++) {
        let cookie = theCookies[i].split('=');
        zitiBrowzerRuntime.logger.debug(`sending msg: SET_COOKIE - ${cookie[0]} ${cookie[1]}`);
        zitiBrowzerRuntime.wb.messageSW({
          type: 'SET_COOKIE', 
          payload: {
            name: cookie[0], 
            value: cookie[1]
          } 
        });
      }

      setTimeout(window.zitiBrowzerRuntime._zbrPing, 1000, window.zitiBrowzerRuntime );

      /**
       *  Announce the SW version
       */
      const swVersionObject = await zitiBrowzerRuntime.wb.messageSW({type: 'GET_VERSION'});
      await zitiBrowzerRuntime.toastInfoThrottled(
`
ZBR  v${pjson.version} initialized.
<br/>
ZBSW v${swVersionObject.version} initialized.
<br/>
CTRL ${window.zitiBrowzerRuntime.controllerVersion.version} connected.
<br/>
<br/>
HotKey:  '<strong>${window.zitiBrowzerRuntime.hotKey}</strong>'
`);


      /**
       *  If the ZBR was loaded via a SW bootstrap, then reload the page to complete the bootstrap cycle
       */
      if (loadedViaSWBootstrap) {
        // setTimeout(function() {
          zitiBrowzerRuntime.logger.debug(`################ loadedViaSWBootstrap detected -- doing page reload now ################`);
          window.location.reload();
        // }, 300);
      }

    }

    window.zitiBrowzerRuntime.noActiveChannelDetectedEnabled = true;

  })();

}


var regex = new RegExp( `https://${zitiBrowzerRuntime.zitiConfig.httpAgent.self.host}`, 'gi' );
var regexSlash = new RegExp( /^\//, 'g' );
var regexDotSlash = new RegExp( /^\.\//, 'g' );
var regexZBWASM   = new RegExp( /libcrypto.wasm/, 'g' );


/**
 * 
 */
const getBrowZerSession = () => {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; browZerSession=`);
  if (parts.length === 2) {
    return parts.pop().split(';').shift();
  }
  return null;
}

/**
 * Intercept all 'fetch' requests and route them over Ziti if the target host:port matches an active Ziti Service Config
 *
 * @param {String} url
 * @param {Object} opts
 * @return {Promise}
 * @api public
 */
const zitiFetch = async ( url, opts ) => {

  await window.zitiBrowzerRuntime.awaitInitializationComplete();

  window.zitiBrowzerRuntime.logger.trace( 'zitiFetch: entered for URL: ', url);

  // If the browZerSession has expired, then tear everything down and reboot
  if (isNull(getBrowZerSession())) {

    // Only initiate reboot once. If multiple HTTP requests come in, just 403 the rest below.
    if (!window.zitiBrowzerRuntime.reauthInitiated) {

      window.zitiBrowzerRuntime.reauthInitiated = true;

      window.zitiBrowzerRuntime.toastError(`Your browZer Session has expired -- Re-Authentication required.`);

      setTimeout(function() {
        window.zitiBrowzerRuntime.wb.messageSW({
          type: 'UNREGISTER', 
          payload: {
          } 
        });
      }, 100);
      
    }

    // It doesn't really matter what we return here since everything is about to reload
    return new Response( null, { "status": 403 } );
  }


  let serviceName;

  // We want to intercept fetch requests that target the Ziti HTTP Agent... that is...
  // ...we want to intercept any request from the web app that targets the server from which the app was loaded.

  if (url.match( regexZBWASM )) { // the request seeks z-b-r/wasm
    window.zitiBrowzerRuntime.logger.trace('zitiFetch: seeking Ziti z-b-r/wasm, bypassing intercept of [%s]', url);
    return window._ziti_realFetch(url, opts);
  }
  else if (url.match( regex )) { // yes, the request is targeting the Ziti HTTP Agent

    var newUrl = new URL( url );
    newUrl.hostname = window.zitiBrowzerRuntime.zitiConfig.httpAgent.target.service;
    newUrl.port = window.zitiBrowzerRuntime.zitiConfig.httpAgent.target.port;
    window.zitiBrowzerRuntime.logger.trace( 'zitiFetch: transformed URL: ', newUrl.toString());

    serviceName = await window.zitiBrowzerRuntime.zitiContext.shouldRouteOverZiti( newUrl );

    window.zitiBrowzerRuntime.logger.trace( 'zitiFetch: serviceName: ', serviceName);

    if (isUndefined(serviceName)) { // If we have no serviceConfig associated with the hostname:port, do not intercept
      // zitiBrowzerRuntime.logger.warn('zitiFetch(): no associated serviceConfig, bypassing intercept of [%s]', url);
      return window._ziti_realFetch(url, opts);
    }  

    url = newUrl.toString();

  } else if ( (url.match( regexSlash )) || ((url.match( regexDotSlash ))) ) { // the request starts with a slash, or dot-slash

    if ( url.match( regexDotSlash ) ) {
      url = url.slice(1); // remove the 'dot'
    }

    let newUrl;
    let baseURIUrl = new URL( document.baseURI );
    if (baseURIUrl.hostname === zitiBrowzerRuntime.zitiConfig.httpAgent.self.host) {
      newUrl = new URL( 'https://' + zitiBrowzerRuntime.zitiConfig.httpAgent.target.service + ':' + zitiBrowzerRuntime.zitiConfig.httpAgent.target.port + url );
    } else {
      let baseURI = document.baseURI.replace(/\.\/$/, '');
      newUrl = new URL( baseURI + url );
    }
    zitiBrowzerRuntime.logger.debug( 'zitiFetch: transformed URL: ', newUrl.toString());

    serviceName = await zitiBrowzerRuntime.zitiContext.shouldRouteOverZiti( newUrl );

    if (isUndefined(serviceName)) { // If we have no serviceConfig associated with the hostname:port, do not intercept
      // zitiBrowzerRuntime.logger.warn('zitiFetch(): no associated serviceConfig, bypassing intercept of [%s]', url);
      return window._ziti_realFetch(url, opts);
    }  

    url = newUrl.toString();

  } 
  else if (!url.toLowerCase().startsWith('http')) {

    let href = window.location.href;
    const substrings = href.split('/');

    href = substrings.length === 1
      ? href // delimiter is not part of the string
      : substrings.slice(0, -1).join('/');
    
    href = href + '/' + url;
  
    let newUrl;
    let baseURIUrl = new URL( href );
    if (baseURIUrl.hostname === zitiBrowzerRuntime.zitiConfig.httpAgent.self.host) {
  
      newUrl = new URL( href );
      newUrl.hostname = zitiBrowzerRuntime.zitiConfig.httpAgent.target.service;
      newUrl.port = zitiBrowzerRuntime.zitiConfig.httpAgent.target.port;

    } else {
      let baseURI = document.baseURI.replace(/\.\/$/, '');
      newUrl = new URL( baseURI + url );
    }
    zitiBrowzerRuntime.logger.debug( 'zitiFetch: transformed URL: ', newUrl.toString());

    serviceName = await zitiBrowzerRuntime.zitiContext.shouldRouteOverZiti( newUrl );

    if (isUndefined(serviceName)) { // If we have no serviceConfig associated with the hostname:port, do not intercept
      // zitiBrowzerRuntime.logger.warn('zitiFetch(): no associated serviceConfig, bypassing intercept of [%s]', url);
      return window._ziti_realFetch(url, opts);
    }

    url = newUrl.toString();

  }
  if (url.toLowerCase().includes( zitiBrowzerRuntime.controllerApi.toLowerCase() )) {   // seeking Ziti Controller
  // if (url.match( zitiBrowzerRuntime.regexControllerAPI )) {   // seeking Ziti Controller
    zitiBrowzerRuntime.logger.trace('zitiFetch: seeking Ziti Controller, bypassing intercept of [%s]', url);
    return window._ziti_realFetch(url, opts);
  }
  else {  // the request is targeting the raw internet

    var newUrl = new URL( url );

    serviceName = await zitiBrowzerRuntime.zitiContext.shouldRouteOverZiti( newUrl );

    if (isUndefined(serviceName)) { // If we have no serviceConfig associated with the hostname:port

      // let routeOverCORSProxy = await ziti._ctx.shouldRouteOverCORSProxy( url );

      // if (routeOverCORSProxy) {     // If hostname:port is something we need to CORS Proxy

      //   ziti._ctx.logger.warn('zitiFetch(): doing CORS Proxying of [%s]', url);

      //   let newUrl = new URL( url );
      //   let corsTargetHostname = newUrl.hostname;
      //   let corsTargetPort = newUrl.port;
      //   if (corsTargetPort === '') {
      //     if (newUrl.protocol === 'https:') {
      //       corsTargetPort = '443';
      //     } else {
      //       corsTargetPort = '80';
      //     }
      //   }
      
      //   let corsTargetPathname = newUrl.pathname;
      //   newUrl.hostname = zitiConfig.httpAgent.self.host;
      //   newUrl.port = 443;
      //   newUrl.pathname = '/ziti-cors-proxy/' + corsTargetHostname + ':' + corsTargetPort + corsTargetPathname;
      //   // newUrl.pathname = '/ziti-cors-proxy/' + corsTargetHostname  + corsTargetPathname;
      //   ziti._ctx.logger.warn( 'zitiFetch: transformed URL: ', newUrl.toString());   

      //   return window.realFetch(newUrl, opts); // Send special request to HTTP Agent

      // } else {

        // zitiBrowzerRuntime.logger.warn('zitiFetch(): no associated serviceConfig, bypassing intercept of [%s]', url);
        return window._ziti_realFetch(url, opts);
  
      // }

    }  
  }

  /** ----------------------------------------------------
   *  ------------ Now Routing over Ziti -----------------
   *  ----------------------------------------------------
   */ 


  zitiBrowzerRuntime.logger.trace('zitiFetch: serviceConfig match; intercepting [%s]', url);

  opts = opts || {};

  opts.serviceName = serviceName;

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
  headers.append( 'x-ziti-browzer-runtime-version', pjson.version );

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



/**
 * 
 */
window.fetch = zitiFetch;
window.XMLHttpRequest = ZitiXMLHttpRequest;

