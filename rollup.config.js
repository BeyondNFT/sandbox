import svelte from 'rollup-plugin-svelte';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import livereload from 'rollup-plugin-livereload';
import { terser } from 'rollup-plugin-terser';
import pkg from './package.json';

const name = pkg.name;

const production = !process.env.ROLLUP_WATCH;

function serve() {
  let server;

  function toExit() {
    if (server) server.kill(0);
  }

  return {
    writeBundle() {
      if (server) return;
      server = require('child_process').spawn(
        'npm',
        ['run', 'start', '--', '--dev'],
        {
          stdio: ['ignore', 'inherit', 'inherit'],
          shell: true,
        }
      );

      process.on('SIGTERM', toExit);
      process.on('exit', toExit);
    },
  };
}
const output = [
  { file: 'dist/' + pkg.module, format: 'es' },
  { file: 'dist/' + pkg.main, format: 'umd', name },
];

if (!production) {
  output.push({ file: 'public/dist/' + pkg.module, format: 'es' });
} else {
  output.push(
    {
      file: 'dist/' + pkg.module.replace('.js', '.min.js'),
      format: 'es',
      plugins: [production && terser()],
    },
    {
      file: 'dist/' + pkg.main.replace('.js', '.min.js'),
      format: 'umd',
      name,
      plugins: [production && terser()],
    }
  );
}
export default {
  input: 'src/main.js',
  output,
  plugins: [
    svelte({
      // enable run-time checks when not in production
      dev: !production,
      // we'll extract any component CSS out into
      // a separate file - better for performance
    }),

    // If you have external dependencies installed from
    // npm, you'll most likely need these plugins. In
    // some cases you'll need additional configuration -
    // consult the documentation for details:
    // https://github.com/rollup/plugins/tree/master/packages/commonjs
    resolve({
      browser: true,
      dedupe: ['svelte'],
    }),
    commonjs(),

    // In dev mode, call `npm run start` once
    // the bundle has been generated
    !production && serve(),

    // Watch the `public` directory and refresh the
    // browser on changes when not in production
    !production && livereload('public'),
  ],
  watch: {
    clearScreen: false,
  },
};
