
export {  
  INFO_CSS
};

const INFO_CSS = 

`
#eruda-info{
	overflow-y:auto;
	-webkit-overflow-scrolling:touch
}
#eruda-info li{
	margin:10px;
	border:1px solid #423f43
}
#eruda-info li .eruda-content,#eruda-info li .eruda-title{
	padding:10px
}
#eruda-info li .eruda-title{
	position:relative;
	padding-bottom:0;
	color:#ffd866
}
#eruda-info li .eruda-title .eruda-icon-copy{
	position:absolute;
	right:10px;
	top:14px;
	color:#939293;
	cursor:pointer;
	transition:color .3s
}
#eruda-info li .eruda-title .eruda-icon-copy:active{
	color:#ffd866
}
#eruda-info li .eruda-content{
	margin:0;
	-webkit-user-select:text;
	-moz-user-select:text;
	-ms-user-select:text;
	user-select:text;
	color:#fcfcfa;
	font-size:12px;
	word-break:break-all
}
#eruda-info li .eruda-content table{
	width:100%;
	border-collapse:collapse
}
#eruda-info li .eruda-content table td,#eruda-info li .eruda-content table th{
	border:1px solid #423f43;
	padding:10px
}
#eruda-info li .eruda-content *{
	-webkit-user-select:text;
	-moz-user-select:text;
	-ms-user-select:text;
	user-select:text
}
#eruda-info li .eruda-content a{
	color:#78DCE8
}
#eruda-info li .eruda-device-key,#eruda-info li .eruda-system-key{
	width:100px
}
.eruda-safe-area #eruda-info{
	padding-bottom:calc(10px + env(safe-area-inset-bottom))
}
`