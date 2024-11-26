# FROM node:23-alpine
FROM node:23-bookworm

RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y 

RUN curl https://wasmtime.dev/install.sh -sSf -k | bash

ENV PATH="/root/.wasmtime/bin:${PATH}"

WORKDIR /app