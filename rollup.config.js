// import {terser} from 'rollup-plugin-terser';
import babel from "rollup-plugin-babel";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import json from '@rollup/plugin-json';
import commonjs from '@rollup/plugin-commonjs';
import prettier from 'rollup-plugin-prettier';
import copy from 'rollup-plugin-copy';
import nodePolyfills from 'rollup-plugin-polyfill-node';
import css from 'rollup-plugin-css-only';


const SRC_DIR   = 'src';
const BUILD_DIR = 'dist';

const input = [`${SRC_DIR}/index.js`];

const name = 'ZitiBrowzerRuntime';

let plugins = [
  babel({
    exclude: "node_modules/**"
  }),
  json(),
  commonjs({
    include: /node_modules/,
    requireReturnsDefault: 'auto'
  }),
  // terser(),
  prettier({
    tabWidth: 2,
    singleQuote: false,
  }),
  copy({
    targets: [
      { 
        src: 'static/*', 
        dest: 'dist' 
      }
    ]
  }),
  nodePolyfills(),
  nodeResolve(),
  css({
  })  
];

export default [
  //
  // IIFE
  //
  {
    input,
    output: [{
      format:         'iife',
      esModule:       false,
      name:           name,
      dir:            'dist',
      entryFileNames: 'ziti-browzer-runtime-[hash].js',
      exports:        'named',
      assetFileNames: 'ziti-browzer-css-[hash].css'
    }],
    treeshake: true,
    plugins: plugins,
  },
];
