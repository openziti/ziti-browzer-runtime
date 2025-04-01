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
import { isEqual, isUndefined, isNull } from 'lodash-es';


/**
 * ZitiDummyWebSocketWrapper:
 * 
 */
class ZitiDummyWebSocketWrapper extends EventEmitter {

    static CONNECTING = 0;
    static OPEN       = 1;
    static CLOSING    = 2;
    static CLOSED     = 3;
    static DONE       = 4;

    /**
     * Create a new `ZitiDummyWebSocketWrapper`.
     *
     * @param {(String|url.URL)} address The URL to which to connect
     */
    constructor(address, protocols) {

      super();

      /** 
       * Constants
       */

       this.CONNECTING = 0;
       this.OPEN       = 1;
       this.CLOSING    = 2;
       this.CLOSED     = 3;
       this.DONE       = 4;

      this.address = address;

      // Hack for ScadaLTS web app
      if (this.address.includes(':undefined')) {
        this.address = this.address.replace(':undefined', '');
      }

      setTimeout(async function(self) {

        await window.zitiBrowzerRuntime.awaitInitializationComplete();

        await window.zitiBrowzerRuntime.zitiContext.awaitAccessTokenPresent();

        let serviceName;
        var url = new URL( self.address );

        if (isEqual(url.hostname, zitiBrowzerRuntime.zitiConfig.browzer.bootstrapper.self.host)) { // if targeting the bootstrapper
          serviceName = zitiBrowzerRuntime.zitiConfig.browzer.bootstrapper.target.service;
        } else {
          serviceName = await zitiBrowzerRuntime.zitiContext.shouldRouteOverZiti( self.address );
        }

        if (isUndefined(serviceName)) { // If we have no serviceConfig associated with the address, do not intercept

          self.innerWebSocket = new window._ziti_realWebSocket(self.address, protocols);

        } else {

          let opts = {}

          opts.serviceName = serviceName;
          opts.configHostAndPort = await zitiBrowzerRuntime.zitiContext.getConfigHostAndPortByServiceName (serviceName);
          
          self.innerWebSocket = new zitiBrowzerRuntime.zitiContext.zitiWebSocketWrapper(self.address, protocols, opts);

        }

        self.innerWebSocket.addEventListener('open', (event) => {
          if (self.onopen) {
            self.onopen(event);
          }
          if (self._events.open) {
            self._events.open(event);
          } else {
            self.emit(event);
          }
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
          if (self._events.message) {
            self._events.message(event);
          } else {
            self.emit(event);
          }
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

    addEventListener(type, listener, options) {
      this.addListener(type, listener);
    }

    removeEventListener(type, listener) {
      this.removeListener(type, listener);
    }

    /**
     * 
     */
    get readyState() {
      if (!this.innerWebSocket) {
        return 0; //CONNECTING
      } else {
        return this.innerWebSocket.READYSTATE;
      }
    }

}

['open', 'error', 'close', 'message'].forEach((method) => {
  Object.defineProperty(ZitiDummyWebSocketWrapper.prototype, `on${method}`, {
    /**
     * Return the listener of the event.
     *
     * @return {(Function|undefined)} The event listener or `undefined`
     * @public
     */
    get() {
      const listeners = this.listeners(method);
      for (let i = 0; i < listeners.length; i++) {
        if (listeners[i]._listener) return listeners[i]._listener;
      }

      return undefined;
    },
    /**
     * Add a listener for the event.
     *
     * @param {Function} listener The listener to add
     * @public
     */
    set(listener) {
      if (isNull(listener) || isUndefined(listener)) { return; }
      const listeners = this.listeners(method);
      for (let i = 0; i < listeners.length; i++) {
        //
        // Remove only the listeners added via `EventTarget.addEventListener`.
        //
        if (listeners[i]._listener) this.removeListener(method, listeners[i]);
      }
      this.addEventListener(method, listener);
    }
  });
});




export {
  ZitiDummyWebSocketWrapper
};
