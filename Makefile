.PHONY: image build
RUNTIME_IMAGE = wasm_lambda
IMAGE_NAME = js_wasm_component_builder

DOCKER_RUN = docker run --rm \
  -a STDOUT \
  -a STDERR \
  -v $(PWD):/app \
  -w /app $(IMAGE_NAME)

DOCKER_LOCAL = docker run --rm -it \
	-v $(PWD):/app \
	-w /app $(IMAGE_NAME) /bin/bash

up:
	docker compose up

local:
	@${DOCKER_LOCAL}

runtime: image
	docker build -t $(RUNTIME_IMAGE) -f Dockerfile.runtime .

exec:
	@docker exec -it wasm-lambda-lamb-1 /bin/bash

build:
	@${DOCKER_RUN} npm run build

image:
	@cp $(SSL_CERT_FILE) ./root_cert.pem
	docker build --build-arg ROOT_CERT=root_cert.pem -t $(IMAGE_NAME) .