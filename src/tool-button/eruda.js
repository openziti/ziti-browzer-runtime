/*
Copyright NetFoundry Inc.

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

import EntryBtn from './EntryBtn/EntryBtn'
import DevTools from './DevTools/DevTools'
import Tool from './DevTools/Tool'
import Info from './Info/Info'
import Changelog from './Changelog/Changelog'
import Feedback from './Feedback/Feedback'
import Throughput from './Throughput/Throughput'
import Settings from './Settings/Settings'
import emitter from './lib/emitter'
import * as util from './lib/util'
import isFn from 'licia/isFn'
import isNum from 'licia/isNum'
import isObj from 'licia/isObj'
import isMobile from 'licia/isMobile'
import viewportScale from 'licia/viewportScale'
import detectBrowser from 'licia/detectBrowser'
import $ from 'licia/$'
import toArr from 'licia/toArr'
import upperFirst from 'licia/upperFirst'
import nextTick from 'licia/nextTick'
import extend from 'licia/extend'
import evalCss from './lib/evalCss'
import pjson from '../../package.json';

import { ICON_CSS } from './style/icon_css';
import { RESET_CSS } from './style/reset_css';
import { STYLE_CSS } from './style/style_css';
import { EVERYTHING_CSS } from './style/everything_css';


const eruda = {
  init({
    container,
    tool,
    autoScale = true,
    useShadowDom = true,
    defaults = {},
  } = {}) {
    if (this._isInit) return

    this._isInit = true
    this._scale = 1

    this._initContainer(container, useShadowDom)
    this._initStyle()
    this._initDevTools(defaults)
    this._initEntryBtn()
    this._initSettings()
    this._initTools(tool)
    this._registerListener()

    if (autoScale) this._autoScale()
  },
  maybeShowThroughput() {
    if (this._entryBtn.maybeShowThroughput()) {
      this._devTools.show();
      setTimeout((self) => {
        self._devTools.hide();
        if (typeof Canny !== 'undefined') {
          Canny('closeChangelog');
        }    
        window.zitiBrowzerRuntime.toastSuccess(`Auto-hiding the BrowZer Throughput chart -- Click BrowZer Button to view it again`);
      }, 10*1000, this)  
    }
  },
  _isInit: false,
  version: pjson.version,
  util,
  Tool,
  Settings,
  Info,
  Changelog,
  Feedback,
  Throughput,
  get(name) {
    if (!this._checkInit()) return

    if (name === 'entryBtn') return this._entryBtn

    const devTools = this._devTools

    return name ? devTools.get(name) : devTools
  },
  add(tool) {
    if (!this._checkInit()) return

    if (isFn(tool)) tool = tool(this)

    this._devTools.add(tool)

    return this
  },
  remove(name) {
    this._devTools.remove(name)

    return this
  },
  show(name) {
    if (!this._checkInit()) return

    const devTools = this._devTools

    name ? devTools.showTool(name) : devTools.show()

    return this
  },
  hide() {
    if (!this._checkInit()) return

    this._devTools.hide()

    return this
  },
  destroy() {
    this._devTools.destroy()
    delete this._devTools
    this._entryBtn.destroy()
    delete this._entryBtn
    this._unregisterListener()
    $(this._container).remove()
    evalCss.clear()
    this._isInit = false
    this._container = null
    this._shadowRoot = null
  },
  scale(s) {
    if (isNum(s)) {
      this._scale = s
      emitter.emit(emitter.SCALE, s)
      return this
    }

    return this._scale
  },
  position(p) {
    const entryBtn = this._entryBtn

    if (isObj(p)) {
      entryBtn.setPos(p)
      return this
    }

    return entryBtn.getPos()
  },
  _autoScale() {
    if (!isMobile()) return

    this.scale(1 / viewportScale())
  },
  _registerListener() {
    this._addListener = (...args) => this.add(...args)
    this._showListener = (...args) => this.show(...args)

    emitter.on(emitter.ADD, this._addListener)
    emitter.on(emitter.SHOW, this._showListener)
    emitter.on(emitter.SCALE, evalCss.setScale)
  },
  _unregisterListener() {
    emitter.off(emitter.ADD, this._addListener)
    emitter.off(emitter.SHOW, this._showListener)
    emitter.off(emitter.SCALE, evalCss.setScale)
  },
  _checkInit() {
    if (!this._isInit) logger.error('Please call "eruda.init()" first')
    return this._isInit
  },
  _initContainer(container, useShadowDom) {
    if (!container) {
      container = document.createElement('div')
      document.documentElement.appendChild(container)
    }

    container.id = 'OpenZiti-BrowZer'
    container.style.all = 'initial'
    this._container = container

    let shadowRoot
    let el
    if (useShadowDom) {
      if (container.attachShadow) {
        shadowRoot = container.attachShadow({ mode: 'open' })
      } else if (container.createShadowRoot) {
        shadowRoot = container.createShadowRoot()
      }
      if (shadowRoot) {
        // font-face doesn't work inside shadow dom.
        evalCss.container = document.head
        evalCss(
          ICON_CSS,
        )
        el = document.createElement('div')
        shadowRoot.appendChild(el)
        this._shadowRoot = shadowRoot
      }
    }

    if (!this._shadowRoot) {
      el = document.createElement('div')
      container.appendChild(el)
    }

    extend(el, {
      className: 'eruda-container',
      contentEditable: false,
    })

    if (detectBrowser().name === 'ios') el.setAttribute('ontouchstart', '')

    this._$el = $(el)
  },
  _initDevTools(defaults) {
    this._devTools = new DevTools(this._$el, {
      defaults,
    })
  },
  _initStyle() {
    const className = 'eruda-style-container'
    const $el = this._$el

    if (this._shadowRoot) {
      evalCss.container = this._shadowRoot
      evalCss(':host { all: initial }')
    } else {
      $el.append(`<div class="${className}"></div>`)
      evalCss.container = $el.find(`.${className}`).get(0)
    }

    evalCss(
      RESET_CSS +
      EVERYTHING_CSS +
      STYLE_CSS +
      ICON_CSS
    )
  },
  _initEntryBtn() {
    this._entryBtn = new EntryBtn(this._$el)
    this._entryBtn.on('click', () => this._devTools.toggle())
  },
  _initSettings() {
    const devTools = this._devTools
    const settings = new Settings()

    devTools.add(settings)

    this._entryBtn.initCfg(settings)
    devTools.initCfg(settings)
  },
  _initTools(
    tool = [
      'info',
    ]
  ) {
    tool = toArr(tool)

    const devTools = this._devTools

    tool.forEach((name) => {
      const Tool = this[upperFirst(name)]
      try {
        if (Tool) devTools.add(new Tool())
      } catch (e) {
        // Use nextTick to make sure it is possible to be caught by console panel.
        nextTick(() => {
          logger.error(
            `Something wrong when initializing tool ${name}:`,
            e.message
          )
        })
      }
    })

    devTools.showTool('throughput')
  },
}

export {
  eruda
}
