# Tdarr Plugins And Flow Components

Tdarr classic plugins and support modules maintained by Freohrskulblaka.

## Plugins

- `classic_plugins/media_optimizer/`: deployable Media Optimizer classic plugin package. Its `Local/` and `media_optimizer/` folders mirror the final Tdarr `Plugins/` layout.
- `classic_plugins/media_parts_extractor/`: deployable Media Parts Extractor classic plugin package. It contains the Tdarr entrypoint, support modules, and deployment README.

## Support Modules

- `classic_plugins/media_optimizer/media_optimizer/`: Media Optimizer runtime, pipeline orchestration, domain modules, integrations, shared helpers, and compatibility entry points.
- `classic_plugins/media_parts_extractor/media_parts_extractor/`: configuration, planning, naming, command rendering/execution, and formatting for Media Parts Extractor.
- `docs/media_optimizer_changelog.md`: durable Media Optimizer change history and runtime validation markers.

## Local Runtime Files

This repository does not commit Tdarr runtime helpers, real Arr credentials, exports, media samples, or local test output.

Deployment payloads should include only the plugin's `Local/` entrypoint and required support module folder.

Use `.env.example` as the placeholder shape for local lookup settings. Do not commit real hosts or API keys.

## Deployment Notes

Build or deploy Media Optimizer from:

- `classic_plugins/media_optimizer/`

See `classic_plugins/media_optimizer/README.md` for release archive, backup, installation, validation, and rollback instructions.

Deploy Media Parts Extractor with:

- `classic_plugins/media_parts_extractor/`

See `classic_plugins/media_parts_extractor/README.md` for copy instructions and expected Tdarr layout.

Inside Tdarr, copied folders should keep the same sibling layout documented in each plugin README so relative `require(...)` paths resolve.

## License

This project is licensed under the GNU General Public License. See `LICENSE`.
