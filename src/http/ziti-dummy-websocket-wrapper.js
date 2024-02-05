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

import EventEmitter from 'events';
import { isEqual, isUndefined } from 'lodash-es';


/**
 * ZitiDummyWebSocketWrapper:
 * 
 */
class ZitiDummyWebSocketWrapper extends EventEmitter {

    /**
     * Create a new `ZitiDummyWebSocketWrapper`.
     *
     * @param {(String|url.URL)} address The URL to which to connect
     */
    constructor(address) {

      super();

      this.address = address;

      setTimeout(async function(self) {

        await window.zitiBrowzerRuntime.awaitInitializationComplete();

        let serviceName;
        var url = new URL( self.address );

        if (isEqual(url.hostname, zitiBrowzerRuntime.zitiConfig.browzer.bootstrapper.self.host)) { // if targeting the bootstrapper
          serviceName = zitiBrowzerRuntime.zitiConfig.browzer.bootstrapper.target.service;
        } else {
          serviceName = await zitiBrowzerRuntime.zitiContext.shouldRouteOverZiti( self.address );
        }

        if (isUndefined(serviceName)) { // If we have no serviceConfig associated with the address, do not intercept

          self.innerWebSocket = new window._ziti_realWebSocket(self.address);

        } else {

          let opts = {}

          opts.serviceName = serviceName;
          opts.configHostAndPort = await zitiBrowzerRuntime.zitiContext.getConfigHostAndPortByServiceName (serviceName);
          
          self.innerWebSocket = new zitiBrowzerRuntime.zitiContext.zitiWebSocketWrapper(self.address, undefined, opts);

        }

        self.innerWebSocket.addEventListener('open', (event) => {
          if (self.onopen) {
            self.onopen(event);
          }
          self.emit(event);
        });
        
        self.innerWebSocket.addEventListener('close', (event) => {
          if (self.onclose) {
            self.onclose(event);
          }
          self.emit(event);
        });
  
        self.innerWebSocket.addEventListener('error', (event) => {
          if (self.onerror) {
            self.onerror(event);
          }
          self.emit(event);
        });

        self.innerWebSocket.addEventListener('message', (event) => {
          if (self.onmessage) {
            self.onmessage(event);
          }
          self.emit(event);
        });

      }, 1, this);
  
    }

    /**
     * Remain in lazy-sleepy loop until inner WebSocket is present.
     * 
     */
    awaitInnerWebSocketPresent() {
      let self = this;
      return new Promise((resolve) => {
        (function waitForInnerWebSocketPresent() {
          if (!self.innerWebSocket) {
            setTimeout(waitForInnerWebSocketPresent, 5);  
          } else {
            if (self.innerWebSocket.READYSTATE !== self.innerWebSocket.OPEN) {
              setTimeout(waitForInnerWebSocketPresent, 5);  
            } else {
              return resolve();
            }
          }
        })();
      });
    }

    /**
     * 
     * @param {*} code 
     * @param {*} data 
     */
    async close(code, data) {
      await this.awaitInnerWebSocketPresent();
      this.innerWebSocket.close(code, data);
    }

    /**
     * 
     * @param {*} data 
     */
    async send(data) {
      await this.awaitInnerWebSocketPresent();
      this.innerWebSocket.send(data);
    }

}


export {
  ZitiDummyWebSocketWrapper
};
