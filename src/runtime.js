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
import { isUndefined } from 'lodash-es';
import CookieInterceptor from 'cookie-interceptor';
import { v4 as uuidv4 } from 'uuid';
import { withTimeout, Semaphore } from 'async-mutex';

import pjson from '../package.json';
import { flatOptions } from './utils/flat-options'
import { defaultOptions } from './options'
import { ZitiXMLHttpRequest } from './http/ziti-xhr';
import { buildInfo } from './buildInfo'



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

    this.zitiConfig     = this.getZitiConfig();

    this.logLevel       = this.zitiConfig.browzer.runtime.logLevel
    this.controllerApi  = this.zitiConfig.controller.api

    this.regexControllerAPI = new RegExp( this._controllerApi, 'g' );


    this.wb             = new Workbox(
      'https://' + this.zitiConfig.httpAgent.self.host + '/' 
      + this.zitiConfig.browzer.sw.location 
      + '?controllerApi=' + encodeURIComponent(this.zitiConfig.controller.api)
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
    if (typeof Polipop !== 'undefined') {
      this.polipop = new Polipop('ziti-browzer-toast', {
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
        life: 5000,
        icons: true,
      });
    }
  
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

    await window.zitiBrowzerRuntime.zitiContext.listControllerVersion();

    this.initialized = true;

    this.logger.trace(`ZitiBrowzerRuntime ${this._uuid} has been initialized`);

    this.toastInfo(`Runtime v${pjson.version} now initialized`);
  };


  /**
   * Remain in lazy-sleepy loop until initialization is complete.
   * 
   */
  awaitInitializationComplete() {
    return new Promise((resolve) => {
      (function waitForInitializationComplete() {
        if (!zitiBrowzerRuntime.initialized) {
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
  _toast(content, type) {
      if (this.polipop) {
        this.polipop.add({content: content, title: `OpenZiti BrowZer: ${type}`, type: type});
      }
    }
  
  toastInfo(content) {
    this._toast(content, `info`);
  }
  toastSuccess(content) {
    this._toast(content, `success`);
  }
  toastWarning(content) {
    this._toast(content, `warning`);
  }
  toastError(content) {
    this._toast(content, `error`);
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

  });

  window.zitiBrowzerRuntime = zitiBrowzerRuntime;


  /**
   * Use an async IIFE to initialize the runtime and register the SW.
   */
  (async () => {

    console.log('now inside async IIFE to initialize the runtime and register the SW');

    const loadedViaHTTPAgent = document.getElementById('from-ziti-http-agent');

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
    });
    window.addEventListener('offline', (e) => {
      window.zitiBrowzerRuntime.logger.trace(`ZitiBrowzerRuntime ${window.zitiBrowzerRuntime._uuid} 'networkOfflineEvent' has been received: `, e);
      window.zitiBrowzerRuntime.toastError(`The network has gone offline`);    
    });

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
            window.location.replace('https://' + this.zitiConfig.httpAgent.self.host + '/');
          }, 100);
        }

        else if (event.data.type === 'ZITI_CONFIG_NEEDED') {

          zitiBrowzerRuntime.wb.messageSW({
            type: 'SET_CONFIG', 
            payload: {
              zitiConfig: zitiBrowzerRuntime.zitiConfig
            } 
          });

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
              
      setTimeout(async function() {
        // Let SW know we have established all intercepts, so it is now free to load the terget app's JS
        zitiBrowzerRuntime.logger.debug(`################ sending ZBR_INIT_COMPLETE now ################`);
        zitiBrowzerRuntime.wb.messageSW({type: 'ZBR_INIT_COMPLETE'});

        /**
         * 
         */
        zitiBrowzerRuntime.logger.debug(`################ doing SET_CONFIG now ################`);
        const swConfig = await zitiBrowzerRuntime.wb.messageSW({
          type: 'SET_CONFIG', 
          payload: {
            zitiConfig: zitiBrowzerRuntime.zitiConfig
          } 
        });
        zitiBrowzerRuntime.logger.info(`SET_CONFIG complete`);

        // Send all existing cookies to the sw
        let theCookies = document.cookie.split(';');
        for (var i = 0 ; i < theCookies.length; i++) {
          let cookie = theCookies[i].split('=');
          zitiBrowzerRuntime.logger.debug(`################ doing SET_COOKIE now ################ ${cookie[0]} ${cookie[1]}`);
          zitiBrowzerRuntime.wb.messageSW({
            type: 'SET_COOKIE', 
            payload: {
              name: cookie[0], 
              value: cookie[1]
            } 
          });
        }
        zitiBrowzerRuntime.logger.info(`SET_COOKIE operations now complete`);

        const swVersionObject = await zitiBrowzerRuntime.wb.messageSW({type: 'GET_VERSION'});
        zitiBrowzerRuntime.toastInfo(`ServiceWorker v${swVersionObject.version} now initialized`);
      }, 100);

    }

  })();

}


var regex = new RegExp( `https://${zitiBrowzerRuntime.zitiConfig.httpAgent.self.host}`, 'gi' );
var regexSlash = new RegExp( /^\//, 'g' );
var regexDotSlash = new RegExp( /^\.\//, 'g' );
var regexZBWASM   = new RegExp( /libcrypto.wasm/, 'g' );


/**
 * Intercept all 'fetch' requests and route them over Ziti if the target host:port matches an active Ziti Service Config
 *
 * @param {String} url
 * @param {Object} opts
 * @return {Promise}
 * @api public
 */
const zitiFetch = async ( url, opts ) => {

  zitiBrowzerRuntime.logger.trace( 'zitiFetch: entered for URL: ', url);

  await zitiBrowzerRuntime.awaitInitializationComplete();

  let serviceName;

  // We want to intercept fetch requests that target the Ziti HTTP Agent... that is...
  // ...we want to intercept any request from the web app that targets the server from which the app was loaded.

  if (url.match( regexZBWASM )) { // the request seeks z-b-r/wasm
    zitiBrowzerRuntime.logger.trace('zitiFetch: seeking Ziti z-b-r/wasm, bypassing intercept of [%s]', url);
    return window._ziti_realFetch(url, opts);
  }
  else if (url.match( regex )) { // yes, the request is targeting the Ziti HTTP Agent

    // let isExpired = await zitiBrowzerRuntime.zitiContext.isCertExpired();

    var newUrl = new URL( url );
    newUrl.hostname = zitiBrowzerRuntime.zitiConfig.httpAgent.target.service;
    newUrl.port = zitiBrowzerRuntime.zitiConfig.httpAgent.target.port;
    zitiBrowzerRuntime.logger.trace( 'zitiFetch: transformed URL: ', newUrl.toString());

    serviceName = await zitiBrowzerRuntime.zitiContext.shouldRouteOverZiti( newUrl );

    zitiBrowzerRuntime.logger.trace( 'zitiFetch: serviceName: ', serviceName);

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

  let response = new Response( responseStream, { "status": zitiResponse.status, "headers":  headers } );
        
  return response;

}



/**
 * 
 */
window.fetch = zitiFetch;
window.XMLHttpRequest = ZitiXMLHttpRequest;

