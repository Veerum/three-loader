# F01 WebGL benchmark harness

`npm run benchmark:webgl -- --smoke` runs the same fixed-camera browser scenario as the render
suite and emits JSON prefixed `F01_WEBGL_BENCHMARK_SMOKE=`. Its fields are environment metadata
(browser, masked/unmasked GPU vendor and renderer, WebGL/GLSL version, viewport and pixel ratio),
measured frame/update/render time, actual renderer draw calls and points, nodes, explicitly tracked
source allocations, Three.js renderer memory, intercepted initial/steady-state `bufferData` upload
counts and bytes, source-array memory estimate, and measured successful picking latency.

Smoke warm-up policy: the harness performs one unmeasured render before the measured frame loop.
That render compiles the scenario and records initial `bufferData` uploads; renderer counters and
steady-state upload counters are then reset before the measured frames. Smoke mode uses three
measured frames. F03 must define the authoritative sample count, repetition, cold/warm split, and
aggregation policy when it records the upgraded-WebGL baseline.

The smoke mode is a harness validation only. It constructs no release threshold and is explicitly
marked `authoritativeBaseline: false`; F03 owns the authoritative upgraded-WebGL measurement.

Latest local smoke environment: Chromium 151 with SwiftShader through ANGLE / WebGL 2.0. The
deterministic three-point, one-node scenario reports one draw call per frame, ten initial attribute
uploads totaling 132 bytes, no steady-state uploads, a 132-byte source-array estimate, and a
successful real pick. Timing values are emitted for harness validation but are intentionally not
copied here or treated as stable measurements.
