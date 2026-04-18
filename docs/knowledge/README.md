# Knowledge base — 3D stack

Local LLM-readable documentation for the libraries this project uses
(`@react-three/fiber`, `@react-three/drei`, `three`). Each `llms.txt` is a
short index; each `llms-full.txt` is the full inline reference.

When working on 3D code, **read these files instead of guessing or hitting the
network** — they are kept in-tree so they're always available offline and pinned
to a known revision.

## Layout

| Path                          | Source                                  | Notes                                |
| ----------------------------- | --------------------------------------- | ------------------------------------ |
| `r3f/llms.txt`                | https://r3f.docs.pmnd.rs/llms.txt       | R3F doc index                        |
| `r3f/llms-full.txt`           | https://r3f.docs.pmnd.rs/llms-full.txt  | R3F full inline docs (~143 KB)       |
| `drei/llms.txt`               | https://drei.docs.pmnd.rs/llms.txt      | Drei doc index                       |
| `drei/llms-full.txt`          | https://drei.docs.pmnd.rs/llms-full.txt | Drei full inline docs (~201 KB)      |
| `three/llms-root.txt`         | https://threejs.org/llms.txt            | Pointer file from threejs.org root   |
| `three/llms.txt`              | https://threejs.org/docs/llms.txt       | three.js doc index                   |
| `three/llms-full.txt`         | https://threejs.org/docs/llms-full.txt  | three.js full inline docs (~126 KB)  |

## How to use this from Claude

1. Start with the relevant `llms.txt` to find the right section.
2. Open `llms-full.txt` and grep for the API name (e.g. `useFrame`,
   `<Float`, `MeshStandardMaterial`).
3. Prefer this over `context7` / WebSearch for these three libraries — it's
   already on disk.

## Refreshing

```bash
cd docs/knowledge
curl -fsSL -o r3f/llms.txt          https://r3f.docs.pmnd.rs/llms.txt
curl -fsSL -o r3f/llms-full.txt     https://r3f.docs.pmnd.rs/llms-full.txt
curl -fsSL -o drei/llms.txt         https://drei.docs.pmnd.rs/llms.txt
curl -fsSL -o drei/llms-full.txt    https://drei.docs.pmnd.rs/llms-full.txt
curl -fsSL -o three/llms-root.txt   https://threejs.org/llms.txt
curl -fsSL -o three/llms.txt        https://threejs.org/docs/llms.txt
curl -fsSL -o three/llms-full.txt   https://threejs.org/docs/llms-full.txt
```

Last refreshed: 2026-04-17.
