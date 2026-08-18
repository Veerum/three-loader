# F13 — Prepare WebGPU release

| Field      | Value |
| ---------- | ----- |
| Model      | Terra |
| Reasoning  | High  |
| Depends on | F12   |

## Outcome

Turn the private, performance-qualified implementation into a reviewable release candidate. Do not
publish from this task.

## Deliverables

- Add the WebGPU capability, supported matrix, initialization, fallback, splat rejection, and known
  exclusions to `README.md`.
- Update examples to configure supported behavior through `pco.appearance`.
- Update `CHANGELOG.md` with the feature, intentional API changes, migration notes, and deprecations.
- Review public exports and declarations; expose WebGPU support only now.
- Publicly expose the F03-tested ESM-only WebGPU entry while retaining the WebGL-usable CommonJS root.
  Document that fully dropping CommonJS is a separate post-MVP decision.
- Confirm package/peer ranges match F03 and no duplicate Three.js runtime is packed.
- Record F12 thresholds/results and the supported browser/device policy in release documentation.
- Prepare the version/release metadata required by the repository workflow without publishing.
- Choose and record the release version based on the final public API changes, including appearance,
  constructor configuration, async picking, and callback migration.

## Acceptance

- A consumer can initialize either renderer family from the public documentation.
- Packed consumer tests pass for root ESM, root CommonJS/WebGL, and the WebGPU ESM entry without an
  embedded or duplicate Three.js runtime.
- Every intentional public API change has a migration entry.
- Examples use no supported behavior through direct native-material mutation.
- Packed contents include required declarations/assets and exclude fixtures/benchmark artifacts.
- All F01–F12 acceptance criteria remain green on the release commit.

## Verify

Run all shared/browser/benchmark checks plus:

```sh
npm pack --dry-run
```

## Start in

- [F03 packaging decisions](03-threejs-upgrade.md#recorded-decisions)
- [F12 threshold record](12-performance.md#threshold-record)
- `README.md`
- `CHANGELOG.md`
- `package.json`
- `src/index.ts`
- `example/`
- Build/package configuration

## Completion record

- Commit/status:
- Delivered paths:
- Decisions for later features:
- Verification:
- Evidence:
