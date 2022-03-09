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



window.realFetch          = window.fetch;
window.realXMLHttpRequest = window.XMLHttpRequest;
window.realWebSocket      = window.WebSocket;
window.realInsertBefore   = Element.prototype.insertBefore;
window.realAppendChild    = Element.prototype.appendChild;
window.realSetAttribute   = Element.prototype.setAttribute;


/**
 * 
 */
class ZitiBrowzerRuntime {

  constructor() {

  }


  /**
   * Initialize.
   *
   * @param {Options} [options]
   * @return {ZitiContext}
   * @api public
   */
  async init(options) {

  };

}

const ziti = new ZitiBrowzerRuntime();


module.exports = ziti;



if ('serviceWorker' in navigator) {

  if (isNull(navigator.serviceWorker.controller)) {

    /**
     *  Service Worker registration
     */
    navigator.serviceWorker.register('https://' + zitiConfig.httpAgent.self.host + '/ziti-browzer-sw.js', {scope: './'} ).then( function( reg ) {

        if (navigator.serviceWorker.controller) {
            // If .controller is set, then this page is being actively controlled by our service worker.
            console.log('The Ziti service worker is now registered.');

        } else {
            // If .controller isn't set, then prompt the user to reload the page so that the service worker can take
            // control. Until that happens, the service worker's fetch handler won't be used.
            // console.log('Please reload this page to allow the Ziti service worker to handle network operations.');
        }
    }).catch(function(error) {
        // Something went wrong during registration.
        console.error(error);
    });

  }
    
} else {
  console.error("The current browser doesn't support service workers");
}
