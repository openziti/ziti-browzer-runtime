import Tool from '../DevTools/Tool'
import each from 'licia/each'
import isFn from 'licia/isFn'
import isUndef from 'licia/isUndef'
import cloneDeep from 'licia/cloneDeep'
import evalCss from '../lib/evalCss'
import map from 'licia/map'
import escape from 'licia/escape'
import copy from 'licia/copy'
import $ from 'licia/$'
import { classPrefix as c } from '../lib/util'
import { INFO_CSS } from '../Info/info_css';
import { isUndefined, isNull, isEqual } from 'lodash-es';


export default class Changelog extends Tool {
  constructor() {
    super()

    this._style = evalCss(INFO_CSS)

    this.name = 'changelog'
    this._infos = []
  }
  init($el, container) {
    super.init($el)
    this._container = container

    this._addDefChangelog()
    this._bindEvent()
    
  }
  destroy() {
    super.destroy()

    evalCss.remove(this._style)
  }
  add(name, val) {
    const infos = this._infos
    let isUpdate = false

    each(infos, (info) => {
      if (name !== info.name) return

      info.val = val
      isUpdate = true
    })

    if (!isUpdate) infos.push({ name, val })

    this._render()

    return this
  }
  get(name) {
    const infos = this._infos

    if (isUndef(name)) {
      return cloneDeep(infos)
    }

    let result

    each(infos, (info) => {
      if (name === info.name) result = info.val
    })

    return result
  }
  remove(name) {
    const infos = this._infos

    for (let i = infos.length - 1; i >= 0; i--) {
      if (infos[i].name === name) infos.splice(i, 1)
    }

    this._render()

    return this
  }
  clear() {
    this._infos = []

    this._render()

    return this
  }
  _addDefChangelog() {

    let updateAvailable = '';
    if (!isUndefined(window.zitiBrowzerRuntime.zitiConfig.browzer.bootstrapper.self.latestReleaseVersion)) {
      updateAvailable = isEqual(window.zitiBrowzerRuntime.zitiConfig.browzer.bootstrapper.self.version, window.zitiBrowzerRuntime.zitiConfig.browzer.bootstrapper.self.latestReleaseVersion) ? '' 
        : `NOTE: A Newer BrowZer Release <span style="color:#ec1f2d;font-size: 18px;font-weight:600">(v${window.zitiBrowzerRuntime.zitiConfig.browzer.bootstrapper.self.latestReleaseVersion})</span> is Available`;
    }

    let defChangelog = [
      {
        name: 'Your Version',
        val:
          'You are running <a href="https://openziti.io/docs/learn/quickstarts/browzer/" target="_blank">OpenZiti BrowZer v' +
          zitiBrowzerRuntime.zitiConfig.browzer.bootstrapper.self.version +
          '</a>' + 
          `
          <br/><br/>
          <button type="button" class="btn btn-primary" data-canny-changelog="true">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
              <path fill-rule="evenodd" d="M15.312 11.424a5.5 5.5 0 0 1-9.201 2.466l-.312-.311h2.433a.75.75 0 0 0 0-1.5H3.989a.75.75 0 0 0-.75.75v4.242a.75.75 0 0 0 1.5 0v-2.43l.31.31a7 7 0 0 0 11.712-3.138.75.75 0 0 0-1.449-.39Zm1.23-3.723a.75.75 0 0 0 .219-.53V2.929a.75.75 0 0 0-1.5 0V5.36l-.31-.31A7 7 0 0 0 3.239 8.188a.75.75 0 1 0 1.448.389A5.5 5.5 0 0 1 13.89 6.11l.311.31h-2.432a.75.75 0 0 0 0 1.5h4.243a.75.75 0 0 0 .53-.219Z" clip-rule="evenodd" />
            </svg>
            View Changelog
          </button>
          <label style="position: absolute;top: 43px;left: 300px; height: 32px;">
            ${updateAvailable}
          </label>    
          `
        ,
      },
    ]
    
    each(defChangelog, (info) => this.add(info.name, info.val))
  }
  _render() {
    const infos = []

    each(this._infos, ({ name, val }) => {
      if (isFn(val)) val = val()

      infos.push({ name, val })
    })

    const html = `<ul>${map(
      infos,
      (info) =>
        `<li><h2 class="${c('title')}">${escape(info.name)}
        <span class="${c(
          'icon-copy copy'
        )}"></span>
        </h2><div class="${c('content')}">${info.val}</div></li>`
    ).join('')}</ul>`

    this._renderHtml(html)
  }
  _bindEvent() {
    const container = this._container

    this._$el.on('click', c('.copy'), function () {
      const $li = $(this).parent().parent()
      const name = $li.find(c('.title')).text()
      const content = $li.find(c('.content')).text()
      copy(`${name}: ${content}`)
      container.notify('Copied')
    })
  }
  _renderHtml(html) {
    if (html === this._lastHtml) return
    this._lastHtml = html
    this._$el.html(html)    
  }
}
