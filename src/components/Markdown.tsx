import { Fragment, type ReactNode } from "react";

/**
 * Minimal, dependency-free Markdown renderer for briefing content. We control
 * the source (the BRIEFER agent), so we support a deliberate subset: ATX
 * headings, unordered lists, paragraphs, and inline `code` / **bold** /
 * [links](url). Rendered into the `.prose-serif` editorial register.
 *
 * Not a general-purpose renderer; if briefings grow richer, swap in a real
 * markdown lib. No raw HTML pass-through.
 */
export function Markdown({ source }: { source: string }) {
	return <div className="prose-serif text-ink/90">{renderBlocks(source)}</div>;
}

function renderBlocks(src: string): ReactNode {
	const lines = src.replace(/\r\n/g, "\n").split("\n");
	const out: ReactNode[] = [];
	let i = 0;
	let key = 0;

	while (i < lines.length) {
		const line = lines[i] ?? "";

		if (line.trim() === "") {
			i++;
			continue;
		}

		const heading = /^(#{1,4})\s+(.*)$/.exec(line);
		if (heading) {
			const hashes = heading[1] ?? "#";
			const text = heading[2] ?? "";
			const content = renderInline(text);
			if (hashes.length <= 2) {
				out.push(<h2 key={key++}>{content}</h2>);
			} else {
				out.push(<h3 key={key++}>{content}</h3>);
			}
			i++;
			continue;
		}

		if (/^\s*[-*]\s+/.test(line)) {
			const items: ReactNode[] = [];
			while (i < lines.length && /^\s*[-*]\s+/.test(lines[i] ?? "")) {
				const text = (lines[i] ?? "").replace(/^\s*[-*]\s+/, "");
				items.push(<li key={items.length}>{renderInline(text)}</li>);
				i++;
			}
			out.push(<ul key={key++}>{items}</ul>);
			continue;
		}

		// paragraph: gather until a blank line or a new block
		const para: string[] = [];
		while (i < lines.length) {
			const l = lines[i] ?? "";
			if (l.trim() === "" || /^#{1,4}\s+/.test(l) || /^\s*[-*]\s+/.test(l)) {
				break;
			}
			para.push(l);
			i++;
		}
		out.push(<p key={key++}>{renderInline(para.join(" "))}</p>);
	}

	return out;
}

const INLINE = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;

function renderInline(text: string): ReactNode {
	const parts = text.split(INLINE).filter((p) => p !== "");
	return parts.map((part, idx) => {
		const bold = /^\*\*([^*]+)\*\*$/.exec(part);
		if (bold?.[1]) {
			return <strong key={idx}>{bold[1]}</strong>;
		}
		const code = /^`([^`]+)`$/.exec(part);
		if (code?.[1]) {
			return <code key={idx}>{code[1]}</code>;
		}
		const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
		if (link?.[1] && link[2]) {
			const href = link[2];
			const internal = href.startsWith("/") || href.startsWith("#");
			return (
				<a
					key={idx}
					href={href}
					{...(internal ? {} : { target: "_blank", rel: "noreferrer" })}
				>
					{link[1]}
				</a>
			);
		}
		return <Fragment key={idx}>{part}</Fragment>;
	});
}
