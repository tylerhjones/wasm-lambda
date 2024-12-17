import {
  IncomingRequest,
  ResponseOutparam,
  OutgoingBody,
  OutgoingResponse,
  Fields,
} from 'wasi:http/types@0.2.0';

// NOTE: unfortunately until https://github.com/bytecodealliance/jco/pull/528 is released
// we are misusing types that were intended for jco host plugins
//
// In the future we can generate our types with `jco guest-types` and get more ergonomic
// declaration files that don't need to be treated this way.
import * as WasiKeyvalueStore from 'wasi:keyvalue/store@0.2.0-draft';

async function innerHandler(_req: IncomingRequest): Promise<{ statusCode: number, body: string }> {
  try {
    console.log('Opening keyvalue store');
    WasiKeyvalueStore.open('my-state');
    console.log('keyvalue store opened');
    return {
      statusCode: 200,
      body: 'Hello, keyvalue world!',
    }
  } catch (e) {
    return {
      statusCode: 500,
      body: e.toString(),
    };
  }
}

async function handle(req: IncomingRequest, resp: ResponseOutparam) {
  const res = await innerHandler(req);

  const outgoingResponse = new OutgoingResponse(new Fields());

  // Access the outgoing response body
  let outgoingBody = outgoingResponse.body();
  {
    // Create a stream for the response body
    let outputStream = outgoingBody.write();
    // Write hello world to the response stream
    outputStream.blockingWriteAndFlush(
      new Uint8Array(new TextEncoder().encode(res.body))
    );
    // @ts-ignore: This is required in order to dispose the stream before we return
    outputStream[Symbol.dispose]();
  }

  // Set the status code for the response
  outgoingResponse.setStatusCode(res.statusCode);
  // Finish the response body
  OutgoingBody.finish(outgoingBody, undefined);
  // Set the created response
  ResponseOutparam.set(resp, { tag: 'ok', val: outgoingResponse });
}

export const incomingHandler = {
  handle,
};
