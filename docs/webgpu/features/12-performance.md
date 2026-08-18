# F12 — Performance and release gate

| Field      | Value      |
| ---------- | ---------- |
| Model      | Sol        |
| Reasoning  | Extra High |
| Depends on | F11        |

## Outcome

Set the release thresholds, measure representative large clouds, and optimize until they pass.

## Required first step

Before optimization, derive and record numeric pass/fail thresholds from F03's upgraded WebGL
baseline for each supported device class and renderer lane. F01 supplies the harness and scenario,
not the authoritative measurements. Include frame/update time, memory, visible points/nodes, draw
calls, stationary upload/allocation limits, and picking latency. Do not adjust thresholds merely to
match an implementation result.

## Measure

- CPU visibility/update time and render submission time.
- GPU frame time where available.
- Draw calls, visible nodes, and visible points.
- Decoded CPU memory, wrapper memory, and estimated GPU memory.
- Visible-node upload size/frequency and stationary-camera churn.
- Pipeline compilation/bind-group churn and async-picking latency.

Compare native WebGPU and `WebGPURenderer` fallback with a current-commit `WebGLRenderer` run using
the same F01 fixture, camera path, viewport, browser, and device class. Use the F03 baseline to detect
regression and establish thresholds; do not compare different Three.js versions as if the renderer
backend were the only variable.

## Method

- Use the benchmark command and warm-up policy established by F01/F03.
- Record sample count, median, p95, variance, and cold/warm pipeline results.
- Use GPU timestamps only where supported and label estimates separately from measured values.
- Treat missing native WebGPU as an unsupported device row, never as a passing native-WebGPU test on
  a device class declared supported.
- Store the threshold matrix and raw summarized results under `docs/webgpu/evidence/`; keep only the
  link and decisions in this file.

## Allowed optimizations

- Storage buffers for visible-node data.
- Indexed metadata in place of object references.
- Draw consolidation or indirect drawing.
- Pooled attribute wrappers/targets and compatible cross-cloud pipeline caches.
- Reduced quad overdraw without visible behavior changes.

Keep changes behind adapters/accessors; do not change loaders or public appearance semantics.

## Acceptance

- Every supported row passes the predeclared numeric thresholds.
- No unbounded allocation/upload occurs with a stationary camera.
- LRU and cloud disposal release backend resources.
- Performance remains bounded as visible octree-node count rises.
- Results include commit, fixture, browser/backend, OS, device class, point/node counts, viewport,
  pixel ratio, and run variance.

## Verify

Run the shared checks, complete browser suite, and the unified renderer benchmark command/matrix
recorded by F03.

## Start in

- F01 benchmark harness and scenarios
- [F03 recorded benchmark baseline](03-threejs-upgrade.md#recorded-decisions)
- `src/rendering/webgpu/`
- `src/rendering/webgl/`
- `src/utils/lru.ts`

## Threshold record

- Matrix/evidence path:
- Supported device classes:
- Benchmark command and warm-up/sample policy:
- Approved thresholds:

## Completion record

- Commit/status:
- Delivered paths:
- Decisions for later features:
- Verification:
- Evidence:
