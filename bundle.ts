import { promises as fs } from 'fs';

// https://bun.sh/docs/bundler
let build = await Bun.build({
    entrypoints: ['./index.ts'],
    outdir: './dist',
    minify: false,
    format: 'esm',
    sourcemap: 'none',
    external: [
      'wasi:http/types@0.2.0',
      'wasi:keyvalue/store@0.2.0-draft',
    ],
});
if (!build.success) {
    console.error(build);
    process.exit(1);
}