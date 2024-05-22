export {  
  ENTRY_BTN_CSS
};

const ENTRY_BTN_CSS = 

`
.container {
  .entry-btn {
    touch-action: none;
    width: 40px;
    height: 40px;
    display: flex;
    background: #000;
    opacity: 0.3;
    border-radius: 10px;
    position: relative;
    z-index: 1000;
    transition: opacity 0.3s;
    color: #fff;
    font-size: 25px;
    align-items: center;
    justify-content: center;
    &.active,
    &:active {
      opacity: 0.8;
    }
  }
}
`