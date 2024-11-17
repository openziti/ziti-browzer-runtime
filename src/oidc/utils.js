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
    authorizationCodeGrantRequest,
    calculatePKCECodeChallenge,
    discoveryRequest,
    generateRandomState,
    expectNoState,
    generateRandomCodeVerifier,
    processAuthorizationCodeOAuth2Response,
    isOAuth2Error,
    parseWwwAuthenticateChallenges,
    processAuthorizationCodeOpenIDResponse,
    processDiscoveryResponse,
    validateAuthResponse
} from 'oauth4webapi';
import { isEqual, isUndefined } from 'lodash-es';
import jwtDecode from 'jwt-decode';
import { ZBR_CONSTANTS } from '../constants';


const looseInstanceOf = (input, expected) => {
    if (input == null) {
        return false;
    }
    try {
        return (input instanceof expected ||
            Object.getPrototypeOf(input)[Symbol.toStringTag] === expected.prototype[Symbol.toStringTag]);
    }
    catch {
        return false;
    }
}
const assertReadableResponse = (response) => {
    if (response.bodyUsed) {
        throw new TypeError('"response" body has been used already');
    }
}
const  isJsonObject = (input) => {
    if (input === null || typeof input !== 'object' || Array.isArray(input)) {
        return false;
    }
    return true;
}
const validateString = (input) => {
    return typeof input === 'string' && input.length !== 0;
}


const processPKCEDiscoveryResponse = async (expectedIssuerIdentifier, response) => {

    if (!(expectedIssuerIdentifier instanceof URL)) {
      throw new TypeError('"expectedIssuer" must be an instance of URL');
    }
    if (!looseInstanceOf(response, Response)) {
      throw new TypeError('"response" must be an instance of Response');
    }
    if (response.status !== 200) {
      throw new PKCELoginError(
        '"response" is not a conform Authorization Server Metadata response'
      );
    }
    assertReadableResponse(response);
    let json;
    try {
      json = await response.json();
    } catch (cause) {
      throw new PKCELoginError('failed to parse "response" body as JSON', { cause });
    }
    if (!isJsonObject(json)) {
      throw new PKCELoginError('"response" body must be a top level object');
    }
    if (!validateString(json.issuer)) {
      throw new PKCELoginError(
        '"response" body "issuer" property must be a non-empty string'
      );
    }
    if (new URL(json.issuer).href !== expectedIssuerIdentifier.href) {
      throw new PKCELoginError(`The configured IdP issuer URL[${expectedIssuerIdentifier.href}] does not match OIDC Discovery results[${json.issuer}]`);
    }
    return json;
}
  
export const discoverAuthServer = (issuerURL) => discoveryRequest(issuerURL).then(res => processPKCEDiscoveryResponse(issuerURL, res));

/**
 * 
 */
export const PKCECodeVerifier = {
    get: () => sessionStorage.getItem(window.btoa('code_verifier')),
    set: (codeVerifier) => sessionStorage.setItem(window.btoa('code_verifier'), codeVerifier),
    unset: () => sessionStorage.removeItem(window.btoa('code_verifier'))
};
export const PKCEState = {
    get: () => sessionStorage.getItem(window.btoa('pkce_state')),
    set: (state) => sessionStorage.setItem(window.btoa('pkce_state'), state),
    unset: () => sessionStorage.removeItem(window.btoa('pkce_state'))
};
export const PKCE_id_Token = {
    get: () => sessionStorage.getItem('BrowZer_id_token'),
    set: (state) => sessionStorage.setItem('BrowZer_id_token', state),
    unset: () => sessionStorage.removeItem('BrowZer_id_token')
};
export const PKCE_access_Token = {
    get: () => sessionStorage.getItem('BrowZer_access_token'),
    set: (state) => sessionStorage.setItem('BrowZer_access_token', state),
    unset: () => sessionStorage.removeItem('BrowZer_access_token')
};
export const PKCEAuthorizationServer = {
    get: () => {return JSON.parse(sessionStorage.getItem('BrowZer_oidc_config'))},
    set: (as) => sessionStorage.setItem('BrowZer_oidc_config', JSON.stringify(as)),
    unset: () => sessionStorage.removeItem('BrowZer_oidc_config')
};

/**
 * 
 */
 export const PKCEAuthorizationServer_controller = {
    get: () => {return JSON.parse(sessionStorage.getItem('BrowZer_controller_oidc_config'))},
    set: (as) => sessionStorage.setItem('BrowZer_controller_oidc_config', JSON.stringify(as)),
    unset: () => sessionStorage.removeItem('BrowZer_controller_oidc_config')
};


export const getPKCERedirectURI = () => {
    const currentOrigin = new URL(window.location.origin);
    currentOrigin.pathname = '/';
    return currentOrigin;
};

export class PKCELoginError extends Error {
    constructor(message) {
        super(message);
        this.name = 'PKCELoginError';
    }
}

export class PKCELogoutError extends Error {
    constructor(message) {
        super(message);
        this.name = 'PKCELogoutError';
    }
}

/**
 * validateAndGetOIDCForPKCE
 * 
 * @param {*} oidcConfig 
 * @returns 
 */
const validateAndGetOIDCForPKCE = async (oidcConfig) => {
    if (!oidcConfig) {
        throw new PKCELoginError('No OIDC Config found');
    }

    let issuerURL;
    try {
        issuerURL = new URL(oidcConfig.issuer);
    } catch (e) {
        throw new PKCELoginError(`Invalid oidc issuer ${oidcConfig.issuer}`);
    }

    if (!oidcConfig.client_id) {
        throw new PKCELoginError('No OIDC Client Id found');
    }

    let authorizationServer;
    try {
        /**
         *  We store the OIDC discovery data in session storage once it is obtained
         *  so that we do not need to reach across the internet more than once (in
         *  case the user hits the refresh button, etc.)
         */
        switch(oidcConfig.type) {
            case ZBR_CONSTANTS.OIDC_TYPE_IDP:
                authorizationServer = PKCEAuthorizationServer.get();
                if (!authorizationServer) {
                    authorizationServer = await discoverAuthServer(issuerURL);
                    PKCEAuthorizationServer.set(authorizationServer);
                }
                break;

            case ZBR_CONSTANTS.OIDC_TYPE_ZITI_CONTROLLER:
                debugger;
                authorizationServer = PKCEAuthorizationServer_controller.get();
                if (!authorizationServer) {
                    authorizationServer = await discoverAuthServer(issuerURL);
                    PKCEAuthorizationServer_controller.set(authorizationServer);
                }
                break;

            default:
                throw new PKCELoginError(`unknown OIDC Type [${oidcConfig.type}]`);
        }  
    } catch (e) {

        window.zitiBrowzerRuntime.PKCELoginErrorEncounteredEventHandler({error: e.message});

        throw new PKCELoginError(e);
    }

    return {
        issuerURL,
        authorizationServer,
        client_id: oidcConfig.client_id
    };
};

/**
 * pkceLogin
 * 
 * @param {*} oidcConfig 
 * @param {*} redirectURI 
 */
export const pkceLogin = async (oidcConfig, redirectURI) => {

    const {authorizationServer} = await validateAndGetOIDCForPKCE(oidcConfig);

    if (!authorizationServer.authorization_endpoint) {
        throw new PKCELoginError('No Authorization Server endpoint found');
    }

    const codeVerifier = generateRandomCodeVerifier();

    const codeChallange = await calculatePKCECodeChallenge(codeVerifier);

    const authorizationServerConsentScreen = new URL(authorizationServer.authorization_endpoint);

    authorizationServerConsentScreen.searchParams.set('client_id', oidcConfig.client_id);
    
    /**
     * If Auth0 is the IdP, then we need to add an audience parm (perhaps other things as well) in order to get a valid access_token
     */
    let asurl = new URL(authorizationServer.authorization_endpoint);
    if (asurl.hostname.includes('auth0.com')) {
        /**
         * If we are configured with authorization_endpoint_parms, then use it
         */
        if (!isUndefined(oidcConfig.authorization_endpoint_parms)) {
            const params = new URLSearchParams(oidcConfig.authorization_endpoint_parms);
            let parmArray = Array.from(params.entries());
            parmArray.forEach((parm) => {
                if (isEqual(parm[0].toLowerCase(), 'audience')) { // ignore any non-audience URL parms that were passed in (Auth0 dislikes them)
                    authorizationServerConsentScreen.searchParams.set(parm[0], parm[1]);
                }
            });
        } 
        /**
         * If we were NOT configured with authorization_endpoint_parms, we will default to using an audience value equal
         * to the browZer app's URL (i.e. we assume that an 'API' was created in Auth0 that matches that URL)
         */
        else {
            authorizationServerConsentScreen.searchParams.set('audience', `https://${window.zitiBrowzerRuntime.zitiConfig.browzer.bootstrapper.self.host}`);
        }
    }
    authorizationServerConsentScreen.searchParams.set('code_challenge', codeChallange);
    authorizationServerConsentScreen.searchParams.set('code_challenge_method', 'S256');
    authorizationServerConsentScreen.searchParams.set('redirect_uri', redirectURI);
    authorizationServerConsentScreen.searchParams.set('response_type', 'code');
    /**
     * If Entra is the IdP, then we need to ensure proper scope is used in order to get a valid access_token
     */
    if (asurl.hostname.includes('login.microsoftonline.com')) {
        /**
         * If we were NOT configured with authorization_scope, we will dynamically add it here,
         * using the Entra clientId (i.e. we assume that an 'API' was created in Entra that matches 
         * that clientId)
         */
        if (isUndefined(window.zitiBrowzerRuntime.zitiConfig.idp.authorization_scope)) {
            oidcConfig.scopes.unshift(`api://${window.zitiBrowzerRuntime.zitiConfig.idp.clientId}/OpenZiti.BrowZer`)
        }
    }
    authorizationServerConsentScreen.searchParams.set('scope', oidcConfig.scopes.join(' '));

    /**
     * We cannot be sure the IdP supports PKCE so we're going to use state too. Use of PKCE is
     * backwards compatible even if the IdP doesn't support it which is why we're using it regardless.
     */
    let state = generateRandomState();
    authorizationServerConsentScreen.searchParams.set('state', state);
    PKCEState.set(state);

    PKCECodeVerifier.set(codeVerifier);

    window.location.replace(authorizationServerConsentScreen.toString());
};

/**
 * pkceCallback
 * 
 * @param {*} oidcConfig 
 * @param {*} redirectURI 
 */
export const pkceCallback = async (oidcConfig, redirectURI) => {

    const codeVerifier = PKCECodeVerifier.get();
    if (!codeVerifier) {
        throw new PKCELoginError('No code verifier found in session');
    }
    PKCECodeVerifier.unset();

    const state = PKCEState.get();
    if (!state) {
        throw new PKCELoginError('No PKCE state found in session');
    }
    PKCEState.unset();

    const {authorizationServer} = await validateAndGetOIDCForPKCE(oidcConfig);

    const params = validateAuthResponse(authorizationServer, oidcConfig, new URLSearchParams(window.location.search), state);

    if (isOAuth2Error(params)) {
      console.error('Error Response', params)
      throw new Error()
    }

    let response = await authorizationCodeGrantRequest(
        authorizationServer,
        oidcConfig,
        params,
        redirectURI,
        codeVerifier,
    );

    let challenges;
    if ((challenges = parseWwwAuthenticateChallenges(response))) {
      for (const challenge of challenges) {
        console.error('WWW-Authenticate Challenge', challenge)
      }
      throw new Error()
    }

    //
    // vvv--- AzureAD hack to keep processAuthorizationCodeOpenIDResponse() validator happy
    //
    let json;
    let responseClone = response.clone();
    try {
        json = await responseClone.json();
    } catch (cause) {
        throw new PKCELoginError('failed to parse "response" body as JSON', { cause });
    }
    if (json.expires_in !== undefined && (typeof json.expires_in !== 'number' || json.expires_in <= 0)) {
        // If the expires_in field looks bogus, then swap in a proper value, and spin up a new Response object accordingly
        json.expires_in = 1; 
        const opts = { status: response.status, statusText: response.statusText };
        const blob = new Blob([JSON.stringify(json, null, 2)], {
            type: "application/json",
        });          
        response = new Response(blob, opts);
    }
    //
    // ^^^--- AzureAD hack to keep processAuthorizationCodeOpenIDResponse() validator happy
    //
  
    const result = await processAuthorizationCodeOpenIDResponse(
        authorizationServer, 
        oidcConfig, 
        response
    );
    if (isOAuth2Error(result)) {
      console.error('Error Response', result);
      throw {
        issuer: oidcConfig.issuer,
        client_id: oidcConfig.client_id,
      }
    }
      
    let { id_token } = result;
    PKCE_id_Token.set(id_token);

    let { access_token } = result;  
    PKCE_access_Token.set(access_token);

};

/**
 * pkceLogout
 * 
 * @param {*} oidcConfig 
 * @param {*} redirectURI 
 */
export const pkceLogout = async (oidcConfig, redirectURI) => {

    const {authorizationServer} = await validateAndGetOIDCForPKCE(oidcConfig);

    // Pull the token from session storage
    let id_token = PKCE_id_Token.get();
    
    if (authorizationServer.end_session_endpoint) {

        const authorizationServerLogoutURL = new URL(authorizationServer.end_session_endpoint);

        if (!isEqual(id_token, null)) {  
            authorizationServerLogoutURL.searchParams.set('id_token_hint', id_token);
            PKCE_id_Token.unset();
            PKCE_access_Token.unset();
        }
        authorizationServerLogoutURL.searchParams.set('client_id', oidcConfig.client_id);
        authorizationServerLogoutURL.searchParams.set('post_logout_redirect_uri', redirectURI);
    
        let url = authorizationServerLogoutURL.toString()

        setTimeout(function() {
            window.location = url;
        }, 50);
    
    }
    else {

        // The IdP's OIDC metadata doesn't expose an end_session_endpoint !

        // This is most likely auth0, so let's try their logout endpoint.
        // @see: https://auth0.com/docs/api/authentication#logout
        //
        // This is a hack and reaches into guts of the oidc client
        // in ways I'd prefer not to... but auth0 has this annoying 
        // non-conforming session termination.

        let asurl = new URL(authorizationServer.authorization_endpoint);

        if (asurl.hostname.includes('auth0.com')) {

            let isExpired = false;
            if (id_token) {
                let decoded_id_token = jwtDecode(id_token);
                let exp = decoded_id_token.exp;
                if (Date.now() >= exp * 1000) {
                    isExpired = true;
                }
            } else {
                isExpired = true;
            }
              
            let url;
            if (!isEqual(id_token, null) && !isExpired) {  
                url = `${asurl.protocol}//${asurl.hostname}/v2/logout?id_token_hint=${id_token}client_id=${oidcConfig.client_id}&returnTo=${redirectURI}`;
            } else {
                url = `${asurl.protocol}//${asurl.hostname}/v2/logout?client_id=${oidcConfig.client_id}&returnTo=${redirectURI}`;
            }
            PKCE_id_Token.unset();
            PKCE_access_Token.unset();
            window.location = url;
        } 
        else {

            // OK, the problem extends to other IdPs beyond auth0 :(
            throw new PKCELogoutError(`No IdP 'end_session_endpoint' found`);
        }
    }

};


/**
 * pkceLogoutIsNeeded
 * 
 * @param {*} oidcConfig 
 */
 export const pkceLogoutIsNeeded = async (oidcConfig) => {

    const {authorizationServer} = await validateAndGetOIDCForPKCE(oidcConfig);

    let asurl = new URL(authorizationServer.authorization_endpoint);

    if (asurl.hostname.includes('auth0.com')) {
        return true;
    } else {
        return false;
    }

};
