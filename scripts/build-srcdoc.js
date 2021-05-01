const fs = require('fs');

let css = '';
try {
  css = fs.readFileSync('src/Builder/srcdoc/styles.css', 'utf-8');
} catch (e) {}
const html = fs.readFileSync('src/Builder/srcdoc/index.html', 'utf-8');

fs.writeFileSync(
  'src/Builder/srcdoc/index.js',
  `export default ${JSON.stringify(html.replace('/* STYLES */', css))};`,
);
