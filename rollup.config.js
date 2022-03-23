// import {terser} from 'rollup-plugin-terser';
import babel from "rollup-plugin-babel";
import { nodeResolve } from "@rollup/plugin-node-resolve";
// import esformatter from 'rollup-plugin-esformatter';
// import json from '@rollup/plugin-json';
// import commonjs from '@rollup/plugin-commonjs';



const SRC_DIR   = 'src';
const BUILD_DIR = 'dist';

const input = [`${SRC_DIR}/index.js`];

const name = 'ZitiBrowzerRuntime';

let plugins = [
  babel({
    exclude: "node_modules/**"
  }),
  // json(),
  // commonjs(),
  // terser(),
];

export default [
  //
  // IIFE
  //
  {
    input,
    output: [
      {
        dir: "dist/iife",
        format: "iife",
        esModule: false,
        name: name,
        exports: "named",
      },
    ],
    treeshake: true,
    plugins: plugins.concat(nodeResolve()),
  },
  // //
  // // UMD
  // //
  // {
  //   input,
  //   output: [
  //     {
  //       dir: "dist/umd",
  //       format: "umd",
  //       esModule: false,
  //       name: name,
  //       exports: "named",
  //     },
  //   ],
  //   treeshake: true,
  //   plugins: plugins.concat(nodeResolve()),
  // },
  // //
  // // ESM and CJS
  // //
  // {
  //   input,
  //   plugins: plugins.concat(nodeResolve(), esformatter({indent: { value: '  '}})),
  //   output: [
  //     {
  //       dir: "dist/esm",
  //       format: "esm",
  //       exports: "named",
  //     },
  //     {
  //       dir: "dist/cjs",
  //       format: "cjs",
  //       exports: "named",
  //     },
  //   ],
  // },
];
