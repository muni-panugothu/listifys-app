const path = require('path');
const { transformPostCssModule } = require('./node_modules/expo/node_modules/@expo/metro-config/build/transform-worker/postcss');
const fs = require('fs');
const projectRoot = process.cwd();
const css = fs.readFileSync('global.css', 'utf8');
transformPostCssModule(projectRoot, { src: css, filename: path.join(projectRoot,'global.css') })
  .then(res => {
    console.log('SUCCESS');
    console.log(res.src.slice(0,200));
  })
  .catch(err => { console.error(err); process.exit(1); });
