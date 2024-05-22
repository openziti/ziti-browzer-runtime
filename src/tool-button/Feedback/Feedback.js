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


export default class Feedback extends Tool {
  constructor() {
    super()

    this._style = evalCss(INFO_CSS)

    this.name = 'feedback'
    this._infos = []
  }
  init($el, container) {
    super.init($el)
    this._container = container

    this._addDefFeedback()
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
  _addDefFeedback() {

    let updateAvailable = '';
    if (!isUndefined(window.zitiBrowzerRuntime.zitiConfig.browzer.bootstrapper.self.latestReleaseVersion)) {
      updateAvailable = isEqual(window.zitiBrowzerRuntime.zitiConfig.browzer.bootstrapper.self.version, window.zitiBrowzerRuntime.zitiConfig.browzer.bootstrapper.self.latestReleaseVersion) ? '' 
        : `NOTE: A Newer BrowZer Release <span style="color:#ec1f2d;font-size: 18px;font-weight:600">(v${window.zitiBrowzerRuntime.zitiConfig.browzer.bootstrapper.self.latestReleaseVersion})</span> is Available`;
    }

    let defFeedback = [
      {
        name: 'Give Us Feedback',
        val:
          `
          <div data-canny="true" style="position: relative;">
            <button type="button" class="btn btn-primary" id="ziti-browzer-feedback-button">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
                <path d="M3.505 2.365A41.369 41.369 0 0 1 9 2c1.863 0 3.697.124 5.495.365 1.247.167 2.18 1.108 2.435 2.268a4.45 4.45 0 0 0-.577-.069 43.141 43.141 0 0 0-4.706 0C9.229 4.696 7.5 6.727 7.5 8.998v2.24c0 1.413.67 2.735 1.76 3.562l-2.98 2.98A.75.75 0 0 1 5 17.25v-3.443c-.501-.048-1-.106-1.495-.172C2.033 13.438 1 12.162 1 10.72V5.28c0-1.441 1.033-2.717 2.505-2.914Z" />
                <path d="M14 6c-.762 0-1.52.02-2.271.062C10.157 6.148 9 7.472 9 8.998v2.24c0 1.519 1.147 2.839 2.71 2.935.214.013.428.024.642.034.2.009.385.09.518.224l2.35 2.35a.75.75 0 0 0 1.28-.531v-2.07c1.453-.195 2.5-1.463 2.5-2.915V8.998c0-1.526-1.157-2.85-2.729-2.936A41.645 41.645 0 0 0 14 6Z" />
              </svg>
              Give Feedback
            </button>
          </div>
          `
        ,
      },
    ]
    
    each(defFeedback, (info) => this.add(info.name, info.val))
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

    let feedbackButton = document.getElementById("ziti-browzer-feedback-button");
    feedbackButton.onclick = function() {
      // Render Feedback widget
      Canny('render', {
        boardToken: 'c505a4cb-95c5-1682-47b4-99f9d75607fd',
        basePath: null,
        ssoToken: null,
        theme: 'light',
      });        
    };

  }
  _renderHtml(html) {
    if (html === this._lastHtml) return
    this._lastHtml = html
    this._$el.html(html)    
  }
}
