.PHONY: image build
IMAGE_NAME = js_wasm_component_builder

DOCKER_RUN = docker run --rm \
  -a STDOUT \
  -a STDERR \
  -v $(PWD):/app \
  -w /app $(IMAGE_NAME)

DOCKER_LOCAL = docker run --rm -it \
	-v $(PWD):/app \
	-w /app $(IMAGE_NAME) /bin/bash

build:
	@${DOCKER_RUN} npm run build

srv:
	wasmtime serve dist/jsproxy.wasm

local:
	@${DOCKER_LOCAL}

image:
	@cp $(SSL_CERT_FILE) ./root_cert.pem
	docker build --build-arg ROOT_CERT=root_cert.pem -t $(IMAGE_NAME) .