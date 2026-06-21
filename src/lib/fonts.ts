/**
 * The typographic contract, load-bearing:
 *   serif = authored human prose (claims/bodies/briefings)
 *   sans  = UI chrome / labels / nav
 *   mono  = every machine fact (ids, paths, timestamps, scores)
 * Exposed as CSS vars consumed by globals.css (@theme inline).
 */

import { Inter_Tight, JetBrains_Mono, Source_Serif_4 } from "next/font/google";

export const sourceSerif = Source_Serif_4({
	subsets: ["latin"],
	variable: "--font-source-serif",
	display: "swap",
	style: ["normal", "italic"],
});

export const interTight = Inter_Tight({
	subsets: ["latin"],
	variable: "--font-inter-tight",
	display: "swap",
});

export const jetbrainsMono = JetBrains_Mono({
	subsets: ["latin"],
	variable: "--font-jetbrains-mono",
	display: "swap",
});
