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
 * ZitiProgressEventWrapper
 * 
 */
class ZitiProgressEventWrapper extends Event {

  constructor(type) {
    super(type);
  }

  get bubbles() {
    return true;
  }

  get cancelable() {
    return false;
  }

  get composed() {
    return true;
  }

  get target() {
    return this._target;
  }
  set target(target) {
    this._target = target;
  }

  get currentTarget() {
    return this._currentTarget;
  }
  set currentTarget(currentTarget) {
    this._currentTarget = currentTarget;
  }

  get loaded() {
    return this._loaded;
  }
  set loaded(loaded) {
    this._loaded = loaded;
  }

  get status() {
    return this._status;
  }
  set status(status) {
    this._status = status;
  }

  get success() {
    return this._success;
  }
  set success(success) {
    this._success = success;
  }

  get responseType() {
    return this._responseType;
  }
  set responseType(responseType) {
    this._responseType = responseType;
  }

  get responseText() {
    return this._responseText;
  }
  set responseText(responseText) {
    this._responseText = responseText;
  }

}


export {
  ZitiProgressEventWrapper
};
