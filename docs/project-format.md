# Project format (scaffold)

The on-disk `.allstudio` format is **not locked**. `@allstudio/project` currently validates an illustrative v1 manifest so workspace imports and tests have a real contract.

Expected later (from v0.2 architecture, not implemented):

```text
my-project/
├── app/ or src/
├── package.json
└── .allstudio/
    ├── project.json
    ├── boards/
    └── revisions/
```

Do not treat `ProjectManifestV1` as the shipping schema until a founder-approved ADR says so.
