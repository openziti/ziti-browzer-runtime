import each from 'licia/each'
import filter from 'licia/filter'
import isStr from 'licia/isStr'
import keys from 'licia/keys'
import kebabCase from 'licia/kebabCase'
import defaults from 'licia/defaults'
import themes from './themes'

let styleList = []
let scale = 1

let curTheme = themes.Light

const exports = function (css, container) {

  for (let i = 0, len = styleList.length; i < len; i++) {
    if (styleList[i].css === css) return
  }

  container = container || exports.container || document.head
  const el = document.createElement('style')

  el.type = 'text/css'
  container.appendChild(el)

  const style = { css, el, container }
  resetStyle(style)
  styleList.push(style)

  return style
}

exports.setScale = function (s) {
  scale = s
  resetStyles()
}

exports.setTheme = function (theme) {
  if (isStr(theme)) {
    curTheme = themes[theme] || themes.Light
  } else {
    curTheme = defaults(theme, themes.Light)
  }

  resetStyles()
}

exports.getCurTheme = () => curTheme

exports.getThemes = () => themes

exports.clear = function () {
  each(styleList, ({ container, el }) => container.removeChild(el))
  styleList = []
}

exports.remove = function (style) {
  styleList = filter(styleList, (s) => s !== style)

  style.container.removeChild(style.el)
}

function resetStyles() {
  each(styleList, (style) => resetStyle(style))
}

function resetStyle({ css, el }) {
  css = css.replace(/(\d+)px/g, ($0, $1) => +$1 * scale + 'px')
  css = css.replace(/_/g, 'eruda-')
  const _keys = keys(themes.Light)
  each(_keys, (key) => {
    css = css.replace(
      new RegExp(`var\\(--${kebabCase(key)}\\)`, 'g'),
      curTheme[key]
    )
  })
  el.innerText = css.replace(/\s+/g, " ");
}

export default exports
