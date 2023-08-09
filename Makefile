all:
	emcc square.c -s WASM=1 -s SIDE_MODULE=1 -o square.wasm
