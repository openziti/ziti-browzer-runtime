import fs from 'fs';
import child_process from 'child_process';
import path from 'path';
import {fileURLToPath} from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sdkRevision = child_process
  .execSync('git rev-parse HEAD')
  .toString().trim()

const sdkBranch = child_process
  .execSync('git rev-parse --abbrev-ref HEAD')
  .toString().trim()

const params = `const buildInfo = {
    sdkRevision: '${sdkRevision}',
    sdkBranch: '${sdkBranch}'
};

export {
    buildInfo
}
`

fs.writeFileSync(__dirname + '/../src/buildInfo.js', params, () => {
  console.log('Prebuild finished');
});
