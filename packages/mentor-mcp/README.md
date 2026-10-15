# OpenSource Mentor MCP

This package provides the local stdio server. It is not published to npm yet;
`private: true` intentionally blocks publication pending release approval.
The executable mapping and source-file whitelist are prepared here.

The public distribution is AGPL-3.0-only; an alternative commercial license
requires a separate written agreement. See LICENSE and LICENSING.md in this
package. AGPL permits commercial use when its conditions are met.

Clone the repository, then run `npm ci` in this directory. Your MCP host starts
`node /absolute/path/opensource-mentor/packages/mentor-mcp/src/stdio.mjs`.
Set OSM_BASE_URL to `https://hokkai.top`, OSM_LOCALE to `en-US` or `zh-CN`, and
OSM_MODEL_SOURCE to `agent` to generate with the host model without an AI key.

Website generation requires the user's own configured model key; the server
never silently switches generation modes. Never commit credentials. The host
owns the process; stdout is reserved for MCP protocol messages.

Remote HTTPS connections do not need this package or a local clone:
https://opensource-mentor-remote-mvp.316920080dd.workers.dev/mcp

Hosts must support OAuth or use an operator-issued personal static credential.
See the repository's [installation guide](https://github.com/asJEI/opensource-mentor/blob/main/docs/mcp-hosts.md).
