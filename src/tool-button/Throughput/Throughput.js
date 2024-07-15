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
import uPlot from 'uplot';
import { classPrefix as c } from '../lib/util'
import { THROUGHPUT_CSS } from './throughput_css';



export default class Throughput extends Tool {
  constructor() {
    super()

    this._style = evalCss(THROUGHPUT_CSS)

    this.name = 'throughput'
    this._throughputs = []
  }
  init($el, container) {
    super.init($el)
    this._container = container

    this._addDefInfo()
    this._createStatusBar();
    this._bindEvent()
  }
  destroy() {
    super.destroy()

    evalCss.remove(this._style)
  }
  add(name, val) {
    const throughputs = this._throughputs
    let isUpdate = false

    each(throughputs, (info) => {
      if (name !== info.name) return

      info.val = val
      isUpdate = true
    })

    if (!isUpdate) throughputs.push({ name, val })

    this._render()

    return this
  }
  get(name) {
    const throughputs = this._throughputs

    if (isUndef(name)) {
      return cloneDeep(throughputs)
    }

    let result

    each(throughputs, (info) => {
      if (name === info.name) result = info.val
    })

    return result
  }
  remove(name) {
    const throughputs = this._throughputs

    for (let i = throughputs.length - 1; i >= 0; i--) {
      if (throughputs[i].name === name) throughputs.splice(i, 1)
    }

    this._render()

    return this
  }
  clear() {
    this._throughputs = []

    this._render()

    return this
  }
  _createStatusBarDiv() {
    let div = document.createElement("div");
    let div2 = document.createElement("div");
    div2.setAttribute('id', 'zitiBrowzerRuntimeThroughputChartDiv');
    div.appendChild(div2);
    return div;
  }
  _createStatusBar() {

    let chartElement = document.getElementById('zitiBrowzerRuntimeThroughputChartDiv');

    let div = document.createElement("div");
    div.setAttribute('class', 'zitiBrowzerRuntime_bottom-bar');

    let div2 = document.createElement("div");
    div2.setAttribute('class', 'zitiBrowzerRuntime_bottom-bar__content');

    div.appendChild(div2);

    let chartEl = document.createElement("div");
    chartEl.setAttribute('id', 'zitiBrowzerRuntime_bottom-bar__chart');
    div2.appendChild(chartEl);
    
    /**
     * 
     */
    const { bars } = uPlot.paths;

    // generate bar builder with 60% bar (40% gap) & 100px max bar width
    const _bars60_100 = bars({
      size: [0.6, 100],
    });            

    const opts = {
      cursor: {
        y: false,
      },
      width:  window.innerWidth - 30,
      height: 250,
      title: `Bytes exchanged with Ziti Service [${zitiBrowzerRuntime.zitiConfig.browzer.bootstrapper.target.service}]`,
      scales: {
        "y": {
          auto: true,
        }
      },    
      series: [
        {
        },
        {
          label:  "Send",
          stroke: "blue",
          width:  4,
          paths:  _bars60_100,
          points: {show: true},
        },
        {
          label:  "Recv",
          stroke: "green",
          width:  4,
          paths:  _bars60_100,
          points: {show: true},
        },
      ],
    };      

    zitiBrowzerRuntime.xgressEventChart = new uPlot(opts, zitiBrowzerRuntime.xgressEventData, chartEl);

    setTimeout(zitiBrowzerRuntime._xgressEventPing, 10, zitiBrowzerRuntime );

    chartElement.appendChild(div);
  }
  _addDefInfo() {

    let defInfo = [
      {
        name: 'HTTP Request/Response Data Transfer',
        val(self) {
          return self._createStatusBarDiv()
        },
      },
    ]
    
    each(defInfo, (info) => this.add(info.name, info.val))
  }
  _render() {
    const throughputs = []

    let self = this;

    each(this._throughputs, ({ name, val }) => {
      if (isFn(val)) val = val(self)

      throughputs.push({ name, val })
    })

    const html = `<ul>${map(
      throughputs,
      (info) =>
        `<li><h2 class="${c('title')}">${escape(info.name)}<span class="${c(
          'icon-copy copy'
        )}"></span></h2><div class="${c('content')}">${info.val.innerHTML}</div></li>`
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
