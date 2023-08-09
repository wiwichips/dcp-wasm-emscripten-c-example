#include <emscripten.h>

EMSCRIPTEN_KEEPALIVE
int square(int number) {
    return number * number;
}

