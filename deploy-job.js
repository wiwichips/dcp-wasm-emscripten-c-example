#!/usr/bin/env node
const fs = require("fs");

async function main() {
  // initialize dcp module
  await require('dcp-client').init(new URL('https://scheduler.distributed.computer'));
  const compute = require('dcp/compute');
  const wallet = require('dcp/wallet');

  // read the wasmBinary
  const wasmBinary = fs.readFileSync("./square.wasm");

  // create the job, pass in data, JS wrapper, and WASM binary as the third argument
  const job = compute.for(
    [1, 2, 3, 4, 5, 6], 
    async (datum, code) => {
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
    [ new Uint8Array(wasmBinary) ],
  );

  // set keystore - usually loads ~/.dcp/default.keystore
  const ks = await wallet.get();
  job.setPaymentAccountKeystore(ks);

  // print job status
  job.on('readystatechange', console.log);
  job.on('result', console.log);

  // compute it and print the results
  const results = await job.exec(compute.marketValue);
  console.log('results=', Array.from(results));
}

main();

