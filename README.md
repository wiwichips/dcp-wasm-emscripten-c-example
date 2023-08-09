
# DCP Emscripten Example
This repo contains a simple example demonstrating how to compile a C library to WebAssembly using Emscripten and then calling functions from that C library in a DCP work function.

This example does not use the package manager for handling WebAssembly code and instead passes it in the `args` parameter.

This repository will contains a few important files we'll use:
```
.
├── deploy-job.js
├── Makefile
├── package.json
├── package-lock.json
├── README.md
└── square.c
```

## Compiling a C library using Emscripten
### C file
We'll compile a simple C file that contains a function for squaring numbers:
```c
#include <emscripten.h>

EMSCRIPTEN_KEEPALIVE
int square(int number) {
    return number * number;
}
```
- Note: We'll need to include the `emscripten.h` library.
- Note: We'll need to add the `EMSCRIPTEN_KEEPALIVE` macro before each of the function definitions we need as part of the API we'd like our WebAssembly module to export. This is required so that the compiler doesn't think our function is dead code and removes it during optimization. 

### Setup
Follow the instructions here for setting up Emscripten: https://emscripten.org/docs/getting_started/downloads.html .

### Compiling a C file
Compile a C file using Emscripten's `emcc` compiler program. Here, we'll compile the `square.c` file 
```
$ emcc square.c -s WASM=1 -s SIDE_MODULE=1 -o square.wasm
```
This will output a file called `square.wasm`.

For more advanced use cases involving other options or multiple files, refer to the [Emscripten documentation](https://emscripten.org/docs/index.html). This example just coveres compiling a single file to WebAssembly.

## Deploying a Work Function to DCP that uses WebAssembly
Now that we've compiled our C code to WebAssembly, we'll pass it to our job and call it from within our work function.

Refer to the `deploy-job.js` file for the full example. 

### Work Function
First, define a workFunction that instantiates a WebAssembly module from the second parameter to the work function.

```javascript
async workFunction (datum, code) {
  progress(0);

  // specify an environment for the WASM to run in
  const importObject = {
    'env': {
      '__memory_base': 0,
      '__table_base': 0,
      'memory': new WebAssembly.Memory({ initial: 256, maximum: 256 }),
      'table': new WebAssembly.Table({ initial: 0, maximum: 0, element: "anyfunc" }),
      '__indirect_function_table': new WebAssembly.Table({ initial: 0, maximum: 0, element: "anyfunc" }),
      '__stack_pointer': new WebAssembly.Global({ value: "i32", mutable: true }, 8192),
    }
  }

  // instantiate the webassembly binary
  const wasmModule = await WebAssembly.instantiate(code, importObject)

  // execute the "square" function from C
  return wasmModule.instance.exports.square(datum);
},
```

This work function instantiates a new WebAssembly module from a Uint8Array passed as the second parameter (called "code" here). We also specify an `importObject` which specifies the WebAssembly environment. Refer to the [MDN docs for more information on using the WebAssembly.instantiate api](https://developer.mozilla.org/en-US/docs/WebAssembly/JavaScript_interface/instantiate).

### Job Deployment Code
Now that we have a work function defined, we'll create a job that passes in our WebAssembly code as the "arguments" parameter. For more information on `compute.for` and the arguments parameter,[refer to the docs](https://docs.dcp.dev/api/compute/functions/for.html).

```javascript
// initialize dcp module
const compute = require('dcp/compute');
const wallet = require('dcp/wallet');

// read the wasmBinary
const wasmBinary = fs.readFileSync("./square.wasm");

// create the job, pass in data, JS wrapper, and WASM binary as the third argument
const job = compute.for(
  [1, 2, 3, 4, 5, 6], 
  workFunction,
  [ new Uint8Array(wasmBinary) ],
);

// set keystore - usually loads ~/.dcp/default.keystore
const ks = await wallet.get();
job.setPaymentAccountKeystore(ks);

// compute it and print the results
const results = await job.exec(compute.marketValue);
console.log('results=', Array.from(results));
```
In this code, we read in the `square.wasm` we created using `fs.readFileSync` , then we convert it to a Uint8Array and pass it within an array as the final parameter to the `compute.for` function. This means it will be available as the second argument to the work function.

Running it will output:
```
results= [ 1, 4, 9, 16, 25, 36 ]
```


Note: This example uses Node.js to deploy the work function; however, when PythonMonkey supports dcp-client, the following will [look very similar in Python](https://github.com/wiwichips/pythonmonkey-emscripten-example). 

