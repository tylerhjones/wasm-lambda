# TODO

- [x] update the docker image to include cargo and wasmtime so we can run the entire pipe in the container
- [] update makefile with test target that builds and runs curl against the wasm
- [] create objects that match the structure the wasmtime expects from the component

## Adv TODO

- [] add outgoing request to the js lambda
- [] demo stacktrace/error cases
- [] demo how to represent state between executions
- [] demo how to minify the component layers for a smaller base wasm (split the parts up)

