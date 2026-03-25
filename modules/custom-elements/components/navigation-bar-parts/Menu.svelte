<svelte:options customElement={{}} />

<script lang="ts" module>
	import type { NavigationListItem, NavigationListProps } from './NavigationList.svelte';
	import NavigationList from './NavigationList.svelte';

	export interface MenuProps {
		items: NavigationListItem[];
		transformHref?: NavigationListProps['transformHref'];
	}
</script>

<script lang="ts">
	import Search from './Search.svelte';

	let { items, transformHref }: MenuProps = $props();

	let dialogElement = $state<HTMLDialogElement | null>(null);

	let closing = $state(false);
	function closeDialog() {
		if (dialogElement) {
			closing = true;
			setTimeout(() => {
				closing = false;
				dialogElement?.close();
			}, 200); // delay so the animation can play
		}
	}

	function openDialog() {
		if (dialogElement) {
			dialogElement.showModal();
		}
	}

	/**
	 * Closes the dialog if a click occurs outside of it (e.g., on the backdrop).
	 *
	 * This should be attached to the dialog element's click event.
	 */
	function closeDialogOnClickOutside(event: MouseEvent) {
		if (!dialogElement) {
			return;
		}

		const rect = dialogElement.getBoundingClientRect();
		const clickedOutside =
			event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;

		if (clickedOutside) {
			closeDialog();
		}
	}
</script>

<button class="menu-button" aria-label="Open menu" onclick={openDialog}>
	<svg xmlns="http://www.w3.org/2000/svg" width="26" viewBox="0 0 40 14">
		<g transform="translate(0.397 1.088)">
			<line x2="40" transform="translate(-0.397 -0.088)" fill="none" stroke="currentColor" stroke-width="2" /><line
				x2="40"
				transform="translate(-0.397 5.912)"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
			/>
			<line x2="40" transform="translate(-0.397 11.912)" fill="none" stroke="currentColor" stroke-width="2" /></g
		>
	</svg>
	Menu
</button>

<dialog bind:this={dialogElement} onclick={closeDialogOnClickOutside} class:closing>
	<header>
		<a href="/" aria-label="Home">
			<svg xmlns="http://www.w3.org/2000/svg" height="40" viewBox="0 0 36.036 36.03" fill="currentColor">
				<path
					d="M24.468 15.226c.369.85.575 1.787.577 2.773h10.991c-.002-2.608-.563-5.613-1.563-7.85zM24.657 20.324a7 7 0 0 1-1.764 2.754l7.564 7.97a18 18 0 0 0 4.589-7.137zM21.01 24.378c-.84.395-1.77.629-2.752.661l.026 10.99a17.9 17.9 0 0 0 7.275-1.647zM20.29 11.369a7 7 0 0 1 2.913 1.906l7.97-7.563A18 18 0 0 0 23.879.979ZM13.079 9.135l1.862 2.573a7 7 0 0 1 3.078-.717V7.809c-1.727.012-3.434.47-4.94 1.326M9.306 12.86l2.853 1.283c.336-.508.74-.965 1.193-1.368l-1.842-2.546a10.2 10.2 0 0 0-2.204 2.632M11.33 15.867 8.5 14.596a10.1 10.1 0 0 0-.593 3.39q0 .042.004.085l.004.076 3.093-.342c.021-.673.125-1.325.322-1.938M8.118 20.048c.235 1.14.678 2.24 1.316 3.27l2.494-1.826a7 7 0 0 1-.71-1.787zM14.792 27.607l1.001-2.923a7 7 0 0 1-2.708-1.669l-2.497 1.83a10.23 10.23 0 0 0 4.204 2.762M6.593 27.785l-.007-.01-2.41 1.765a18.06 18.06 0 0 0 8.054 5.541l.961-2.804a15.16 15.16 0 0 1-6.598-4.492M5.433 26.239A14.95 14.95 0 0 1 3.208 20.6l-.001-.01-2.974.328a17.9 17.9 0 0 0 2.804 7.086l2.401-1.76zM3.001 18.68l-.015-.245c-.01-.149-.02-.298-.02-.45 0-1.836.342-3.656 1.017-5.41l.004-.008-2.699-1.212A17.9 17.9 0 0 0 0 18.018c0 .337.022.667.04 1l2.962-.328zM4.78 10.814a15.1 15.1 0 0 1 3.823-4.588l.007-.005L6.9 3.858a18.1 18.1 0 0 0-4.815 5.758l2.689 1.208zM10.186 5.117a15.06 15.06 0 0 1 7.832-2.248V0a17.9 17.9 0 0 0-9.552 2.76l1.71 2.364zM9.716 25.503l-.01-.012-2.107 1.543a13.9 13.9 0 0 0 5.997 4.06l.843-2.458a11.3 11.3 0 0 1-4.723-3.133M7.034 20.168l-2.582.285c.327 1.812.999 3.51 1.998 5.051l2.103-1.54-.007-.01a11.2 11.2 0 0 1-1.51-3.772q0-.008-.002-.014M7.506 14.148 5.13 13.081a13.8 13.8 0 0 0-.913 4.904q.002.179.017.353.007.107.012.214l2.586-.286v-.013l-.007-.11q-.006-.078-.007-.158c0-1.29.23-2.577.683-3.826zM5.918 11.339l2.39 1.073q.002-.008.006-.014A11.3 11.3 0 0 1 10.86 9.35l.009-.007-1.526-2.109a13.9 13.9 0 0 0-3.425 4.105M12.452 8.242a11.24 11.24 0 0 1 5.565-1.521h.002V4.12a13.8 13.8 0 0 0-7.107 2.02l1.527 2.11z"
				/>
			</svg>
		</a>

		<Search
			initialWidth="100%"
			focusedWidth="100%"
			styles={{
				base: { backgroundColor: 'var(--shi-color-purple)', color: 'var(--shi-color--on-purple)' },
				hover: { backgroundColor: 'var(--shi-color-blue)', color: 'var(--shi-color--on-blue)' },
				active: { backgroundColor: 'var(--shi-color-midnight)', color: 'var(--shi-color--on-midnight)' },
				focus: {
					backgroundColor: 'var(--shi-color-midnight)',
					color: 'var(--shi-color--on-midnight)',
					boxShadow: '0 0 0 2px var(--shi-color-blue)',
				},
			}}
		/>

		<button class="nav-close-button menu-button" onclick={closeDialog}>
			<svg xmlns="http://www.w3.org/2000/svg" width="48" viewBox="0 0 60 60">
				<circle cx="30" cy="30" r="30" fill="#F9F5FF" />
				<path d="M19 19 L41 41 M41 19 L19 41" stroke="#1A083D" stroke-width="4" stroke-linecap="round" />
				<style>
					path {
						--darkreader-inline-stroke: #1a083d !important;
					}
				</style>
			</svg>
			Close
		</button>
	</header>

	<div class="side-nav-content">
		<NavigationList {items} {transformHref} direction="vertical" onItemClick={closeDialog} />
	</div>
</dialog>

<style>
	.menu-button {
		display: inline-flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 6px;
		width: 60px;
		height: 100%;
		border: none;
		background-color: var(--shi-color-purple);
		color: var(--shi-color--on-purple);
		transition:
			background-color var(--shi-transition-120ms) ease,
			box-shadow var(--shi-transition-120ms) ease;
		border: 0;
		font-size: 12px;
		font-family: 'Oswald', sans-serif;
		font-weight: 400;
		text-transform: uppercase;
		padding: 6px 0 0 0;
		flex-grow: 0;
		flex-shrink: 0;
	}
	.menu-button:hover {
		background-color: light-dark(var(--shi-color-midnight), oklch(from var(--shi-color-purple) calc(l + 0.08) c h));
		color: var(--shi-color--on-midnight);
	}
	.menu-button:active {
		background-color: var(--shi-color-blue);
		color: var(--shi-color--on-blue);
	}

	dialog {
		border: none;
		padding: 0;
		overflow: auto;
		width: 420px;
		height: 100%;
		max-height: 100%;
		max-width: 100%;
		box-sizing: border-box;
		position: fixed;
		inset: 0 0 0 auto;
		background-color: var(--shi-color-midnight);
		color: var(--shi-color--on-midnight);
		box-shadow:
			0px 32px 64px hsla(0, 0%, 0%, 0.27),
			0px 2px 21px hsla(0, 0%, 0%, 0.27);
		color-scheme: dark;
	}
	@media (width < 601px) {
		dialog {
			width: 100%;
		}
	}

	dialog[open] {
		display: flex;
		flex-direction: column;

		animation: popover-show var(--shi-transition-200ms) forwards cubic-bezier(0.16, 1, 0.3, 1);
	}
	dialog::backdrop {
		animation: backdrop-fade-in var(--shi-transition-200ms) forwards;
		background: rgba(0, 0, 0, 0.5);
	}

	dialog.closing {
		animation: popover-hide var(--shi-transition-200ms) forwards cubic-bezier(0.16, 1, 0.3, 1);
	}
	dialog.closing::backdrop {
		animation: backdrop-fade-out var(--shi-transition-200ms) forwards;
	}

	@keyframes popover-show {
		from {
			opacity: 0;
			transform: translateX(360px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@keyframes popover-hide {
		from {
			opacity: 1;
			transform: translateX(0);
		}
		to {
			opacity: 0;
			transform: translateX(360px);
		}
	}

	@keyframes backdrop-fade-in {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	@keyframes backdrop-fade-out {
		from {
			opacity: 1;
		}
		to {
			opacity: 0;
		}
	}

	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		background-color: var(--shi-color-midnight);
		color: var(--shi-color--on-midnight);
		position: sticky;
		top: 0;
	}

	header a {
		display: inline-flex;
		align-items: center;
		margin-inline: 16px 8px;
		user-select: none;
		color: inherit;
		text-decoration: none;
	}

	.nav-close-button {
		background-color: var(--shi-color-midnight);
		color: var(--shi-color--on-midnight);
		height: 60px;
		padding-block: 10px 6px;
		user-select: none;
	}
	.nav-close-button:hover {
		background-color: var(--shi-color-purple);
		color: var(--shi-color--on-purple);
	}
	.nav-close-button:active {
		background-color: var(--shi-color-blue);
		color: var(--shi-color--on-blue);
	}

	.side-nav-content {
		padding: 1rem;
		height: 100%;
		box-sizing: border-box;
		overflow: auto;
	}

	.side-nav-content :global(ul) {
		--gap: 0.75rem;
	}

	.side-nav-content :global(a) {
		display: inline-block;
		width: 100%;
		text-decoration: none;
	}

	.side-nav-content :global(a span) {
		color: oklch(from var(--shi-color-white) calc(l - 0.1) c h);
	}
	.side-nav-content :global(a.current) {
		padding-bottom: 0.25rem;
	}
	.side-nav-content :global(a.current span) {
		color: var(--shi-color-blue);
		border-bottom-color: oklch(from var(--shi-color-blue) calc(l + 0.01) c h);
	}
	.side-nav-content :global(a:hover span) {
		color: oklch(from var(--shi-color-purple) calc(l + 0.4) calc(c - 0.08) h);
		border-bottom-color: oklch(from var(--shi-color-purple) calc(l + 0.35) calc(c - 0.08) h);
	}
	.side-nav-content :global(a:active span) {
		color: oklch(from var(--shi-color-purple) calc(l + 0.3) calc(c - 0.08) h);
		border-bottom-color: oklch(from var(--shi-color-purple) calc(l + 0.25) calc(c - 0.08) h);
	}

	.side-nav-content :global(hr) {
		border-color: var(--shi-color-purple);
		width: 50% !important;
		margin-top: 0.5rem;
		padding-top: 0.5rem;
	}
</style>
