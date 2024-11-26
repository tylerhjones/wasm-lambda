# TODO

- [x] update the docker image to include cargo and wasmtime so we can run the entire pipe in the container
- [] update makefile with test target that builds and runs curl against the wasm
- [] create objects that match the structure the wasmtime expects from the component

## Adv TODO

- [] add outgoing request to the js lambda
- [] demo stacktrace/error cases
- [] demo how to represent state between executions
- [] demo how to minify the component layers for a smaller base wasm (split the parts up)


# Setup

## Building the component's WIT

Given a [WebAssembly Interface Types ("WIT")][wit]-first workflow, to get started making a HTTP handler
component in WebAssembly requires creating a WIT contract to represent that component.

First we make a `wit` directory (by convention) and add a `component.wit` to it:

```wit
package experiments:wasm-lambda;

world component {
  export wasi:http/incoming-handler@0.2.0;
}
```

> [!NOTE]
> See [`wit/component.wit`](./wit/component.wit)
>
> For more information on the WIT syntax, see [WIT design docs][wit]

We make use of the [WebAssembly System Interface ("WASI") HTTP][wasi-http] interface here, pulling in
pre-established interfaces interfaces for serving *incoming* HTTP requests.

[wasi-http]: https://github.com/WebAssembly/wasi-http
[wit]: https://github.com/WebAssembly/component-model/blob/main/design/mvp/WIT.md

## Trying (and failing) to build JCO types from the WIT

Once we have what we *want* our component to look like we *would* normally be able to generate Typescript
types for it with `jco types`, so let's add a NPM script for that:

```diff
  "scripts": {
+    "generate:types": "jco types wit/ -o types/",
    "build:tsc": "tsc",
    "build:js": "jco componentize -w wasi-http/wit --world-name proxy -o dist/jsproxy.wasm dist/index.js",
```

Now that we have a script, we can try to generate the types, but they will fail:

```
$ pnpm generate:types

> js_wasm_lambda@1.0.0 generate:types /path/to/your/project/wasm-lambda
> jco types wit/ -o types/

(jco types) ComponentError: package not found
     --> /path/to/your/project/wasm-lambda/wit/component.wit:4:10
      |
    4 |   export wasi:http/incoming-handler@0.2.0;
      |          ^--------
    at generateTypes (file:///path/to/your/project/wasm-lambda/node_modules/.pnpm/@bytecodealliance+jco@1.8.1/node_modules/@bytecodealliance/jco/obj/js-component-bindgen-component.js:3894:11)
    at typesComponent (file:///path/to/your/project/wasm-lambda/node_modules/.pnpm/@bytecodealliance+jco@1.8.1/node_modules/@bytecodealliance/jco/src/cmd/transpile.js:54:29)
    at async types (file:///path/to/your/project/wasm-lambda/node_modules/.pnpm/@bytecodealliance+jco@1.8.1/node_modules/@bytecodealliance/jco/src/cmd/transpile.js:18:17)
    at async file:///path/to/your/project/wasm-lambda/node_modules/.pnpm/@bytecodealliance+jco@1.8.1/node_modules/@bytecodealliance/jco/src/jco.js:200:9
 ELIFECYCLE  Command failed with exit code 1.
```

The reason this fails is that while we're *creating* a new WIT interface, we're *referring* to one that doesn't exist locally,
simliar to trying to build OpenAPI or gRPC services without local schema/IDL files.

## Downloading the WIT interfaces we depend on

While it was easy to *write* the WIT above and *represent* our component's `world` -- we need to pull down
all the relevant WIT interfaces that `wasi:http` builds on.

To pull down WIT, we can use [`wkg`, from the `bytecodealliance/wasm-pkg-tools`][wkg].

Since WASI is a growing standard, and well integrated we can generally follow the error messages:

```console
wkg get wasi:random@0.2.0
wkg get wasi:cli@0.2.0
wkg get wasi:filesystem@0.2.0
wkg get wasi:sockets@0.2.0
```

This will add many WIT files to your local repository, but you can move/rename all the downloaded `*.wit` files
by making a folder named `deps` under `wit` and dropping them there.

```console
mkdir wit/deps
mv *.wit wit/deps
```

After doing this, running `jco types` (possible also via the node script) should work:

```
jco types wit/ -o types/


  Generated Type Files:

 - types/interfaces/wasi-clocks-monotonic-clock.d.ts  1.15 KiB
 - types/interfaces/wasi-http-incoming-handler.d.ts   0.88 KiB
 - types/interfaces/wasi-http-types.d.ts              24.1 KiB
 - types/interfaces/wasi-io-error.d.ts                0.41 KiB
 - types/interfaces/wasi-io-poll.d.ts                 1.33 KiB
 - types/interfaces/wasi-io-streams.d.ts              8.91 KiB
 - types/wit.d.ts                                     0.47 KiB
```

Note that while we're generating types to match the WIT interfaces, the *implementations* of those interfaces
are not bound yet, and likely will not be until runtime.

Feel free to look into the TS files and cross reference with the relevant WIT to get a feel for the interfaces
and the translation that has taken place.

[wkg]: https://github.com/bytecodealliance/wasm-pkg-tools

## Making importing our types seamless in Typescript

Now that we've generated a bunch of types that describe the WIT interfaces we're using, we
can use those types to make it easier to write code by hooking up imports.

At the JS level, we'll be expected to import `wasi:http/types@0.2.0`, since that is the name
of the interface that has relevant types (since we want to implement our export `wasi:http/incoming-handler`).

To make this work well in typescript, we (since `wasi:...` would normally not be a valid import),
we need to use `tsconfig.json`:

```diff
{
  "compilerOptions": {

    "target": "es2022",
    /* Modules */
    "module": "es2022",
+    "paths": {
+      "wasi:http/types@0.2.0": [ "./types/interfaces/wasi-http-types.d.ts" ]
+    },
```

Once we have this in, we can use imports like the following in our Typescript, which we'll need to
implement `wasi:http/incoming-handler`:

```ts
import {
  IncomingRequest,
  ResponseOutparam,
  OutgoingBody,
  OutgoingResponse,
  Fields,
} from 'wasi:http/types';
```

> [!NOTE]
> To get a feel for what these types mean/are, see the `wasi:http` WIT interface, or the generated types!

## Writing the implementation of the incoming handler interface

Since we don't *have* to use the provided types -- regular Javascript works just fine -- we can move on to
creating the Javascript code to fill out the handler:

```ts
import {
  IncomingRequest,
  ResponseOutparam,
  OutgoingBody,
  OutgoingResponse,
  Fields,
} from 'wasi:http/types';

function handle(req: IncomingRequest, resp: ResponseOutparam) {
  // Start building an outgoing response
  const outgoingResponse = new OutgoingResponse(new Fields());

  // Access the outgoing response body
  let outgoingBody = outgoingResponse.body();
  {
    // Create a stream for the response body
    let outputStream = outgoingBody.write();
    // Write hello world to the response stream
    outputStream.blockingWriteAndFlush(
      new Uint8Array(new TextEncoder().encode('Hello from Typescript!\n'))
    );
    // @ts-ignore: This is required in order to dispose the stream before we return
    outputStream[Symbol.dispose]();
  }

  // Set the status code for the response
  outgoingResponse.setStatusCode(200);
  // Finish the response body
  OutgoingBody.finish(outgoingBody, undefined);
  // Set the created response
  ResponseOutparam.set(resp, { tag: 'ok', val: outgoingResponse });
}

export const incomingHandler = {
  handle,
};
```

## Building our component

To turn our JS into a WebAssembly component, we must first turn our TS into JS:

```console
npx tsc
```

Then, we can turn the resulting Javascript into a WebAssembly component using `jco componentize`:

```console
jco componentize -w wit/ --world-name component -o dist/component.wasm dist/index.js
```

> [!NOTE]
> For ease, you can do all of this with `pnpm build` or `npm run build`, or your npm-compatible build tool of choice.

You should see output like the following:

```
➜ pnpm build

> js_wasm_lambda@1.0.0 build /path/to/your/project/wasm-lambda
> npm run build:tsc && npm run build:js


> js_wasm_lambda@1.0.0 build:tsc
> tsc


> js_wasm_lambda@1.0.0 build:js
> jco componentize -w wit/ --world-name component -o dist/component.wasm dist/index.js

OK Successfully written dist/component.wasm.
```

Now that your component has been built, we can do *alot* of things to inspect it. Here are a few:

```
➜ file dist/component.wasm
dist/component.wasm: WebAssembly (wasm) binary module version 0x1000d
```

[`wasm-tools`][wasm-tools] is a toolkit that has many utilities for working with WebAssembly:

```
➜ wasm-tools component wit dist/component.wasm
package root:component;

world root {
  import wasi:io/error@0.2.2;
  import wasi:io/poll@0.2.2;
  import wasi:io/streams@0.2.2;
  import wasi:cli/stdin@0.2.2;
  import wasi:cli/stdout@0.2.2;
  import wasi:cli/stderr@0.2.2;
  import wasi:cli/terminal-input@0.2.2;
  import wasi:cli/terminal-output@0.2.2;
  import wasi:cli/terminal-stdin@0.2.2;
  import wasi:cli/terminal-stdout@0.2.2;
  import wasi:cli/terminal-stderr@0.2.2;
  import wasi:clocks/monotonic-clock@0.2.2;
  import wasi:clocks/wall-clock@0.2.2;
  import wasi:filesystem/types@0.2.2;
  import wasi:filesystem/preopens@0.2.2;
  import wasi:random/random@0.2.2;
  import wasi:http/types@0.2.2;
  import wasi:http/outgoing-handler@0.2.2;

  export wasi:http/incoming-handler@0.2.0;
}

// ...(snip)...
// ...(snip)...

package wasi:http@0.2.0 {
  interface incoming-handler {
    use wasi:http/types@0.2.2.{incoming-request, response-outparam};

    handle: func(request: incoming-request, response-out: response-outparam);
  }
}
```

As you can see above, the `component wit` subcommand prints out the combined/merged WIT for the entire component.

You can also convert the WebAssembly binary to the [WebAssembly Text Format ("WAT")][wat] (which is extended via the [Component Model][cm]):

```console
wasm-tools print dist/component.wasm -o dist/component.wat
```

If you take a look at the WAT file, you'll see output like the following:

```wat
(component
  (type (;0;)
    (instance
      (export (;0;) "error" (type (sub resource)))
      (type (;1;) (borrow 0))
      (type (;2;) (func (param "self" 1) (result string)))
      (export (;0;) "[method]error.to-debug-string" (func (type 2)))
    )
  )
  (import "wasi:io/error@0.2.2" (instance (;0;) (type 0)))
  (type (;1;)
    (instance
      (export (;0;) "pollable" (type (sub resource)))
      (type (;1;) (borrow 0))
      (type (;2;) (func (param "self" 1) (result bool)))
      (export (;0;) "[method]pollable.ready" (func (type 2)))
      (type (;3;) (func (param "self" 1)))
      (export (;1;) "[method]pollable.block" (func (type 3)))
      (type (;4;) (list 1))
      (type (;5;) (list u32))
      (type (;6;) (func (param "in" 4) (result 5)))
      (export (;2;) "poll" (func (type 6)))
    )
  )
  (import "wasi:io/poll@0.2.2" (instance (;1;) (type 1)))
  (alias export 0 "error" (type (;2;)))

....(snip)....

  (export (;19;) "wasi:http/incoming-handler@0.2.0" (instance 18))
  (@producers
    (processed-by "wit-component" "0.219.1")
    (processed-by "ComponentizeJS" "0.14.0")
    (language "JavaScript" "")
  )
)
```

[wasm-tools]: https://github.com/bytecodealliance/wasm-tools
[wat]: https://developer.mozilla.org/en-US/docs/WebAssembly/Understanding_the_text_format
[cm]: https://github.com/WebAssembly/component-model/blob/main/design/mvp/Explainer.md

## Running the component our component and serving requests

To run the component and serve requests we can either use `jco` or `wasmtime`:

```console
$ jco serve dist/compnent.wasm
Server listening on 8000...
```

Similarly you can also use `wasmtime`:

```
$ wasmtime serve -S common dist/component.wasm
Serving HTTP on http://0.0.0.0:8080/
```

With either approach, you can use `curl` the appropriate URL to trigger your WebAssembly component.

> [!NOTE]
> The implementations of `jco serve` and `wasmtime serve` are what actually *fulfill* all the imports
> of your component (see combined/merged `world root` above), and use the `wasi:http/incoming-handler` *export*
> to make web serving actually happen.
