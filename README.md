# C.JS

JavaScript is a relatively safe language with automatic memory management, garbage collection and no direct pointer manipulation. After careful consideration, I've decided these are problems worth solving. C.JS brings back the inconvenience of C without any of its performance benefits.

## Features

- Manual memory management

- Pointers

- Pointers to pointers

- Pointer arithmetic

- Pointer casting

- Structs and memory alignment

- Null-terminated strings

- Memory leaks

- Segmentation faults (simulated, unfortunately) with a GDB-style backtrace, virtual registers, heap maps and hex dumps

- Use-after-free

- `malloc`, `calloc`, `realloc`, `free`, `sizeof`, `strlen`, `memcpy`

- Actual JavaScript stack traces, for when one language is not enough

## Installation

Requires Node.js 18 or newer.

```
node demo.js
node demo.js --crash
```

The first command catches a deliberate use-after-free, prints the fault report and cleans up. The second leaves it uncaught and sets exit status 139 (simulated SIGSEGV). Invalid frees and allocation exhaustion produce simulated SIGABRT reports with exit status 134 when the optional crash handler is installed.

## Implementation

Memory is backed by `ArrayBuffer` and accessed through `DataView`.

- `get()` reads from a pointer.

- `set()` writes to a pointer.

- `add(n)` performs pointer arithmetic.

- `cast(type)` reinterprets a pointer's type.

Addresses are 32-bit heap offsets rather than native memory addresses. Freed addresses can be reused, and stored pointers lose their allocation provenance.

Memory faults produce C-style diagnostics, including hexadecimal memory dumps, virtual registers, allocation maps and GDB-style backtraces derived from actual JavaScript stack frames.

The library exports:

- `CJSFault` for memory-related exceptions.

- `hexdump(heap, address)` for inspecting memory.

- `installCrashHandler()` for optional C-style crash handling.

Ordinary JavaScript errors remain unaffected. OS signals, CPU registers and native core dumps are simulated.

Unfortunately, JavaScript still refuses to actually segfault.

## Dependencies

None. Nobody else should be held responsible.

## Performance

The disadvantages of C with the performance of JavaScript.

## Production readiness

Haha, sometimes

## Why?

There was nothing stopping me.
