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

//
function assertAs(as) {
    if (typeof as !== 'object' || as === null) {
        throw new TypeError('"as" must be an object');
    }
    if (!validateString(as.issuer)) {
        throw new TypeError('"as.issuer" property must be a non-empty string');
    }
    return true;
}
function assertClient(client) {
    if (typeof client !== 'object' || client === null) {
        throw new TypeError('"client" must be an object');
    }
    if (!validateString(client.client_id)) {
        throw new TypeError('"client.client_id" property must be a non-empty string');
    }
    return true;
}

//
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function buf(input) {
    if (typeof input === 'string') {
        return encoder.encode(input);
    }
    return decoder.decode(input);
}

//
const CHUNK_SIZE = 0x8000;
function encodeBase64Url(input) {
    if (input instanceof ArrayBuffer) {
        input = new Uint8Array(input);
    }
    const arr = [];
    for (let i = 0; i < input.byteLength; i += CHUNK_SIZE) {
        arr.push(String.fromCharCode.apply(null, input.subarray(i, i + CHUNK_SIZE)));
    }
    return btoa(arr.join('')).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}
function decodeBase64Url(input) {
    try {
        const binary = atob(input.replace(/-/g, '+').replace(/_/g, '/').replace(/\s/g, ''));
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    }
    catch (cause) {
        throw new OPE('The input to be decoded is not correctly encoded.', { cause });
    }
}
function b64u(input) {
    if (typeof input === 'string') {
        return decodeBase64Url(input);
    }
    return encodeBase64Url(input);
}

function epochTime() {
    return Math.floor(Date.now() / 1000);
}

const idTokenClaims = new WeakMap();
const skipAuthTimeCheck = Symbol();

export function getValidatedIdTokenClaims(ref) {
    if (!ref.id_token) {
        return undefined;
    }
    const claims = idTokenClaims.get(ref);
    if (!claims) {
        throw new TypeError('"ref" was already garbage collected or did not resolve from the proper sources');
    }
    return claims[0];
}

//
async function validateJwsSignature(protectedHeader, payload, key, signature) {
    const input = `${protectedHeader}.${payload}`;
    const verified = await crypto.subtle.verify(keyToSubtle(key), key, signature, buf(input));
    if (!verified) {
        throw new OPE('JWT signature verification failed');
    }
}

//
function checkSigningAlgorithm(client, issuer, header) {
    if (client !== undefined) {
        if (header.alg !== client) {
            throw new OPE('unexpected JWT "alg" header parameter');
        }
        return;
    }
    if (Array.isArray(issuer)) {
        if (!issuer.includes(header.alg)) {
            throw new OPE('unexpected JWT "alg" header parameter');
        }
        return;
    }
    if (header.alg !== 'RS256') {
        throw new OPE('unexpected JWT "alg" header parameter');
    }
}

const noSignatureCheck = Symbol();
const clockSkew = Symbol();
const clockTolerance = Symbol();
const jweDecrypt = Symbol();

export class OperationProcessingError extends Error {
    constructor(message, options) {
        super(message, options);
        this.name = this.constructor.name;
        Error.captureStackTrace?.(this, this.constructor);
    }
}
const OPE = OperationProcessingError;

//
function getClockTolerance(client) {
    const tolerance = client?.[clockTolerance];
    return typeof tolerance === 'number' && Number.isFinite(tolerance) && Math.sign(tolerance) !== -1
        ? tolerance
        : 30;
}

//
async function validateJwt(jws, checkAlg, getKey, clockSkew, clockTolerance, decryptJwt) {
    let { 0: protectedHeader, 1: payload, 2: encodedSignature, length } = jws.split('.');
    if (length === 5) {
        if (decryptJwt !== undefined) {
            jws = await decryptJwt(jws);
            ({ 0: protectedHeader, 1: payload, 2: encodedSignature, length } = jws.split('.'));
        }
        else {
            throw new UnsupportedOperationError('JWE structure JWTs are not supported');
        }
    }
    if (length !== 3) {
        throw new OPE('Invalid JWT');
    }
    let header;
    try {
        header = JSON.parse(buf(b64u(protectedHeader)));
    }
    catch (cause) {
        throw new OPE('failed to parse JWT Header body as base64url encoded JSON', { cause });
    }
    if (!isJsonObject(header)) {
        throw new OPE('JWT Header must be a top level object');
    }
    checkAlg(header);
    if (header.crit !== undefined) {
        throw new OPE('unexpected JWT "crit" header parameter');
    }
    const signature = b64u(encodedSignature);
    let key;
    if (getKey !== noSignatureCheck) {
        key = await getKey(header);
        await validateJwsSignature(protectedHeader, payload, key, signature);
    }
    let claims;
    try {
        claims = JSON.parse(buf(b64u(payload)));
    }
    catch (cause) {
        throw new OPE('failed to parse JWT Payload body as base64url encoded JSON', { cause });
    }
    if (!isJsonObject(claims)) {
        throw new OPE('JWT Payload must be a top level object');
    }
    const now = epochTime() + clockSkew;
    if (claims.exp !== undefined) {
        if (typeof claims.exp !== 'number') {
            throw new OPE('unexpected JWT "exp" (expiration time) claim type');
        }
        if (claims.exp <= now - clockTolerance) {
            throw new OPE('unexpected JWT "exp" (expiration time) claim value, timestamp is <= now()');
        }
    }
    if (claims.iat !== undefined) {
        if (typeof claims.iat !== 'number') {
            throw new OPE('unexpected JWT "iat" (issued at) claim type');
        }
    }
    if (claims.iss !== undefined) {
        if (typeof claims.iss !== 'string') {
            throw new OPE('unexpected JWT "iss" (issuer) claim type');
        }
    }
    if (claims.nbf !== undefined) {
        if (typeof claims.nbf !== 'number') {
            throw new OPE('unexpected JWT "nbf" (not before) claim type');
        }
        if (claims.nbf > now + clockTolerance) {
            throw new OPE('unexpected JWT "nbf" (not before) claim value, timestamp is > now()');
        }
    }
    if (claims.aud !== undefined) {
        if (typeof claims.aud !== 'string' && !Array.isArray(claims.aud)) {
            throw new OPE('unexpected JWT "aud" (audience) claim type');
        }
    }
    return { header, claims, signature, key, jwt: jws };
}

//
function validatePresence(required, result) {
    for (const claim of required) {
        if (result.claims[claim] === undefined) {
            throw new OPE(`JWT "${claim}" (${jwtClaimNames[claim]}) claim missing`);
        }
    }
    return result;
}

//
function validateIssuer(expected, result) {
    if (result.claims.iss !== expected) {
        throw new OPE('unexpected JWT "iss" (issuer) claim value');
    }
    return result;
}

//
function validateAudience(expected, result) {
    if (Array.isArray(result.claims.aud)) {
        if (!result.claims.aud.includes(expected)) {
            throw new OPE('unexpected JWT "aud" (audience) claim value');
        }
    }
    else if (result.claims.aud !== expected) {
        throw new OPE('unexpected JWT "aud" (audience) claim value');
    }
    return result;
}

//
function getClockSkew(client) {
    const skew = client?.[clockSkew];
    return typeof skew === 'number' && Number.isFinite(skew) ? skew : 0;
}

//
async function _processGenericAccessTokenResponse(
    as,
    client,
    response,
    ignoreIdToken = false,
    ignoreRefreshToken = false,
    ignoreAccessToken = false,
  ) {
    assertAs(as);
    assertClient(client);
    if (!looseInstanceOf(response, Response)) {
      throw new TypeError('"response" must be an instance of Response');
    }
    if (response.status !== 200) {
      let err;
      if ((err = await handleOAuthBodyError(response))) {
        return err;
      }
      throw new OPE('"response" is not a conform Token Endpoint response');
    }
    assertReadableResponse(response);
    let json;
    try {
      json = await response.json();
    } catch (cause) {
      throw new OPE('failed to parse "response" body as JSON', { cause });
    }
    if (!isJsonObject(json)) {
      throw new OPE('"response" body must be a top level object');
    }
    if (!ignoreAccessToken) {
        if (!validateString(json.access_token)) {
            debugger;
            throw new OPE(
                '"response" body "access_token" property must be a non-empty string'
            );
        }
    }
    if (!validateString(json.token_type)) {
      throw new OPE(
        '"response" body "token_type" property must be a non-empty string'
      );
    }
    json.token_type = json.token_type.toLowerCase();
    if (json.token_type !== "dpop" && json.token_type !== "bearer") {
      throw new UnsupportedOperationError("unsupported `token_type` value");
    }
    if (
      json.expires_in !== undefined &&
      (typeof json.expires_in !== "number" || json.expires_in <= 0)
    ) {
      throw new OPE(
        '"response" body "expires_in" property must be a positive number'
      );
    }
    if (
      !ignoreRefreshToken &&
      json.refresh_token !== undefined &&
      !validateString(json.refresh_token)
    ) {
      throw new OPE(
        '"response" body "refresh_token" property must be a non-empty string'
      );
    }
    if (json.scope !== undefined && typeof json.scope !== "string") {
      throw new OPE('"response" body "scope" property must be a string');
    }
    if (!ignoreIdToken) {
      if (json.id_token !== undefined && !validateString(json.id_token)) {
        throw new OPE(
          '"response" body "id_token" property must be a non-empty string'
        );
      }
      if (json.id_token) {
        const { claims, jwt } = await validateJwt(json.id_token, checkSigningAlgorithm.bind(undefined, client.id_token_signed_response_alg, as.id_token_signing_alg_values_supported), noSignatureCheck, getClockSkew(client), getClockTolerance(client), client[jweDecrypt])
            .then(validatePresence.bind(undefined, ['aud', 'exp', 'iat', 'iss', 'sub']))
            .then(validateIssuer.bind(undefined, as.issuer))
            .then(validateAudience.bind(undefined, client.client_id));
        if (Array.isArray(claims.aud) && claims.aud.length !== 1) {
          if (claims.azp === undefined) {
            throw new OPE(
              'ID Token "aud" (audience) claim includes additional untrusted audiences'
            );
          }
          if (claims.azp !== client.client_id) {
            throw new OPE(
              'unexpected ID Token "azp" (authorized party) claim value'
            );
          }
        }
        if (
          claims.auth_time !== undefined &&
          (!Number.isFinite(claims.auth_time) ||
            Math.sign(claims.auth_time) !== 1)
        ) {
          throw new OPE(
            'ID Token "auth_time" (authentication time) must be a positive number'
          );
        }
        idTokenClaims.set(json, [claims, jwt]);
      }
    }
    return json;
}

//
async function _processAuthorizationCodeOpenIDResponse(
    as,
    client,
    response,
    okToIgnoreAccessToken,
    expectedNonce,
    maxAge
  ) {
    const result = await _processGenericAccessTokenResponse(
      as,
      client,
      response,
      false,                // ignoreIdToken
      false,                // ignoreRefreshToken
      okToIgnoreAccessToken // okToIgnoreAccessToken  
    );
    if (isOAuth2Error(result)) {
      return result;
    }
    if (!validateString(result.id_token)) {
      throw new OPE(
        '"response" body "id_token" property must be a non-empty string'
      );
    }
    maxAge ?? (maxAge = client.default_max_age ?? skipAuthTimeCheck);
    const claims = getValidatedIdTokenClaims(result);
    if (
      (client.require_auth_time || maxAge !== skipAuthTimeCheck) &&
      claims.auth_time === undefined
    ) {
      throw new OPE('ID Token "auth_time" (authentication time) claim missing');
    }
    if (maxAge !== skipAuthTimeCheck) {
      if (typeof maxAge !== "number" || maxAge < 0) {
        throw new TypeError('"maxAge" must be a non-negative number');
      }
      const now = epochTime() + getClockSkew(client);
      const tolerance = getClockTolerance(client);
      if (claims.auth_time + maxAge < now - tolerance) {
        throw new OPE(
          "too much time has elapsed since the last End-User authentication"
        );
      }
    }
    switch (expectedNonce) {
      case undefined:
      case expectNoNonce:
        if (claims.nonce !== undefined) {
          throw new OPE('unexpected ID Token "nonce" claim value');
        }
        break;
      default:
        if (!validateString(expectedNonce)) {
          throw new TypeError('"expectedNonce" must be a non-empty string');
        }
        if (claims.nonce === undefined) {
          throw new OPE('ID Token "nonce" claim missing');
        }
        if (claims.nonce !== expectedNonce) {
          throw new OPE('unexpected ID Token "nonce" claim value');
        }
    }
    return result;
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

    // If AzureAD-B2C, use custom validation logic
    if (json.issuer.includes('.b2clogin.com')) {

        function stripLastPathSegment(href) {
            const url = new URL(href, window.location.origin); // handles relative paths too
            const segments = url.pathname.split('/');
            segments.pop(); // remove last segment (could be empty if URL ends with /)
            if (segments[segments.length - 1] === '') {
                segments.pop(); // remove trailing slash segment if needed
            }
            url.pathname = segments.join('/') + '/'; // rebuild path with trailing slash
            return url.href;
        }

        function stripSecondToLastPathSegment(urlString) {
            const url = new URL(urlString);
            const segments = url.pathname.split('/').filter(Boolean);
            if (segments.length >= 2) {
              segments.splice(segments.length - 2, 1);
            }
            url.pathname = '/' + segments.join('/');
            return url.toString();
        }

        function ensureTrailingSlash(url) {
            return url.endsWith('/') ? url : url + '/';
        }          

        let strippedExpectedIssuerIdentifier;

        if (json.issuer.includes('/v2.0')) {
            strippedExpectedIssuerIdentifier = ensureTrailingSlash( stripSecondToLastPathSegment(expectedIssuerIdentifier.href).toLowerCase() );
        } else {
            strippedExpectedIssuerIdentifier = stripLastPathSegment(expectedIssuerIdentifier.href).toLowerCase();
        }

        if (new URL(json.issuer).href !== strippedExpectedIssuerIdentifier) {
            // throw new PKCELoginError(`The configured IdP issuer URL[${strippedExpectedIssuerIdentifier}] does not match OIDC Discovery results[${json.issuer}]`);
        }
  
    } else {

        if (new URL(json.issuer).href !== expectedIssuerIdentifier.href) {
            throw new PKCELoginError(`The configured IdP issuer URL[${expectedIssuerIdentifier.href}] does not match OIDC Discovery results[${json.issuer}]`);
        }
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
     let entraHosts = [
        'login.microsoftonline.com',
    ];
    if (entraHosts.includes(asurl.hostname)) {
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
    // vvv--- AzureAD hack to keep _processAuthorizationCodeOpenIDResponse() validator happy
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
    // ^^^--- AzureAD hack to keep _processAuthorizationCodeOpenIDResponse() validator happy
    //

    /**
     *  AzureAD-B2C doesn't always return an access_token in the response from its /token endpoint
     */
    let okToIgnoreAccessToken = false;
    if (authorizationServer.issuer.includes('.b2clogin.com')) {
        okToIgnoreAccessToken = true;
    }
  
    const result = await _processAuthorizationCodeOpenIDResponse(
        authorizationServer, 
        oidcConfig, 
        response,
        okToIgnoreAccessToken
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

        const allowedHosts = ['auth0.com'];
        if (allowedHosts.includes(authorizationServerLogoutURL.hostname)) {
            authorizationServerLogoutURL.pathname = '/v2/logout'
            authorizationServerLogoutURL.searchParams.set('returnTo', redirectURI);
        } else {
            authorizationServerLogoutURL.searchParams.set('post_logout_redirect_uri', redirectURI);
        }

        if (!isEqual(id_token, null)) {  
            authorizationServerLogoutURL.searchParams.set('id_token_hint', id_token);
            PKCE_id_Token.unset();
            PKCE_access_Token.unset();
        }
        authorizationServerLogoutURL.searchParams.set('client_id', oidcConfig.client_id);
    
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

        const allowedHosts = ['auth0.com'];
        if (allowedHosts.includes(asurl.hostname)) {

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

    const allowedHosts = ['auth0.com'];
    if (allowedHosts.includes(asurl.hostname)) {
        return true;
    } else {
        return false;
    }

};
