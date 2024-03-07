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
import { isEqual } from 'lodash-es';
import jwtDecode from 'jwt-decode';


export const discoverAuthServer = (issuerURL) => discoveryRequest(issuerURL).then(res => processDiscoveryResponse(issuerURL, res));

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
export const PKCEToken = {
    get: () => sessionStorage.getItem('BrowZer_token'),
    set: (state) => sessionStorage.setItem('BrowZer_token', state),
    unset: () => sessionStorage.removeItem('BrowZer_token')
};
export const PKCEAuthorizationServer = {
    get: () => {return JSON.parse(sessionStorage.getItem('BrowZer_oidc_config'))},
    set: (as) => sessionStorage.setItem('BrowZer_oidc_config', JSON.stringify(as)),
    unset: () => sessionStorage.removeItem('BrowZer_oidc_config')
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
        authorizationServer = PKCEAuthorizationServer.get();
        if (!authorizationServer) {
            authorizationServer = await discoverAuthServer(issuerURL);
            PKCEAuthorizationServer.set(authorizationServer);
        }
    } catch (e) {
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
    authorizationServerConsentScreen.searchParams.set('code_challenge', codeChallange);
    authorizationServerConsentScreen.searchParams.set('code_challenge_method', 'S256');
    authorizationServerConsentScreen.searchParams.set('redirect_uri', redirectURI);
    authorizationServerConsentScreen.searchParams.set('response_type', 'code');
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

    const response = await authorizationCodeGrantRequest(
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
  
    const result = await processAuthorizationCodeOpenIDResponse(
        authorizationServer, 
        oidcConfig, 
        response
    );
    if (isOAuth2Error(result)) {
      console.error('Error Response', result)
      throw new Error() // Handle OAuth 2.0 response body error
    }
      
    let { id_token } = result;
  
    PKCEToken.set(id_token);

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
    let access_token = PKCEToken.get();
    
    if (authorizationServer.end_session_endpoint) {

        const authorizationServerLogoutURL = new URL(authorizationServer.end_session_endpoint);

        if (!isEqual(access_token, null)) {  
            authorizationServerLogoutURL.searchParams.set('id_token_hint', access_token);
            PKCEToken.unset();
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

            let decoded_access_token = jwtDecode(access_token);
            let exp = decoded_access_token.exp;
            let isExpired = false;
            if (Date.now() >= exp * 1000) {
                isExpired = true;
            }
              
            let url;
            if (!isEqual(access_token, null) && !isExpired) {  
                url = `${asurl.protocol}//${asurl.hostname}/v2/logout?id_token_hint=${access_token}client_id=${oidcConfig.client_id}&returnTo=${redirectURI}`;
            } else {
                url = `${asurl.protocol}//${asurl.hostname}/v2/logout?client_id=${oidcConfig.client_id}&returnTo=${redirectURI}`;
            }
            PKCEToken.unset();
            window.location = url;
        } 
        else {

            // OK, the problem extends to other IdPs beyond auth0 :(
            throw new PKCELogoutError(`No IdP 'end_session_endpoint' found`);
        }
    }

};

