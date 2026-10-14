# Typecheck and TanStack Start upgrade measurements

Measured 2026-10-14 on the same shared Linux machine (4 logical CPUs), with Bun 1.4.3, Node v24.21.0, and Vite 8.1.5.

## Results

Medians of three measured runs after one unmeasured warmup per case. Timing includes process startup. Memory is Linux peak RSS from `wait4`, reported in MiB; for a command with children it is the maximum process RSS, not the sum of simultaneously live processes.

| Upgrade / metric      | Before     | After      | Observed change               |
| --------------------- | ---------- | ---------- | ----------------------------- |
| Typecheck time        | 23.51 s    | 1.96 s     | 12.0× faster; 91.6% less time |
| Typecheck peak RSS    | 1094.9 MiB | 437.5 MiB  | 60.0% less                    |
| Start full build time | 13.19 s    | 17.16 s    | 30.0% more time               |
| Start build peak RSS  | 1082.1 MiB | 1064.5 MiB | 1.6% less                     |

## Raw measured runs

| Case                            | Wall time, seconds (runs 1–3) | Peak RSS, MiB (runs 1–3) |
| ------------------------------- | ----------------------------- | ------------------------ |
| TypeScript 6.0.3 `tsc --noEmit` | 16.15, 23.51, 28.23           | 1094.4, 1094.9, 1097.4   |
| Bun 1.4.3 `bun check`           | 1.96, 1.96, 2.89              | 442.3, 437.5, 427.1      |
| Start 1.168.32 `bun run build`  | 8.57, 13.19, 18.65            | 1082.1, 1093.3, 1069.3   |
| Start 1.169.1 `bun run build`   | 15.70, 17.16, 24.23           | 1083.8, 1064.5, 1054.3   |

The shared host was running other work. The wide ranges, particularly for builds, limit conclusions about the exact speed difference. These are local measurements, not isolated performance claims. Build time does not measure page latency, hydration speed, or server throughput.

## Build output

These sizes were identical across the three measured runs of each version. Both builds emitted 17 client JavaScript chunks. Gzip is the sum of each chunk compressed independently at level 9.

| Output              | Before          | After           | Observed change |
| ------------------- | --------------- | --------------- | --------------- |
| All client JS, raw  | 1,838,116 bytes | 1,833,207 bytes | -0.3%           |
| All client JS, gzip | 540,622 bytes   | 540,189 bytes   | -0.1%           |
| Server output, raw  | 5,145,400 bytes | 5,303,563 bytes | +3.1%           |

All client chunks includes lazily loaded code; it is not the initial page payload.

## Method

- Both snapshots used the tracked source and configuration from baseline `f6a7ac0`. The after snapshot used this branch's updated `package.json` and `bun.lock`. Dependencies were installed separately using `bun install --frozen-lockfile`.
- The Start comparison includes the complete dependency upgrade: Start 1.168.32 → 1.169.1 and its aligned Router, SSR integration, Query, and devtools packages. It does not isolate the Start package alone.
- Both typecheck commands ran against the **same after snapshot and dependencies**, so this comparison isolates the checker replacement. The old checker was `node node_modules/typescript/bin/tsc --noEmit`; the new checker was `bun check`, which checked 150 project files with the existing `tsconfig.json`.
- Ran each pair serially. Measured order: before/after, after/before, before/after. Dependency installation and output cleanup were outside the timing.
- Before each full build, removed `.output` and `node_modules/.nitro`. The operating-system file cache was warm. No incremental typecheck cache was used.
- Both snapshots linked the same main-checkout env file; it was not changed. Measured commands all exited successfully.
- [Bun's documentation](https://bun.com/docs/runtime/check) specifies `bun check` as the replacement for `tsc --noEmit`. [Bun 1.4.3](https://bun.com/blog/bun-v1.4.3) introduced this checker. The installed Bun was upgraded from 1.4.2; `package.json` now records `bun >=1.4.3`. TypeScript remains installed for editor and tooling compatibility.
- Verified the new project script succeeds and rejects an intentionally introduced TS2322 error with exit code 1; the temporary invalid file was removed.

Raw measurement data: [upgrade-benchmarks.json](./upgrade-benchmarks.json).
