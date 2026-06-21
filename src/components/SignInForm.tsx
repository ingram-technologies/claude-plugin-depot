"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { signIn, signUp } from "@/lib/auth-client";

type Mode = "in" | "up";

export function SignInForm() {
	const router = useRouter();
	const params = useSearchParams();
	const next = params.get("next") ?? "/";

	const [mode, setMode] = useState<Mode>("in");
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		setBusy(true);
		try {
			const res =
				mode === "in"
					? await signIn.email({ email, password })
					: await signUp.email({ email, password, name: name || email });
			if (res.error) {
				setError(res.error.message ?? "Authentication failed.");
				return;
			}
			router.push(next);
			router.refresh();
		} catch {
			setError("Something went wrong. Try again.");
		} finally {
			setBusy(false);
		}
	}

	return (
		<form onSubmit={onSubmit} className="flex flex-col gap-3">
			{mode === "up" && (
				<Field
					label="name"
					type="text"
					value={name}
					onChange={setName}
					autoComplete="name"
				/>
			)}
			<Field
				label="email"
				type="email"
				value={email}
				onChange={setEmail}
				autoComplete="email"
				required
			/>
			<Field
				label="password"
				type="password"
				value={password}
				onChange={setPassword}
				autoComplete={mode === "in" ? "current-password" : "new-password"}
				required
			/>

			{error && <p className="font-mono text-[11px] text-stale">{error}</p>}

			<button
				type="submit"
				disabled={busy}
				className="mt-1 rounded-[6px] border border-gold bg-gold/10 px-4 py-2 font-sans text-[13px] text-gold transition-colors hover:bg-gold/20 disabled:opacity-50"
			>
				{busy ? "…" : mode === "in" ? "Sign in" : "Create account"}
			</button>

			<button
				type="button"
				onClick={() => {
					setMode((m) => (m === "in" ? "up" : "in"));
					setError(null);
				}}
				className="self-start font-sans text-[12px] text-muted transition-colors hover:text-ink"
			>
				{mode === "in"
					? "No account? Create one"
					: "Already have an account? Sign in"}
			</button>
		</form>
	);
}

function Field({
	label,
	type,
	value,
	onChange,
	autoComplete,
	required,
}: {
	label: string;
	type: string;
	value: string;
	onChange: (v: string) => void;
	autoComplete?: string;
	required?: boolean;
}) {
	return (
		<label className="flex flex-col gap-1">
			<span className="font-mono text-[10px] tracking-wider text-muted uppercase">
				{label}
			</span>
			<input
				type={type}
				value={value}
				required={required}
				autoComplete={autoComplete}
				onChange={(e) => onChange(e.target.value)}
				className="rounded-[6px] border border-hairline bg-surface/40 px-3 py-2 font-sans text-sm text-ink focus:border-gold focus:outline-none"
			/>
		</label>
	);
}
