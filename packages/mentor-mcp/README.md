# OpenSource Mentor MCP

This package provides the local stdio server. It is not published to npm yet;
`private: true` intentionally blocks publication pending release approval.
The executable mapping and source-file whitelist are prepared here.

This package is licensed under MIT. Commercial use and proprietary derivatives
are permitted subject to the copyright and license notice requirements. See
LICENSE in this package. Third-party dependencies retain their own licenses.

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
