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


/**
 * Default options.
 */
const defaultOptions = {
  
    /**
     * See {@link Options.version}
     *
     */
    version: 'unknown',

    /**
     * See {@link Options.logLevel}
     *
     */
    logLevel: 'Silent',

    /**
     * See {@link Options.core}
     *
     */
    core: null,

    /**
     * See {@link Options.localStorage}
     *
     */
    localStorage: null,

     /**
      * 
      */
    noActiveChannelDetectedThreshold: 2,

    /**
     * See {@link Options.wb}
     *
     */
     wb: null,

    /**
     * See {@link Options.controllerApi}
     *
     */
    controllerApi: null,

    /**
     * See {@link Options.authTokenName}
     *
     */
    authTokenName: '__ziti-access-token',

};

export {
    defaultOptions
}
