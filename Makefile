.PHONY: image build
IMAGE_NAME = js_wasm_component_builder

DOCKER_RUN = docker run --rm \
  -a STDOUT \
  -a STDERR \
  -v $(PWD):/app \
  -v $(PWD)/./wasi-http/wit:/wit \
  -w /app $(IMAGE_NAME)

DOCKER_LOCAL = docker run --rm -it \
	-v $(PWD):/app \
	-v $(PWD)/./wasi-http/wit:/wit \
	-w /app $(IMAGE_NAME) /bin/bash

build:
	@${DOCKER_RUN} jco componentize \
          dist/index.js \
          --wit /wit \
          --world-name proxy \
          --out jsproxy.wasm \
          --disable all

srv:
	wasmtime serve dist/jsproxy.wasm

types:
	@${DOCKER_RUN} jco types /wit -o dist/types --world-name proxy

transpile:
	@${DOCKER_RUN} jco transpile jsproxy.wasm -o dist/transpiled

local:
	@${DOCKER_LOCAL}

image:
	docker build -t $(IMAGE_NAME) .

test: build srv
	@echo "Testing..."