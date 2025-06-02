#!/bin/bash

# Run benchmarks with vscode mock
NODE_OPTIONS="-r ./test/benchmarks/setup-mock.js" tsx test/benchmarks/run-benchmarks.ts