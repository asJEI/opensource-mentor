# User onboarding and account profiles

On first use, `get_user_profile` loads confirmed answers. The Agent asks only for missing languages, experience, interests, goals and weekly hours, then saves locally with `save_user_profile`. Do not estimate proficiency from git/npm installation.

Account sync is optional. With consent, `connect_account` returns a browser link. Sign in using the existing GitHub login, return to the approval tab, refresh and approve. Use a browser on the same computer as the stdio process. `account_connection_status` checks completion; `get_user_profile` reads the account profile. Upload only confirmed answers with `save_user_profile` and `sync: true`. A local profile is never uploaded automatically at login. `disconnect_account` revokes access and clears the cache.

The credential is scoped to profiles, valid for seven days, and stored outside the repository under `~/.opensource-mentor` (override with `OSM_STATE_DIR`). Connecting again replaces the previous connection for that account. It does not grant GitHub writes or platform AI quota. Cloud-hosted harnesses without access to the loopback browser callback cannot use this connection flow.

**Backend prerequisite:** deploy this version of the Cloudflare Worker before using online account sync. Local onboarding works without backend deployment. Existing Supabase `developer_profiles.developer_profile` JSON stores the profile; no new database or schema migration is required. Web login/refresh restores it, and saving web preferences updates it. Roadmaps, conversations and contribution progress are not synced by these new MCP tools. The Express backend does not support account binding.
