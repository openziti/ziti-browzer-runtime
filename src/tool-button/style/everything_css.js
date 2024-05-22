
export {  
  EVERYTHING_CSS
};

const EVERYTHING_CSS = 


`
.eruda-dev-tools{position:absolute;width:100%;height:100%;left:0;bottom:0;background:#fff;z-index:500;display:none;padding-top:40px!important;opacity:0;transition:opacity .3s;border-top:1px solid #ccc}.eruda-dev-tools .eruda-resizer{position:absolute;width:100%;touch-action:none;left:0;top:-8px;cursor:row-resize;z-index:120}.eruda-dev-tools .eruda-tools{overflow:auto;-webkit-overflow-scrolling:touch;height:100%;width:100%;position:relative}.eruda-dev-tools .eruda-tools .eruda-tool{position:absolute;width:100%;height:100%;left:0;top:0;overflow:hidden;display:none}

.eruda-container .eruda-entry-btn{touch-action:none;width:40px;height:40px;display:flex;background:#000;opacity:.3;border-radius:10px;position:relative;z-index:1000;transition:opacity .3s;color:#fff;font-size:25px;align-items:center;justify-content:center}.eruda-container .eruda-entry-btn.eruda-active,.eruda-container .eruda-entry-btn:active{opacity:.8}

#eruda-settings{overflow-y:auto;-webkit-overflow-scrolling:touch}.eruda-safe-area #eruda-settings{padding-bottom:calc(0px + env(safe-area-inset-bottom))}

#eruda-console{padding-top:40px;padding-bottom:24px;width:100%;height:100%}#eruda-console.eruda-js-input-hidden{padding-bottom:0}#eruda-console .eruda-control{position:absolute;width:100%;height:40px;left:0;top:0;cursor:default;font-size:0;background:#f3f3f3;color:#333;line-height:20px;border-bottom:1px solid #ccc;padding:10px 10px 10px 35px}#eruda-console .eruda-control [class*=' eruda-icon-'],#eruda-console .eruda-control [class^='eruda-icon-']{display:inline-block;padding:10px;font-size:16px;position:absolute;top:0;cursor:pointer;transition:color .3s}#eruda-console .eruda-control [class*=' eruda-icon-'].eruda-active,#eruda-console .eruda-control [class*=' eruda-icon-']:active,#eruda-console .eruda-control [class^='eruda-icon-'].eruda-active,#eruda-console .eruda-control [class^='eruda-icon-']:active{color:#1a73e8}#eruda-console .eruda-control .eruda-icon-clear{padding-right:0;left:0}#eruda-console .eruda-control .eruda-icon-copy{right:0}#eruda-console .eruda-control .eruda-icon-filter{right:23px}#eruda-console .eruda-control .eruda-level{cursor:pointer;font-size:12px;height:20px;display:inline-block;margin:0 2px;padding:0 4px;line-height:20px;transition:background-color .3s,color .3s}#eruda-console .eruda-control .eruda-level.eruda-active{background:#eaeaea;color:#333}#eruda-console .eruda-control .eruda-filter-text{white-space:nowrap;position:absolute;line-height:20px;max-width:80px;overflow:hidden;right:55px;font-size:14px;text-overflow:ellipsis}#eruda-console .eruda-js-input{pointer-events:none;position:absolute;z-index:100;left:0;bottom:0;width:100%;border-top:1px solid #ccc;height:24px}#eruda-console .eruda-js-input .eruda-icon-arrow-right{line-height:23px;color:#1a73e8;position:absolute;left:10px;top:0;z-index:10}#eruda-console .eruda-js-input.eruda-active{height:100%;padding-top:40px;padding-bottom:40px;border-top:none}#eruda-console .eruda-js-input.eruda-active .eruda-icon-arrow-right{display:none}#eruda-console .eruda-js-input.eruda-active textarea{overflow:auto;padding-left:10px}#eruda-console .eruda-js-input .eruda-buttons{display:none;position:absolute;left:0;bottom:0;width:100%;height:40px;color:#333;background:#f3f3f3;font-size:12px;border-top:1px solid #ccc}#eruda-console .eruda-js-input .eruda-buttons .eruda-button{pointer-events:all;cursor:pointer;flex:1;text-align:center;border-right:1px solid #ccc;height:40px;line-height:40px;transition:background-color .3s,color .3s}#eruda-console .eruda-js-input .eruda-buttons .eruda-button:last-child{border-right:none}#eruda-console .eruda-js-input .eruda-buttons .eruda-button:active{color:#333;background:#eaeaea}#eruda-console .eruda-js-input textarea{overflow:hidden;pointer-events:all;padding:3px 10px;padding-left:25px;outline:0;border:none;font-size:14px;width:100%;height:100%;-webkit-user-select:text;-moz-user-select:text;-ms-user-select:text;user-select:text;resize:none;color:#333;background:#fff}.eruda-safe-area #eruda-console{padding-bottom:calc(24px + env(safe-area-inset-bottom))}.eruda-safe-area #eruda-console.eruda-js-input-hidden{padding-bottom:0}.eruda-safe-area #eruda-console .eruda-js-input{height:calc(24px + env(safe-area-inset-bottom))}.eruda-safe-area #eruda-console .eruda-js-input.eruda-active{height:100%;padding-bottom:calc(40px + env(safe-area-inset-bottom))}.eruda-safe-area #eruda-console .eruda-js-input .eruda-buttons{height:calc(40px + env(safe-area-inset-bottom))}.eruda-safe-area #eruda-console .eruda-js-input .eruda-buttons .eruda-button{height:calc(40px + env(safe-area-inset-bottom))}

#eruda-elements .eruda-elements{position:absolute;width:100%;height:100%;left:0;top:0;padding-top:40px;padding-bottom:24px;font-size:14px}#eruda-elements .eruda-control{position:absolute;width:100%;height:40px;left:0;top:0;cursor:default;font-size:0;background:#f3f3f3;color:#333;line-height:20px;border-bottom:1px solid #ccc;padding:10px 0}#eruda-elements .eruda-control [class*=' eruda-icon-'],#eruda-elements .eruda-control [class^='eruda-icon-']{display:inline-block;padding:10px;font-size:16px;position:absolute;top:0;cursor:pointer;transition:color .3s}#eruda-elements .eruda-control [class*=' eruda-icon-'].eruda-active,#eruda-elements .eruda-control [class*=' eruda-icon-']:active,#eruda-elements .eruda-control [class^='eruda-icon-'].eruda-active,#eruda-elements .eruda-control [class^='eruda-icon-']:active{color:#1a73e8}#eruda-elements .eruda-control .eruda-icon-eye{right:0}#eruda-elements .eruda-control .eruda-icon-copy{right:23px}#eruda-elements .eruda-control .eruda-icon-delete{right:46px}#eruda-elements .eruda-dom-viewer-container{overflow-y:auto;-webkit-overflow-scrolling:touch;height:100%;padding:5px 0}#eruda-elements .eruda-crumbs{position:absolute;width:100%;height:24px;left:0;top:0;top:initial;line-height:24px;bottom:0;border-top:1px solid #ccc;background:#f3f3f3;color:#333;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#eruda-elements .eruda-crumbs li{cursor:pointer;padding:0 7px;display:inline-block}#eruda-elements .eruda-crumbs li:hover,#eruda-elements .eruda-crumbs li:last-child{background:#eaeaea}#eruda-elements .eruda-crumbs .eruda-icon-arrow-right{font-size:12px;position:relative;top:1px}#eruda-elements .eruda-detail{position:absolute;width:100%;height:100%;left:0;top:0;z-index:10;padding-top:40px;display:none;background:#fff}#eruda-elements .eruda-detail .eruda-control{padding:10px 35px}#eruda-elements .eruda-detail .eruda-control .eruda-element-name{font-size:12px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;width:100%;display:inline-block}#eruda-elements .eruda-detail .eruda-control .eruda-icon-arrow-left{left:0}#eruda-elements .eruda-detail .eruda-control .eruda-icon-refresh{right:0}#eruda-elements .eruda-detail .eruda-element{overflow-y:auto;-webkit-overflow-scrolling:touch;height:100%}#eruda-elements .eruda-section{border-bottom:1px solid #ccc;color:#333;margin:10px 0}#eruda-elements .eruda-section h2{color:#333;background:#f3f3f3;border-top:1px solid #ccc;padding:10px;line-height:18px;font-size:14px;transition:background-color .3s}#eruda-elements .eruda-section h2 .eruda-btn{margin-left:5px;float:right;color:#333;width:18px;height:18px;font-size:16px;cursor:pointer;transition:color .3s}#eruda-elements .eruda-section h2 .eruda-btn.eruda-filter-text{width:auto;max-width:80px;font-size:14px;overflow:hidden;font-weight:400;text-overflow:ellipsis;display:inline-block}#eruda-elements .eruda-section h2 .eruda-btn:active{color:#1a73e8}#eruda-elements .eruda-section h2 .eruda-btn.eruda-btn-disabled{color:inherit!important;cursor:default!important;pointer-events:none;opacity:.5}#eruda-elements .eruda-section h2 .eruda-btn.eruda-btn-disabled *{pointer-events:none}#eruda-elements .eruda-section h2.eruda-active-effect{cursor:pointer}#eruda-elements .eruda-section h2.eruda-active-effect:active{background:#eaeaea;color:#333}#eruda-elements .eruda-attributes{font-size:12px}#eruda-elements .eruda-attributes a{color:#1155cc}#eruda-elements .eruda-attributes .eruda-table-wrapper{overflow-x:auto;-webkit-overflow-scrolling:touch}#eruda-elements .eruda-attributes table td{padding:5px 10px}#eruda-elements .eruda-text-content{background:#fff}#eruda-elements .eruda-text-content .eruda-content{overflow-x:auto;-webkit-overflow-scrolling:touch;padding:10px}#eruda-elements .eruda-style-color{position:relative;top:1px;width:10px;height:10px;border-radius:50%;margin-right:2px;border:1px solid #ccc;display:inline-block}#eruda-elements .eruda-box-model{overflow-x:auto;-webkit-overflow-scrolling:touch;padding:10px;text-align:center;border-bottom:1px solid var(--color)}#eruda-elements .eruda-computed-style{font-size:12px}#eruda-elements .eruda-computed-style a{color:#1155cc}#eruda-elements .eruda-computed-style .eruda-table-wrapper{overflow-y:auto;-webkit-overflow-scrolling:touch;max-height:200px;border-top:1px solid #ccc}#eruda-elements .eruda-computed-style table td{padding:5px 10px}#eruda-elements .eruda-computed-style table td.eruda-key{white-space:nowrap;color:#c80000}#eruda-elements .eruda-styles{font-size:12px}#eruda-elements .eruda-styles .eruda-style-wrapper{padding:10px}#eruda-elements .eruda-styles .eruda-style-wrapper .eruda-style-rules{border:1px solid #ccc;padding:10px;margin-bottom:10px}#eruda-elements .eruda-styles .eruda-style-wrapper .eruda-style-rules .eruda-rule{padding-left:2em;word-break:break-all}#eruda-elements .eruda-styles .eruda-style-wrapper .eruda-style-rules .eruda-rule a{color:#1155cc}#eruda-elements .eruda-styles .eruda-style-wrapper .eruda-style-rules .eruda-rule span{color:#c80000}#eruda-elements .eruda-styles .eruda-style-wrapper .eruda-style-rules:last-child{margin-bottom:0}#eruda-elements .eruda-listeners{font-size:12px}#eruda-elements .eruda-listeners .eruda-listener-wrapper{padding:10px}#eruda-elements .eruda-listeners .eruda-listener-wrapper .eruda-listener{margin-bottom:10px;overflow:hidden;border:1px solid #ccc}#eruda-elements .eruda-listeners .eruda-listener-wrapper .eruda-listener .eruda-listener-type{padding:10px;background:#f3f3f3;color:#333}#eruda-elements .eruda-listeners .eruda-listener-wrapper .eruda-listener .eruda-listener-content li{overflow-x:auto;-webkit-overflow-scrolling:touch;padding:10px;border-top:none}.eruda-safe-area #eruda-elements .eruda-elements{padding-bottom:calc(24px + env(safe-area-inset-bottom))}.eruda-safe-area #eruda-elements .eruda-crumbs{height:calc(24px + env(safe-area-inset-bottom))}.eruda-safe-area #eruda-elements .eruda-element{padding-bottom:calc(0px + env(safe-area-inset-bottom))}@media screen and (min-width:680px){#eruda-elements .eruda-elements{width:50%}#eruda-elements .eruda-elements .eruda-control .eruda-icon-eye{display:none}#eruda-elements .eruda-elements .eruda-control .eruda-icon-copy{right:0}#eruda-elements .eruda-elements .eruda-control .eruda-icon-delete{right:23px}#eruda-elements .eruda-detail{width:50%;left:initial;right:0;border-left:1px solid #ccc}#eruda-elements .eruda-detail .eruda-control{padding-left:10px}#eruda-elements .eruda-detail .eruda-control .eruda-icon-arrow-left{display:none}}

#eruda-network .eruda-network{position:absolute;width:100%;height:100%;left:0;top:0;padding-top:39px}#eruda-network .eruda-control{position:absolute;width:100%;height:40px;left:0;top:0;cursor:default;font-size:0;background:#f3f3f3;color:#333;line-height:20px;border-bottom:1px solid #ccc;padding:10px;border-bottom:none}#eruda-network .eruda-control [class*=' eruda-icon-'],#eruda-network .eruda-control [class^='eruda-icon-']{display:inline-block;padding:10px;font-size:16px;position:absolute;top:0;cursor:pointer;transition:color .3s}#eruda-network .eruda-control [class*=' eruda-icon-'].eruda-active,#eruda-network .eruda-control [class*=' eruda-icon-']:active,#eruda-network .eruda-control [class^='eruda-icon-'].eruda-active,#eruda-network .eruda-control [class^='eruda-icon-']:active{color:#1a73e8}#eruda-network .eruda-control .eruda-title{font-size:14px}#eruda-network .eruda-control .eruda-icon-clear{left:23px}#eruda-network .eruda-control .eruda-icon-eye{right:0}#eruda-network .eruda-control .eruda-icon-copy{right:23px}#eruda-network .eruda-control .eruda-icon-filter{right:46px}#eruda-network .eruda-control .eruda-filter-text{white-space:nowrap;position:absolute;line-height:20px;max-width:80px;overflow:hidden;right:88px;font-size:14px;text-overflow:ellipsis}#eruda-network .eruda-control .eruda-icon-record{left:0}#eruda-network .eruda-control .eruda-icon-record.eruda-recording{color:#f00;text-shadow:0 0 4px #f00}#eruda-network .eruda-request-error{color:#f00}#eruda-network .luna-data-grid:focus .luna-data-grid-data-container .eruda-request-error.luna-data-grid-selected{background:#fff0f0}#eruda-network .luna-data-grid{border-left:none;border-right:none}#eruda-network .eruda-detail{position:absolute;width:100%;height:100%;left:0;top:0;z-index:10;display:none;padding-top:40px;background:#fff}#eruda-network .eruda-detail .eruda-control{padding:10px 35px;border-bottom:1px solid #ccc}#eruda-network .eruda-detail .eruda-control .eruda-url{font-size:12px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;width:100%;display:inline-block}#eruda-network .eruda-detail .eruda-control .eruda-icon-arrow-left{left:0}#eruda-network .eruda-detail .eruda-control .eruda-icon-delete{left:0;display:none}#eruda-network .eruda-detail .eruda-control .eruda-icon-copy{right:0}#eruda-network .eruda-detail .eruda-http{overflow-y:auto;-webkit-overflow-scrolling:touch;height:100%}#eruda-network .eruda-detail .eruda-http .eruda-section{border-top:1px solid #ccc;border-bottom:1px solid #ccc;margin-top:10px;margin-bottom:10px}#eruda-network .eruda-detail .eruda-http .eruda-section h2{background:#f3f3f3;color:#333;padding:10px;line-height:18px;font-size:14px}#eruda-network .eruda-detail .eruda-http .eruda-section table{color:#333}#eruda-network .eruda-detail .eruda-http .eruda-section table *{-webkit-user-select:text;-moz-user-select:text;-ms-user-select:text;user-select:text}#eruda-network .eruda-detail .eruda-http .eruda-section table td{font-size:12px;padding:5px 10px;word-break:break-all}#eruda-network .eruda-detail .eruda-http .eruda-section table .eruda-key{white-space:nowrap;font-weight:700;color:#1a73e8}#eruda-network .eruda-detail .eruda-http .eruda-data,#eruda-network .eruda-detail .eruda-http .eruda-response{-webkit-user-select:text;-moz-user-select:text;-ms-user-select:text;user-select:text;overflow-x:auto;-webkit-overflow-scrolling:touch;padding:10px;font-size:12px;margin:10px 0;white-space:pre-wrap;border-top:1px solid #ccc;color:#333;border-bottom:1px solid #ccc}.eruda-safe-area #eruda-network .eruda-http{padding-bottom:calc(0px + env(safe-area-inset-bottom))}@media screen and (min-width:680px){#eruda-network .eruda-network .eruda-control .eruda-icon-eye{display:none}#eruda-network .eruda-network .eruda-control .eruda-icon-copy{right:0}#eruda-network .eruda-network .eruda-control .eruda-icon-filter{right:23px}#eruda-network .eruda-network .eruda-control .eruda-filter-text{right:55px}#eruda-network .eruda-detail{width:50%;left:initial;right:0;border-left:1px solid #ccc}#eruda-network .eruda-detail .eruda-control .eruda-icon-arrow-left{display:none}#eruda-network .eruda-detail .eruda-control .eruda-icon-delete{display:block}}

#eruda-resources{overflow-y:auto;-webkit-overflow-scrolling:touch;padding:10px;font-size:14px}#eruda-resources .eruda-section{margin-bottom:10px;overflow:hidden;border:1px solid #ccc}#eruda-resources .eruda-section.eruda-warn{border:1px solid #fff5c2}#eruda-resources .eruda-section.eruda-warn .eruda-title{background:#fffbe5;color:#5c5c00}#eruda-resources .eruda-section.eruda-danger{border:1px solid #ffd6d6}#eruda-resources .eruda-section.eruda-danger .eruda-title{background:#fff0f0;color:#f00}#eruda-resources .eruda-section.eruda-cookie,#eruda-resources .eruda-section.eruda-local-storage,#eruda-resources .eruda-section.eruda-session-storage{border:none}#eruda-resources .eruda-section.eruda-cookie .eruda-title,#eruda-resources .eruda-section.eruda-local-storage .eruda-title,#eruda-resources .eruda-section.eruda-session-storage .eruda-title{border:1px solid #ccc;border-bottom:none}#eruda-resources .eruda-title{padding:10px;line-height:18px;color:#333;background:#f3f3f3}#eruda-resources .eruda-title .eruda-btn{margin-left:5px;float:right;color:#333;width:18px;height:18px;font-size:16px;cursor:pointer;transition:color .3s}#eruda-resources .eruda-title .eruda-btn.eruda-filter-text{width:auto;max-width:80px;font-size:14px;overflow:hidden;font-weight:400;text-overflow:ellipsis;display:inline-block}#eruda-resources .eruda-title .eruda-btn:active{color:#1a73e8}#eruda-resources .eruda-title .eruda-btn.eruda-btn-disabled{color:inherit!important;cursor:default!important;pointer-events:none;opacity:.5}#eruda-resources .eruda-title .eruda-btn.eruda-btn-disabled *{pointer-events:none}#eruda-resources .eruda-link-list{font-size:12px;color:#333}#eruda-resources .eruda-link-list li{padding:10px;word-break:break-all}#eruda-resources .eruda-link-list li a{color:#1155cc!important}#eruda-resources .eruda-image-list{color:#333;font-size:12px;display:flex;flex-wrap:wrap;padding:10px!important}#eruda-resources .eruda-image-list:after{content:'';display:block;clear:both}#eruda-resources .eruda-image-list li{flex-grow:1;cursor:pointer;overflow-y:hidden}#eruda-resources .eruda-image-list li.eruda-image{height:100px;font-size:0}#eruda-resources .eruda-image-list li img{height:100px;min-width:100%;-o-object-fit:cover;object-fit:cover}.eruda-safe-area #eruda-resources{padding-bottom:calc(10px + env(safe-area-inset-bottom))}

#eruda-sources{font-size:0;overflow-y:auto;-webkit-overflow-scrolling:touch;color:#333}#eruda-sources .eruda-code-wrapper,#eruda-sources .eruda-raw-wrapper{overflow-x:auto;-webkit-overflow-scrolling:touch;width:100%;min-height:100%}#eruda-sources .eruda-code,#eruda-sources .eruda-raw{height:100%}#eruda-sources .eruda-code .eruda-keyword,#eruda-sources .eruda-raw .eruda-keyword{color:#881280}#eruda-sources .eruda-code .eruda-comment,#eruda-sources .eruda-raw .eruda-comment{color:#236e25}#eruda-sources .eruda-code .eruda-number,#eruda-sources .eruda-raw .eruda-number{color:#1c00cf}#eruda-sources .eruda-code .eruda-string,#eruda-sources .eruda-raw .eruda-string{color:#1a1aa6}#eruda-sources .eruda-code .eruda-operator,#eruda-sources .eruda-raw .eruda-operator{color:#808080}#eruda-sources .eruda-code[data-type=html] .eruda-keyword,#eruda-sources .eruda-raw[data-type=html] .eruda-keyword{color:#881280}#eruda-sources .eruda-image{font-size:12px}#eruda-sources .eruda-image .eruda-breadcrumb{background:#f3f3f3;color:#333;-webkit-user-select:text;-moz-user-select:text;-ms-user-select:text;user-select:text;margin-bottom:10px;word-break:break-all;padding:10px;font-size:16px;min-height:40px;border-bottom:1px solid #ccc}#eruda-sources .eruda-image .eruda-img-container{text-align:center}#eruda-sources .eruda-image .eruda-img-container img{max-width:100%}#eruda-sources .eruda-image .eruda-img-info{text-align:center;margin:20px 0;color:#333}#eruda-sources .eruda-json{padding:0 10px}#eruda-sources .eruda-json *{-webkit-user-select:text;-moz-user-select:text;-ms-user-select:text;user-select:text}#eruda-sources iframe{width:100%;height:100%}

#eruda-info{overflow-y:auto;-webkit-overflow-scrolling:touch}#eruda-info li{margin:10px;border:1px solid #ccc}#eruda-info li .eruda-content,#eruda-info li .eruda-title{padding:10px}#eruda-info li .eruda-title{position:relative;padding-bottom:0;color:#1a73e8}#eruda-info li .eruda-title .eruda-icon-copy{position:absolute;right:10px;top:14px;color:#333;cursor:pointer;transition:color .3s}#eruda-info li .eruda-title .eruda-icon-copy:active{color:#1a73e8}#eruda-info li .eruda-content{margin:0;-webkit-user-select:text;-moz-user-select:text;-ms-user-select:text;user-select:text;color:#333;font-size:12px;word-break:break-all}#eruda-info li .eruda-content table{width:100%;border-collapse:collapse}#eruda-info li .eruda-content table td,#eruda-info li .eruda-content table th{border:1px solid #ccc;padding:10px}#eruda-info li .eruda-content *{-webkit-user-select:text;-moz-user-select:text;-ms-user-select:text;user-select:text}#eruda-info li .eruda-content a{color:#1155cc}#eruda-info li .eruda-device-key,#eruda-info li .eruda-system-key{width:100px}.eruda-safe-area #eruda-info{padding-bottom:calc(10px + env(safe-area-inset-bottom))}

#eruda-changelog{overflow-y:auto;-webkit-overflow-scrolling:touch}#eruda-changelog li{margin:10px;border:1px solid #ccc}#eruda-changelog li .eruda-content,#eruda-changelog li .eruda-title{padding:10px}#eruda-changelog li .eruda-title{position:relative;padding-bottom:0;color:#1a73e8}#eruda-changelog li .eruda-title .eruda-icon-copy{position:absolute;right:10px;top:14px;color:#333;cursor:pointer;transition:color .3s}#eruda-changelog li .eruda-title .eruda-icon-copy:active{color:#1a73e8}#eruda-changelog li .eruda-content{margin:0;-webkit-user-select:text;-moz-user-select:text;-ms-user-select:text;user-select:text;color:#333;font-size:12px;word-break:break-all}#eruda-changelog li .eruda-content table{width:100%;border-collapse:collapse}#eruda-changelog li .eruda-content table td,#eruda-changelog li .eruda-content table th{border:1px solid #ccc;padding:10px}#eruda-changelog li .eruda-content *{-webkit-user-select:text;-moz-user-select:text;-ms-user-select:text;user-select:text}#eruda-changelog li .eruda-content a{color:#1155cc}#eruda-changelog li .eruda-device-key,#eruda-changelog li .eruda-system-key{width:100px}.eruda-safe-area #eruda-changelog{padding-bottom:calc(10px + env(safe-area-inset-bottom))}

#eruda-feedback{overflow-y:auto;-webkit-overflow-scrolling:touch}#eruda-feedback li{margin:10px;border:1px solid #ccc}#eruda-feedback li .eruda-content,#eruda-feedback li .eruda-title{padding:10px}#eruda-feedback li .eruda-title{position:relative;padding-bottom:0;color:#1a73e8}#eruda-feedback li .eruda-title .eruda-icon-copy{position:absolute;right:10px;top:14px;color:#333;cursor:pointer;transition:color .3s}#eruda-feedback li .eruda-title .eruda-icon-copy:active{color:#1a73e8}#eruda-feedback li .eruda-content{margin:0;-webkit-user-select:text;-moz-user-select:text;-ms-user-select:text;user-select:text;color:#333;font-size:12px;word-break:break-all}#eruda-feedback li .eruda-content table{width:100%;border-collapse:collapse}#eruda-feedback li .eruda-content table td,#eruda-feedback li .eruda-content table th{border:1px solid #ccc;padding:10px}#eruda-feedback li .eruda-content *{-webkit-user-select:text;-moz-user-select:text;-ms-user-select:text;user-select:text}#eruda-feedback li .eruda-content a{color:#1155cc}#eruda-feedback li .eruda-device-key,#eruda-feedback li .eruda-system-key{width:100px}.eruda-safe-area #eruda-feedback{padding-bottom:calc(10px + env(safe-area-inset-bottom))}

#eruda-snippets{overflow-y:auto;-webkit-overflow-scrolling:touch;padding:10px}#eruda-snippets .eruda-section{margin-bottom:10px;border:1px solid #ccc;overflow:hidden;cursor:pointer}#eruda-snippets .eruda-section:active .eruda-name{background:#eaeaea;color:#333}#eruda-snippets .eruda-section .eruda-name{padding:10px;line-height:18px;color:#333;background:#f3f3f3;transition:background-color .3s}#eruda-snippets .eruda-section .eruda-name .eruda-btn{margin-left:10px;float:right;text-align:center;width:18px;height:18px;font-size:12px}#eruda-snippets .eruda-section .eruda-description{font-size:12px;color:#333;padding:10px;transition:background-color .3s}.eruda-safe-area #eruda-snippets{padding-bottom:calc(10px + env(safe-area-inset-bottom))}

.eruda-container .eruda-entry-btn{
	touch-action:none;
	width:40px;
	height:40px;
	display:flex;
	background:#ece8f5;
	opacity:.9;
	border-radius:10px;
	position:relative;
	z-index:1000;
	transition:opacity .3s;
	color:#fff;
	font-size:25px;
	align-items:center;
	justify-content:center
}
.eruda-container .eruda-entry-btn.eruda-active,.eruda-container .eruda-entry-btn:active{
	opacity:.5
}

.luna-setting-item-checkbox input:checked:after {
  content: "";
  width: 100%;
  height: 100%;
  position: absolute;
  left: 0;
  top: 0;
  background-image: url(data:image/svg+xml;base64,PHN2ZyBoZWlnaHQ9JzMwMHB4JyB3aWR0aD0nMzAwcHgnICBmaWxsPSIjZmZmZmZmIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB2aWV3Qm94PSIwIDAgMTAwIDEwMCIgdmVyc2lvbj0iMS4xIiB4PSIwcHgiIHk9IjBweCI+PHRpdGxlPmljb25fYnlfUG9zaGx5YWtvdjEwPC90aXRsZT48ZGVzYz5DcmVhdGVkIHdpdGggU2tldGNoLjwvZGVzYz48ZyBzdHJva2U9Im5vbmUiIHN0cm9rZS13aWR0aD0iMSIgZmlsbD0ibm9uZSIgZmlsbC1ydWxlPSJldmVub2RkIj48ZyBmaWxsPSIjZmZmZmZmIj48ZyB0cmFuc2Zvcm09InRyYW5zbGF0ZSgyNi4wMDAwMDAsIDI2LjAwMDAwMCkiPjxwYXRoIGQ9Ik0xNy45OTk5ODc4LDMyLjQgTDEwLjk5OTk4NzgsMjUuNCBDMTAuMjI2Nzg5MSwyNC42MjY4MDE0IDguOTczMTg2NDQsMjQuNjI2ODAxNCA4LjE5OTk4Nzc5LDI1LjQgTDguMTk5OTg3NzksMjUuNCBDNy40MjY3ODkxNCwyNi4xNzMxOTg2IDcuNDI2Nzg5MTQsMjcuNDI2ODAxNCA4LjE5OTk4Nzc5LDI4LjIgTDE2LjU4NTc3NDIsMzYuNTg1Nzg2NCBDMTcuMzY2ODIyOCwzNy4zNjY4MzUgMTguNjMzMTUyOCwzNy4zNjY4MzUgMTkuNDE0MjAxNCwzNi41ODU3ODY0IEw0MC41OTk5ODc4LDE1LjQgQzQxLjM3MzE4NjQsMTQuNjI2ODAxNCA0MS4zNzMxODY0LDEzLjM3MzE5ODYgNDAuNTk5OTg3OCwxMi42IEw0MC41OTk5ODc4LDEyLjYgQzM5LjgyNjc4OTEsMTEuODI2ODAxNCAzOC41NzMxODY0LDExLjgyNjgwMTQgMzcuNzk5OTg3OCwxMi42IEwxNy45OTk5ODc4LDMyLjQgWiI+PC9wYXRoPjwvZz48L2c+PC9nPjwvc3ZnPg==);
  background-size: 30px;
  background-repeat: no-repeat;
  background-position: center;
}

.changelogButtonContainer .btn {
  margin-bottom: 0;
  font-weight: 600;
  text-align: center;
  white-space: nowrap;
  vertical-align: middle;
  -ms-touch-action: manipulation;
  touch-action: manipulation;
  cursor: pointer;
  background-image: none;
  border: 1px solid transparent;
  padding: 6px 12px;
  font-size: 14px;
  line-height: 1.42857143;
  border-radius: 4px;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none
}

.changelogButtonContainer .btn-primary {
  color: #fff;
  background-color: #1bb3fd;
  border-color: #1bb3fd
}

`
