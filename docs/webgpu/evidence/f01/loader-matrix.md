# F01 loader and encoding matrix

All fixtures are deterministic and repository-local. Wire-record and decoder-protocol fixtures are
in `test/unit/webgl-loader-characterization.test.ts`; shared render layouts are in
`test/webgl/fixtures/point-layouts.ts`. The browser suite renders the RGB and RGBA equivalence
classes at a fixed 160×160 viewport with a fixed orthographic camera, associates every non-splat
matrix row with that expected result, and separately asserts the current covariance-to-splat-mesh
route. This is deliberately a smoke suite; it uses no production URL or timing-sensitive fetch.

| Fixture | Current loader path | Layout characterized | Coverage |
| --- | --- | --- | --- |
| `v1-bin` | `BinaryLoader` / binary worker | `position`, normalized RGB `color`, normal, intensity, classification, indices | Direct binary-worker record decode plus RGB render result |
| `v1-las` | `LasLazLoader` / LAS decoder worker | `position`, normalized RGBA `color`, intensity, classification, returns, source ID, indices | Direct LAS point-record decode plus RGBA render result |
| `v1-laz` | `LasLazLoader` / LAZ worker then LAS decoder worker | Same decoded `BufferGeometry` layout as LAS | Equivalent to `v1-las` |
| `v2-default` | `Decoder` / decoder worker | `position`, normalized `rgba`, normal, indices, Potree metadata attributes | Direct decoder-protocol result plus RGBA render result |
| `v2-brotli` | `BrotliDecoder` / Brotli worker | Same decoded layout contract as DEFAULT | Equivalent to `v2-default` |
| `v2-gltf-points` | `GltfDecoder` / GLTF worker | `position`, normalized `rgba`, normal, indices, metadata attributes | Equivalent to `v2-default` for point rendering |
| `v2-gltf-splats` | `GltfSplatDecoder` / splat worker | `centers`, raw position, scale, orientation, `COVARIANCE*`, packed color | Direct distinct decoder-protocol result plus current WebGL splat-mesh route assertion |

The equivalence claims are source-backed, not guesses: `Decoder.readSuccessMessage` and
`GltfDecoder.decode` both create the same named Three.js attributes; BROTLI passes through the same
geometry result contract as DEFAULT; LAS and LAZ both enter `LasLazLoader.parseBufferAttributes`.
Splat data is intentionally not equated with point data.

The repository does not distribute a compressed LAZ payload. This is not an F01 gap: LAZ's
decompressor supplies LAS point records to the same production `readUsingDataView` decoder that the
direct LAS test executes, so F01 records decoded-layout equivalence as its acceptance criteria
permit. A future test of the third-party decompressor itself would require a redistributable LAZ
file, but it would not add a distinct rendering expectation.
