FROM node:22-bookworm


# Setup Rust and Wasmtime
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y 
RUN curl https://wasmtime.dev/install.sh -sSf -k | bash
ENV PATH="/root/.wasmtime/bin:${PATH}"
ENV PATH="/root/.cargo/bin:${PATH}"

# Setup tools
# RUN cargo install wkg
# RUN cargo install wasm-tools

WORKDIR /app