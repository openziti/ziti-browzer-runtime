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

import { ZitiBrowzerCore } from '@openziti/ziti-browzer-core';
import {Workbox} from'workbox-window';
import { isNull } from 'lodash-es';

import pjson from '../package.json';
import { flatOptions } from './utils/flat-options'
import { defaultOptions } from './options'
// import { ZitiXMLHttpRequest } from './http/ziti-xhr';
import { buildInfo } from './buildInfo'



/**
 * 
 */
 window._ziti_realFetch          = window.fetch;
 window._ziti_realXMLHttpRequest = window.XMLHttpRequest;
 window._ziti_realWebSocket      = window.WebSocket;
 window._ziti_realInsertBefore   = Element.prototype.insertBefore;
 window._ziti_realAppendChild    = Element.prototype.appendChild;
 window._ziti_realSetAttribute   = Element.prototype.setAttribute;


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

    this.version        = _options.version;
    this.logLevel       = _options.logLevel;
    this.core           = _options.core;
    this.wb             = _options.wb;
    this.controllerApi  = _options.controllerApi;

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
    this.logger.trace(`ZitiLogger created`);

    this.context = this.core.createZitiContext({
      logger: this.logger,
      controllerApi: this.controllerApi,

      sdkType:        pjson.name,
      sdkVersion:     pjson.version,
      sdkBranch:      buildInfo.sdkBranch,
      sdkRevision:    buildInfo.sdkRevision,
  
      
//TEMPvv
      updbUser: 'admin',
      updbPswd: 'admin',
//TEMP^^

    });
    this.logger.trace(`ZitiContext created`);

    await this.context.initialize(); // this instantiates the internal WebAssembly

    this.logger.trace(`ZitiContext has been initialized`);

  };

}

/**
 * Instantiate the Ziti browZer Runtime.
 * 
 * Use 'zitiConfig' values passed to us from the Ziti HTTP Agent.
 * 
 */ 
const zitiBrowzerRuntime = new ZitiBrowzerRuntime({

  version: pjson.version,

  logLevel: zitiConfig.browzer.runtime.logLevel,

  core: new ZitiBrowzerCore({

  }),

  controllerApi: zitiConfig.controller.api,
 
  wb: new Workbox(
      'https://' + zitiConfig.httpAgent.self.host + '/' 
      + zitiConfig.browzer.sw.location 
      + '?controllerApi=' + encodeURIComponent(zitiConfig.controller.api)
      + '&logLevel='      + encodeURIComponent(zitiConfig.browzer.sw.logLevel)
  ),

});


/**
 * Use an async IIFE to initialize the runtime and register the SW.
 */
(async () => {

  /**
   * 
   */
  await zitiBrowzerRuntime.initialize({});

  /**
   * 
   */
  await zitiBrowzerRuntime.context.enroll();

  /**
   * 
   */
  if ('serviceWorker' in navigator) {

    /**
     * The very first time our service worker installs, it will NOT have intercepted any fetch events for
     * the page page load.  We therefore reload the page after the service worker is engaged so it will 
     * begin intercepting HTTP requests, as well as will be available to provide this Page a keypair.
     */
    zitiBrowzerRuntime.wb.addEventListener('installed', async event => {
      zitiBrowzerRuntime.logger.trace(`received SW 'installed' event`);
    
      if (!event.isUpdate) {
        setTimeout(function() {
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
      zitiBrowzerRuntime.logger.trace(`received SW 'activated' event`);

      const swVersion = await zitiBrowzerRuntime.wb.messageSW({type: 'GET_VERSION'});
      zitiBrowzerRuntime.logger.info(`SW version is now: ${swVersion}`);

      // zitiBrowzerRuntime.logger.info(`starting keypair acquisition from SW`);
      // zitiBrowzerRuntime.keypair = await zitiBrowzerRuntime.wb.messageSW({type: 'GET_KEYPAIR'});
      // zitiBrowzerRuntime.logger.info(`keypair successfully acquired from SW: ${keypair}`);
    });

    
    /**
     * 
     */
    zitiBrowzerRuntime.wb.addEventListener('waiting', event => {
      zitiBrowzerRuntime.logger.trace(`received SW 'waiting' event`);
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
    });
    
    /**
     * 
     */
    zitiBrowzerRuntime.wb.register();  

  }

})();


/**
 * Intercept all 'fetch' requests and route them over Ziti if the target host:port matches an active Ziti Service Config
 *
 * @param {String} url
 * @param {Object} opts
 * @return {Promise}
 * @api public
 */
 const zitiFetch = async ( url, opts ) => {

    // TBD

 }


 /**
  * 
  */
 window.fetch = zitiFetch;
//  window.XMLHttpRequest = ZitiXMLHttpRequest;
//  window.WebSocket = ZitiWebSocketWrapper;

