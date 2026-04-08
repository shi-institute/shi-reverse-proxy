<svelte:options customElement={{}} />

<script lang="ts" module>
	import { hashSync } from '../../utils';
	import { url } from '../../utils/navigation';

	export interface NavigationListProps {
		items: TopLevelNavigationListItem[];
		transformHref?: (href: string) => string;
		direction?: 'horizontal' | 'vertical';
		onItemClick?: () => void;
	}

	export type TopLevelNavigationListItem = NavigationListLinkItemWithChildren | NavigationListItem;

	export type NavigationListItem = NavigationListLinkItem | NavigationListDividerItem | NavigationListSpacerItem;

	export interface NavigationListLinkItem {
		type?: 'link';
		label: string;
		class?: string;
		href?: string;
	}

	export interface NavigationListLinkItemWithChildren extends NavigationListLinkItem {
		children: (NavigationListLinkItem | NavigationListDividerItem)[];
	}

	export type NavigationListDividerItem = {
		type: 'divider';
	};

	export type NavigationListSpacerItem = {
		type: 'spacer';
		size: string;
	};
</script>

<script lang="ts">
	let { items, transformHref: _transformHref = (href) => href, direction = 'horizontal', onItemClick }: NavigationListProps = $props();

	function doUrlsMatch(toCheck: string, reference: string) {
		try {
			const urlToCheck = new URL(toCheck, $url.origin);
			const referenceUrl = new URL(reference, $url.origin);
			return urlToCheck.origin === referenceUrl.origin && urlToCheck.pathname === referenceUrl.pathname;
		} catch (error) {
			return false;
		}
	}

	const isBlog = $derived($url.origin.includes('https://blogs.furman' + '.edu'));
	const prefix = $derived(isBlog ? `/${$url.pathname.split('/')[1] || ''}` : '');

	function transformHref(href: string) {
		const transformed = _transformHref(href);

		// If the transformed href is a relative path and the current origin is the blogs subdomain,
		// we need to prepend the first segment of the current path to the href.
		// This allows links to work correctly when the site is accessed from the subpath
		// instead of the root domain.
		if (transformed.startsWith('/') && prefix) {
			return prefix + transformed;
		}
		return transformed;
	}

	let navListElement = $state<HTMLUListElement | null>(null);
</script>

<ul class:vertical={direction === 'vertical'} class="nav-list" bind:this={navListElement}>
	{#each items as item, index}
		{@const itemId = 'i' + index + hashSync(JSON.stringify(item))}
		{#if item.type === 'divider'}
			<hr />
		{:else if item.type === 'spacer'}
			<div style={direction === 'vertical' ? `height: ${item.size};` : `width: ${item.size};`}></div>
		{:else}
			<li class={item.class}>
				{#if item.href}
					{@const useNewTab = item.label.endsWith('↗')}
					<a
						href={transformHref(item.href)}
						class="nav-link"
						class:current={doUrlsMatch(transformHref(item.href), $url.href)}
						target={useNewTab ? '_blank' : '_self'}
						rel="noopener noreferrer"
						onclick={onItemClick}
					>
						<span>{item.label}</span>
					</a>
				{:else}
					<span>{item.label}</span>
				{/if}
				{#if 'children' in item && item.children.length > 0 && direction === 'horizontal'}
					<button
						aria-label="Open child navigation"
						class="child-nav-trigger"
						onclick={() => {
							const childNavWrapper = navListElement?.querySelector(`#${itemId}-child-nav`) as HTMLElement | null;
							if (!childNavWrapper) {
								return;
							}
							const isCurrentlyVisible = childNavWrapper.style.visibility === 'visible';

							const firstChildNavAnchor = childNavWrapper.querySelector('a');
							if (!firstChildNavAnchor || !(firstChildNavAnchor instanceof HTMLAnchorElement)) {
								return;
							}

							// Since the browser will not focus elements that are not visible, we need to
							// force the child nav wrapper to be visible before focusing the first child anchor.
							if (!isCurrentlyVisible) {
								childNavWrapper.style.visibility = 'visible';
								childNavWrapper.style.transition = 'none';
								setTimeout(() => {
									childNavWrapper.style.visibility = '';
									childNavWrapper.style.transition = '';
								}, 5);
							}

							setTimeout(() => {
								firstChildNavAnchor.focus();
							}, 6);
						}}
					>
						<svg viewBox="0 0 24 24">
							<path
								d="M4.22 8.47a.75.75 0 0 1 1.06 0L12 15.19l6.72-6.72a.75.75 0 1 1 1.06 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L4.22 9.53a.75.75 0 0 1 0-1.06Z"
								fill="currentColor"
							/>
						</svg>
					</button>
					<div class="child-nav-list-wrapper" id={`${itemId}-child-nav`}>
						<ul class="child-nav-list">
							{#each item.children as child}
								{#if child.type === 'divider'}
									<hr />
								{:else}
									<li class={child.class}>
										{#if child.href}
											{@const useNewTab = child.label.endsWith('↗')}
											<a
												href={transformHref(child.href)}
												class:current={doUrlsMatch(transformHref(child.href), $url.href)}
												target={useNewTab ? '_blank' : '_self'}
												rel="noopener noreferrer"
												onclick={onItemClick}
											>
												<span>{child.label}</span>
											</a>
										{:else}
											<span>{child.label}</span>
										{/if}
									</li>
								{/if}
							{/each}
						</ul>
					</div>
				{:else if 'children' in item && item.children.length > 0 && direction === 'vertical'}
					<ul class="nav-list indent">
						{#each item.children as child}
							{#if child.type === 'divider'}
								<hr />
							{:else}
								<li class={child.class}>
									{#if child.href}
										{@const useNewTab = child.label.endsWith('↗')}
										<a
											href={transformHref(child.href)}
											class:current={doUrlsMatch(transformHref(child.href), $url.href)}
											target={useNewTab ? '_blank' : '_self'}
											rel="noopener noreferrer"
											onclick={onItemClick}
										>
											<span>{child.label}</span>
										</a>
									{:else}
										<span>{child.label}</span>
									{/if}
								</li>
							{/if}
						{/each}
					</ul>
				{/if}
			</li>
		{/if}
	{/each}
</ul>

<style>
	ul {
		list-style: none;
		display: flex;
		align-items: center;
		margin: 0;
		padding: 0;
		gap: var(--gap, calc(4 / 3 * 1rem));
	}
	ul.indent {
		margin-inline-start: 1.5rem;
	}

	ul.nav-list.vertical {
		flex-direction: column;
		align-items: stretch;
	}

	li {
		display: flex;
		align-items: stretch;
		position: relative;
	}
	ul.nav-list.vertical li {
		flex-direction: column;
		gap: var(--gap, calc(4 / 3 * 1rem));
	}

	a span {
		font-size: 0.95rem;
		font-family: 'Epilogue', sans-serif;
		color: var(--shi-navlist-color);
		text-decoration: none;
		font-weight: 500;
		font-variation-settings: 'wght' 560;
		padding: calc(0.5rem - 2px) 0 0.5rem 0;
		text-box: trim-both text alphabetic;
		border-bottom-width: 2px;
		border-bottom-style: solid;
		border-bottom-color: transparent;
		display: inline-block;
		transition: all var(--shi-transition-120ms);
		user-select: none;
	}
	a.current span {
		border-bottom-color: var(--shi-navbar-color--current);
		color: var(--shi-navbar-color--current);
	}
	a.nav-link:hover span {
		border-bottom-color: var(--shi-navbar-color--hover);
		color: var(--shi-navbar-color--hover);
	}
	a.current:hover:not(:active) span {
		border-bottom-color: var(--shi-navbar-color--current--hover);
		color: var(--shi-navbar-color--current--hover);
	}
	a.nav-link:active span {
		border-bottom-color: var(--shi-navbar-color--active);
		color: var(--shi-navbar-color--active);
	}

	hr {
		border: none;
		border-style: solid;
		border-color: var(--shi-divider-color);
		border-width: 0;
		border-left-width: 1px;
		height: 30px;
		background-color: transparent;
		opacity: 1;
		margin: 0;
	}

	ul.nav-list.vertical hr {
		border-left-width: 0;
		border-top-width: 1px;
		width: 100%;
		height: 0;
	}

	button {
		appearance: none;
		border: none;
		min-height: 100%;
		padding: 0 0 2px 0.25rem;
		background-color: transparent;
	}
	button svg {
		inline-size: 14px;
		block-size: 14px;
		transition: transform var(--shi-transition-120ms);
		transition-delay: var(--shi-transition-250ms);
	}
	li:has(a.nav-link):hover > .child-nav-trigger svg,
	li:has(.child-nav-list-wrapper:focus-within) > .child-nav-trigger svg {
		transform: rotate(180deg);
		transition-delay: var(--shi-transition-120ms);
	}

	div.child-nav-list-wrapper {
		position: absolute;
		top: 100%;
		left: 0;
		z-index: 1000;
		opacity: 0;
		visibility: hidden;
		transition: all var(--shi-transition-250ms) allow-discrete;
		transition-delay: 250ms; /* delay hiding the menu */
	}
	li:has(a.nav-link):hover > .child-nav-list-wrapper,
	.child-nav-list-wrapper:focus-within {
		opacity: 1;
		visibility: visible;
		animation: slide-down var(--shi-transition-250ms) ease;
		transition-delay: 80ms;
		animation-delay: 80ms;
	}

	ul.child-nav-list {
		display: flex;
		flex-direction: column;
		gap: 0;
		margin-top: var(--shi-child-navlist-offset-y, 0.5rem);
		background-color: var(--shi-child-navlist-background-color, var(--shi-navbar-background-color));
		box-shadow:
			inset 0 0 0 1px var(--shi-divider-color),
			0 4px 6px rgba(0, 0, 0, 0.1);
		min-width: 160px;
	}

	@keyframes slide-down {
		from {
			transform: translateY(-10px);
		}
		to {
			transform: translateY(0);
		}
	}

	ul.child-nav-list :where(li, a) {
		width: 100%;
	}

	ul.child-nav-list a {
		padding: 0.375rem 1rem;
		display: block;
		transition: all var(--shi-transition-120ms) allow-discrete;
	}
	ul.child-nav-list a:hover {
		background-color: color-mix(in srgb, var(--shi-color-purple), transparent 92%);
	}
	ul.child-nav-list a:active {
		background-color: color-mix(in srgb, var(--shi-color-purple), transparent 84%);
	}
</style>
