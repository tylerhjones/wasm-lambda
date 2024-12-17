import { spawn } from 'node:child_process';
import fetch from 'node-fetch';

function startChildProcess(command, args, condition) {
  console.log(`Starting ${command} ${args.join(' ')}`);
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      shell: false,
      stdio: ['inherit', 'pipe', 'pipe']
    });
  
    const captureOutput = (data) => {
      const output = data.toString();
      process.stdout.write(output); // Echo the output to the console
      if (output.includes(condition)) {
        resolve(child);
      }
    }
    child.stdout.on('data', captureOutput);
    child.stderr.on('data', captureOutput);
    child.on('exit', process.exit);
  })
}

function spawnWasm(port) {
  return startChildProcess('wasmtime',
    ['serve', '-S', 'common', '-S', 'keyvalue', '--addr', `0.0.0.0:${port}`, 'dist/component.wasm'],
    'Serving HTTP on');
}

async function doReq(baseUrl) {
  return fetch(baseUrl + 'foo?bar=baz')
  .then((response) => response.text())
  .then((data) => {
    console.log(data);
  })
  .catch((error) => {
    console.error(error);
  })
}

async function doTest() {
  const wasmtime = await spawnWasm(8080);
  try {
    await doReq(`http://localhost:8080/`);
  } finally {
    wasmtime.kill('SIGTERM');
  }
}

doTest().catch(console.error);
