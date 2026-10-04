# Hermes-VM als Kommandozeile, dieselbe Version wie in der App (react-native/sdks/.hermesv1version)
FROM debian:bookworm AS build
ARG HERMES_TAG=hermes-v250829098.0.17
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates git cmake ninja-build python3 clang libicu-dev \
 && rm -rf /var/lib/apt/lists/*
RUN git clone --depth 1 --branch $HERMES_TAG https://github.com/facebook/hermes.git /hermes
RUN cmake -S /hermes -B /out -G Ninja -DCMAKE_BUILD_TYPE=Release \
      -DCMAKE_C_COMPILER=clang -DCMAKE_CXX_COMPILER=clang++ \
 && cmake --build /out --target hermes hermesc

FROM node:22-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends libicu72 && rm -rf /var/lib/apt/lists/*
COPY --from=build /out/bin/hermes /out/bin/hermesc /usr/local/bin/
