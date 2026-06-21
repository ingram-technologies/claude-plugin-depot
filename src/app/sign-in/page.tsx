import { Suspense } from "react";

import { SignInForm } from "@/components/SignInForm";

export default function SignInPage() {
	return (
		<div className="flex min-h-dvh items-center justify-center px-6">
			<div className="w-full max-w-sm">
				<div className="mb-8 flex items-baseline gap-2">
					<span className="font-mono text-gold">▍</span>
					<h1 className="font-sans text-lg font-semibold tracking-tight text-ink">
						depot
					</h1>
				</div>
				<p className="mb-6 font-serif text-[15px] text-muted italic">
					A project&rsquo;s institutional memory — cited, durable, quietly alive.
				</p>
				<Suspense fallback={null}>
					<SignInForm />
				</Suspense>
			</div>
		</div>
	);
}
