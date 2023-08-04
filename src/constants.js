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


"use strict";

/**
 * 
 */
const ZBR_CONSTANTS = 
{   
    AUTH0_IDP:            'AUTH0',
    AUTH0_URL_REGEX:      /auth0\.com/,

    AZURE_AD_IDP:         'AZURE_AD',
    AZURE_AD_URL_REGEX:   /login\.microsoftonline\.com/,
    AZURE_AD_SCOPES:      ['User.Read', 'openid', 'email'],

    ZBR_ERROR_CODE_INVALID_AUTH:            1001,
    ZBR_ERROR_CODE_CONTROLLER_REQ_FAIL:     1002,
    ZBR_ERROR_CODE_SERVICE_NOT_IN_LIST:     1003,
    ZBR_ERROR_CODE_SERVICE_UNREACHABLE:     1004,
    ZBR_ERROR_CODE_SERVICE_HAS_NO_CONFIG:   1005,
    ZBR_ERROR_CODE_UNSUPPORTED_BROWSER:     1006,

};

  
export {  
    ZBR_CONSTANTS
};
