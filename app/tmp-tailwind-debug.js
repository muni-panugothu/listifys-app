const fs = require('fs');
const postcss = require('postcss');
const tailwind = require('@tailwindcss/postcss');
const autoprefixer = require('autoprefixer');
const css = fs.readFileSync('global.css', 'utf8');
postcss([tailwind(), autoprefixer()]).process(css, {from:'global.css'})
  .then(res => {
    console.log('SUCCESS');
    console.log(res.css.slice(0,200));
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
