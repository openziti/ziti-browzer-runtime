
export {  
    THROUGHPUT_CSS
};

const THROUGHPUT_CSS = 

` 
#eruda-throughput{overflow-y:auto;-webkit-overflow-scrolling:touch}#eruda-throughput li{margin:10px}#eruda-throughput li .eruda-content,#eruda-throughput li .eruda-title{padding:10px}#eruda-throughput li .eruda-title{position:relative;padding-bottom:0;color:#1a73e8}#eruda-throughput li .eruda-title .eruda-icon-copy{position:absolute;right:10px;top:14px;color:#333;cursor:pointer;transition:color .3s}#eruda-throughput li .eruda-title .eruda-icon-copy:active{color:#1a73e8}#eruda-throughput li .eruda-content{margin:0;-webkit-user-select:text;-moz-user-select:text;-ms-user-select:text;user-select:text;color:#333;font-size:12px;word-break:break-all}#eruda-throughput li .eruda-content table{width:100%;border-collapse:collapse}#eruda-throughput li .eruda-content table td,#eruda-throughput li .eruda-content table th{padding:10px}#eruda-throughput li .eruda-content *{-webkit-user-select:text;-moz-user-select:text;-ms-user-select:text;user-select:text}#eruda-throughput li .eruda-content a{color:#1155cc}#eruda-throughput li .eruda-device-key,#eruda-throughput li .eruda-system-key{width:100px}.eruda-safe-area #eruda-throughput{padding-bottom:calc(10px + env(safe-area-inset-bottom))}

.zitiBrowzerRuntime_bottom-bar {
    position: fixed;
    top: 100px;
    left: 100px;
    background-image: linear-gradient(to right, #0965f3, #e10c5c) !important;
    color: #ffffff;
    box-shadow: 0 0 5px rgba(0, 0, 0, 0.25);
    box-sizing: border-box;
    z-index: 99999;
    border: 1px solid white;
}

.zitiBrowzerRuntime_bottom-bar__content {
    max-width: 850px;
    margin: 0 auto;
    display: flex;
    justify-content: space-between;
}

.zitiBrowzerRuntime_bottom-bar__content > * {
    display: flex;
    align-items: center;
}

.zitiBrowzerRuntime_bottom-bar__text {
    padding-right: 10px;
}
.uplot, .uplot *, .uplot *::before, .uplot *::after {
    box-sizing: border-box;
}
.zitiBrowzerRuntime_bottom-bar .uplot, .u-hz {
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";
    line-height: 1.5;
    width: min-content;
    background-image: linear-gradient(to right, #0965f3, #e10c5c) !important;
}
.u-title {
    text-align: center;
    font-size: 12px;
    font-weight: bold;
    color: white;
}
.u-wrap {
    position: relative;
    user-select: none;
}
.u-over, .u-under {
    position: absolute;
}
.u-under {
    overflow: hidden;
}
.uplot canvas {
    display: block;
    position: relative;
    width: 100%;
    height: 100%;
}
.u-axis {
    position: absolute;
}
.u-legend {
    font-size: 12px;
    margin: auto;
    text-align: center;
    color: white;
}
.u-inline {
    display: block;
}
.u-inline * {
    display: inline-block;
}
.u-inline tr {
    margin-right: 16px;
}
.u-legend th {
    font-weight: 600;
}
.u-legend th > * {
    vertical-align: middle;
    display: inline-block;
}
.u-legend .u-marker {
    width: 1em;
    height: 1em;
    margin-right: 4px;
    background-clip: padding-box !important;
}
.u-inline.u-live th::after {
    content: ":";
    vertical-align: middle;
}
.u-inline:not(.u-live) .u-value {
    display: none;
}
.u-series > * {
    padding: 4px;
}
.u-series th {
    cursor: pointer;
}
.u-legend .u-off > * {
    opacity: 0.3;
}
.u-select {
    background: rgba(0,0,0,0.07);
    position: absolute;
    pointer-events: none;
}
.u-cursor-x, .u-cursor-y {
    position: absolute;
    left: 0;
    top: 0;
    pointer-events: none;
    will-change: transform;
    z-index: 100;
}
.u-hz .u-cursor-x, .u-vt .u-cursor-y {
    height: 100%;
    border-right: 1px dashed white;
}
.u-hz .u-cursor-y, .u-vt .u-cursor-x {
    width: 100%;
    border-bottom: 1px dashed white;
}
.u-cursor-pt {
    position: absolute;
    top: 0;
    left: 0;
    border-radius: 50%;
    border: 0 solid;
    pointer-events: none;
    will-change: transform;
    z-index: 100;
    /*this has to be !important since we set inline "background" shorthand */
    background-clip: padding-box !important;
}
.u-axis.u-off, .u-select.u-off, .u-cursor-x.u-off, .u-cursor-y.u-off, .u-cursor-pt.u-off {
    display: none;
}

`

    // border-bottom: 1px dashed #607D8B;
