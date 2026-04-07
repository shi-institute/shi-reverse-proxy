<svelte:options customElement={{}} />

<script lang="ts" module>
	import type { NavigationListItem } from './navigation-bar-parts/NavigationList.svelte';
	import NavigationList from './navigation-bar-parts/NavigationList.svelte';

	export interface AdminBarBarProps {
		adminHref: string;
	}
</script>

<script lang="ts">
	let { adminHref }: AdminBarBarProps = $props();

	let pageOrPostId = $state<number>();
	$effect(() => {
		if (document.body.classList.value.includes('page-id-')) {
			const match = document.body.classList.value.match(/page-id-(\d+)/);
			if (match?.[1]) {
				pageOrPostId = parseInt(match[1], 10);
			}
		}

		if (document.body.classList.value.includes('postid-')) {
			const match = document.body.classList.value.match(/postid-(\d+)/);
			if (match?.[1]) {
				pageOrPostId = parseInt(match[1], 10);
			}
		}
	});

	let visible = $state(false);
	$effect(() => {
		visible = localStorage.getItem('adminBarVisible') === 'true';

		window.addEventListener('storage', (event) => {
			if (event.key === 'adminBarVisible') {
				visible = event.newValue === 'true';
			}
		});

		// @ts-expect-error
		window.addEventListener('adminBarVisibleChanged', (event: CustomEvent) => {
			if (typeof event.detail === 'boolean') {
				visible = event.detail;
			}
		});
	});

	$effect(() => {
		if (visible) {
			document.body.classList.add('admin-bar');
			document.documentElement.style.setProperty('--wp-admin--admin-bar--height', '32px');
			document.documentElement.style.marginTop = 'var(--wp-admin--admin-bar--height)';
		} else {
			document.body.classList.remove('admin-bar');
			document.documentElement.style.removeProperty('--wp-admin--admin-bar--height');
			document.documentElement.style.removeProperty('margin-top');
		}
	});

	const items: NavigationListItem[] = $derived([
		{
			label: 'Dashboard',
			href: 'https://blogs.furman.edu/jbtest/wp-admin/',
			children: [
				{
					label: 'Shi Institute',
					href: 'https://blogs.furman.edu/jbtest/wp-admin/',
				},
				{
					label: 'Shi Institute (FU)',
					href: 'https://www.furman.edu/shi-institute/wp-admin/',
				},
				{
					label: 'Sustainability',
					href: 'https://www.furman.edu/sustainability/wp-admin/',
				},
			],
		},
		{
			label: 'Edit Site',
			href: 'https://blogs.furman.edu/jbtest/site-editor.php',
		},
		{
			label: 'New',
			href: `https://www.furman.edu/shi-institute/wp-admin/post-new.php`,
			children: [
				{
					label: 'Post',
					href: `https://www.furman.edu/shi-institute/wp-admin/post-new.php`,
				},
				{
					label: 'Project Brief',
					href: 'https://blogs.furman.edu/jbtest/wp-admin/post-new.php?post_type=projects',
				},
				{
					label: 'Services',
					href: 'https://blogs.furman.edu/jbtest/wp-admin/post-new.php?post_type=services',
				},
				{
					label: 'Staff',
					href: 'https://blogs.furman.edu/jbtest/wp-admin/post-new.php?post_type=staff',
				},
				{
					label: 'Affiliate',
					href: 'https://blogs.furman.edu/jbtest/wp-admin/post-new.php?post_type=affiliate',
				},
				{
					label: 'Fellows',
					href: 'https://blogs.furman.edu/jbtest/wp-admin/post-new.php?post_type=fellow',
				},
			],
		},
		{
			label: 'Edit Page',
			href: pageOrPostId ? `${adminHref}/post.php?post=${pageOrPostId}&action=edit` : adminHref,
		},
	]);
</script>

<div class:visible>
	<NavigationList {items} />
</div>

<style>
	:host {
		display: contents;
	}

	div {
		height: 32px;
		position: fixed;
		top: 0;
		background: black;
		width: 100%;
		z-index: 1001;
		display: none;
		align-items: center;
		justify-content: space-between;
		padding: 0 12px;
		box-sizing: border-box;
		color-scheme: dark;
	}
	div.visible {
		display: flex;
	}

	:global(.nav-list) {
		gap: 1.25rem !important;
	}

	:global(.nav-list > li > a > span) {
		font-size: 13px;
		padding: 8px 0;
	}
</style>
