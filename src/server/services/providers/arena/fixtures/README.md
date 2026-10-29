# Arena parquet fixture

Source: https://huggingface.co/datasets/lmarena-ai/leaderboard-dataset/resolve/main/text_style_control/latest-00000-of-00001.parquet

Retrieved: 2026-10-27. The snapshot was published on 2026-10-22.

SHA-256: `e8a4229d616f2059e64def8fd6bebf36b7732473e6f74f4f1bb5be20d953050e`

Regenerate from the repository root:

```sh
curl --fail --location https://huggingface.co/datasets/lmarena-ai/leaderboard-dataset/resolve/main/text_style_control/latest-00000-of-00001.parquet --output src/server/services/providers/arena/fixtures/latest.parquet
sha256sum src/server/services/providers/arena/fixtures/latest.parquet
```

The upstream `main` URL changes with new publications. Review the checksum, publication date and expected leading row in `arena.test.ts` when refreshing.
