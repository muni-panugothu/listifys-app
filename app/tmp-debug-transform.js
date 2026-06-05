const fs = require('fs');
const path = require('path');
const projectRoot = process.cwd();
const metroConfig = require('@expo/metro-config');
const config = metroConfig.getDefaultConfig(projectRoot);
const worker = require(metroConfig.unstable_transformerPath);
const transformerPath = path.resolve(projectRoot, 'node_modules', 'react-native-css', 'dist', 'commonjs', 'metro', 'metro-transformer.js');
const transformer = require(transformerPath);
const filePath = path.join(projectRoot, 'global.css');
const source = fs.readFileSync(filePath);

console.log('projectRoot', projectRoot);
console.log('filePath', filePath);
console.log('using transformer from', transformerPath);

worker.transform(config, projectRoot, filePath, source, { type: 'sourceFile', platform: 'web' })
  .then((cssFile) => {
    const cssCode = cssFile.output[0].data.css.code.toString();
    console.log('CSS OUTPUT START');
    console.log(cssCode.slice(0, 2000));
    console.log('CSS OUTPUT END');
    const lightningcss = require('lightningcss');
    try {
      console.log('RUNNING DIRECT lightningcss TRANSFORM');
      const direct = lightningcss.transform({ code: Buffer.from(cssCode), filename: 'global.css' });
      console.log('DIRECT TRANSFORM OK', direct.code && direct.code.length);
    } catch (err) {
      console.error('DIRECT LIGHTNINGCSS ERROR');
      console.error(err);
      if (err.stack) console.error(err.stack);
    }
    return transformer.transform(config, projectRoot, filePath, source, {
      type: 'sourceFile',
      platform: 'android',
      reactNativeCSS: {},
      customTransformOptions: { reactCompiler: false }
    });
  })
  .then((result) => {
    console.log('TRANSFORM RESULT');
    console.log(result.output[0].data ? Object.keys(result.output[0].data) : 'no data');
    if (result.output[0].data.css) {
      console.log('output css length', result.output[0].data.css.code.length);
    }
  })
  .catch((err) => {
    console.error('ERROR');
    console.error(err);
    if (err.stack) console.error(err.stack);
    process.exit(1);
  });
