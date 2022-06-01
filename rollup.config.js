// import {terser} from 'rollup-plugin-terser';
import babel from "rollup-plugin-babel";
import { nodeResolve } from "@rollup/plugin-node-resolve";
// import esformatter from 'rollup-plugin-esformatter';
import json from '@rollup/plugin-json';
// import commonjs from '@rollup/plugin-commonjs';
import prettier from 'rollup-plugin-prettier';




const SRC_DIR   = 'src';
const BUILD_DIR = 'dist';

const input = [`${SRC_DIR}/index.js`];

const name = 'ZitiBrowzerRuntime';
const fileName = 'dist/iife/ziti-browzer-runtime.js';

let plugins = [
  babel({
    exclude: "node_modules/**"
  }),
  json(),
  // commonjs(),
  // terser(),
  prettier({
    tabWidth: 2,
    singleQuote: false,
  }),
];

export default [
  //
  // IIFE
  //
  {
    input,
    output: [
      {
        format: "iife",
        esModule: false,
        name: name,
        file: fileName,
        exports: "named",
      },
    ],
    treeshake: true,
    plugins: plugins.concat(nodeResolve()),
  },
];
