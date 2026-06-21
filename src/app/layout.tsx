import type { Metadata } from "next";

import { interTight, jetbrainsMono, sourceSerif } from "@/lib/fonts";

import "./globals.css";

export const metadata: Metadata = {
	title: "Depot — institutional memory",
	description:
		"Depot distills Claude Code transcripts into durable, cited per-project Memories.",
};

export default function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<html
			lang="en"
			className={`${sourceSerif.variable} ${interTight.variable} ${jetbrainsMono.variable}`}
			suppressHydrationWarning
		>
			<body>{children}</body>
		</html>
	);
}
