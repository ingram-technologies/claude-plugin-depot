import type { NextConfig } from "next";

const config: NextConfig = {
	serverExternalPackages: ["pg", "@electric-sql/pglite"],
	experimental: {
		// Large transcript payloads arrive at /api/ingest.
		serverActions: { bodySizeLimit: "16mb" },
	},
};

export default config;
