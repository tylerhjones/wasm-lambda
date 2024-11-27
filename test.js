import { spawn } from 'node:child_process';
import fetch from 'node-fetch';

async function serve(callback) {
  const child = spawn('wasmtime',
    ['serve', '-S', 'common', 'dist/component.wasm'],
    {
      shell: false,
      stdio: ['inherit', 'pipe', 'pipe']
    });
  
  const captureOutput = (data) => {
    const output = data.toString();
    process.stdout.write(output); // Echo the output to the console
    if (output.includes('Serving HTTP on')) {
      const baseUrl = output.split('on ')[1]
      callback(baseUrl);
    }
  }

  child.stdout.on('data', captureOutput);
  child.stderr.on('data', captureOutput);

  child.on('exit', process.exit);

  child.on('message', (msg) => {
    console.log('Server child msg:', msg);
  });

  return child;
}

async function doTest() {
  const child = await serve((baseUrl) => {
    // Fetch the page when the server is ready
    fetch(baseUrl)
      .then((response) => response.text())
      .then((data) => {
        console.log(data);
      })
      .catch((error) => {
        console.error(error);
      })
      .finally(() => {
        child.kill('SIGTERM');
      });
  });
}

doTest().catch(console.error);
