<svelte:options customElement={{}} />

<script lang="ts" module>
	type Color = {
		backgroundColor: string;
		color: string;
	};

	export interface SearchProps {
		placeholder?: string;
		styles?: Partial<{
			base: Color;
			hover: Color;
			active: Color;
			focus: Color & { boxShadow?: string };
			submitHover: Color;
			submitActive: Color;
			submitFocus: Color;
		}>;
		initialWidth?: string;
		focusedWidth?: string;
	}
</script>

<script lang="ts">
	const defaultStyles = {
		base: {
			backgroundColor: 'light-dark(var(--shi-color-near-white), #383838)',
			color: 'light-dark(var(--shi-color-black), #e0e0e0)',
		},
		hover: {
			backgroundColor: 'var(--shi-color-purple)',
			color: 'var(--shi-color--on-purple)',
		},
		active: {
			backgroundColor: 'var(--shi-color-midnight)',
			color: 'var(--shi-color--on-midnight)',
		},
		focus: {
			backgroundColor: 'var(--shi-color-purple)',
			color: 'var(--shi-color--on-purple)',
		},
		submitHover: {
			backgroundColor: 'var(--shi-color-blue)',
			color: 'var(--shi-color--on-blue)',
		},
		submitActive: {
			backgroundColor: 'hsla(193, 60%, 70%, 1.00)',
			color: 'var(--shi-color--on-blue)',
		},
		submitFocus: {
			backgroundColor: 'var(--shi-color-blue)',
			color: 'var(--shi-color--on-blue)',
		},
	} satisfies SearchProps['styles'];

	let { placeholder = 'Search', styles = defaultStyles, initialWidth = '112px', focusedWidth = '246px' }: SearchProps = $props();

	let searchValue = $state('');
	const searchPath = '/';

	/**
	 * Handles form submission.
	 *
	 * If the search input is empty, it prevents submission.
	 */
	function handleSubmit(event: Event) {
		event.preventDefault();

		const search = searchValue.trim();
		if (search) {
			const searchUrl = `${searchPath}?s=${encodeURIComponent(search)}`;
			window.location.href = searchUrl;
		}
	}
</script>

<div class="search-wrapper" style:--initial-width={initialWidth} style:--focused-width={focusedWidth}>
	<form
		action={searchPath}
		method="get"
		onsubmit={handleSubmit}
		style:--background-color--base={styles.base?.backgroundColor || defaultStyles.base.backgroundColor}
		style:--color--base={styles.base?.color || defaultStyles.base.color}
		style:--background-color--hover={styles.hover?.backgroundColor || defaultStyles.hover.backgroundColor}
		style:--color--hover={styles.hover?.color || defaultStyles.hover.color}
		style:--background-color--active={styles.active?.backgroundColor || defaultStyles.active.backgroundColor}
		style:--color--active={styles.active?.color || defaultStyles.active.color}
		style:--background-color--focus={styles.focus?.backgroundColor || defaultStyles.focus.backgroundColor}
		style:--color--focus={styles.focus?.color || defaultStyles.focus.color}
		style:--box-shadow--focus={styles.focus?.boxShadow || 'none'}
		style:--background-color--submit-hover={styles.submitHover?.backgroundColor || defaultStyles.submitHover.backgroundColor}
		style:--color--submit-hover={styles.submitHover?.color || defaultStyles.submitHover.color}
		style:--background-color--submit-active={styles.submitActive?.backgroundColor || defaultStyles.submitActive.backgroundColor}
		style:--color--submit-active={styles.submitActive?.color || defaultStyles.submitActive.color}
		style:--background-color--submit-focus={styles.submitFocus?.backgroundColor || defaultStyles.submitFocus.backgroundColor}
		style:--color--submit-focus={styles.submitFocus?.color || defaultStyles.submitFocus.color}
	>
		<input name="s" {placeholder} type="text" bind:value={searchValue} />
		<button type="submit" title="Search">
			<svg aria-label="Search icon" viewBox="0 0 512 512">
				<path
					d="M500.3 443.7l-119.7-119.7c27.22-40.41 40.65-90.9 33.46-144.7C401.8 87.79 326.8 13.32 235.2 1.723C99.01-15.51-15.51 99.01 1.724 235.2c11.6 91.64 86.08 166.7 177.6 178.9c53.8 7.189 104.3-6.236 144.7-33.46l119.7 119.7c15.62 15.62 40.95 15.62 56.57 0C515.9 484.7 515.9 459.3 500.3 443.7zM79.1 208c0-70.58 57.42-128 128-128s128 57.42 128 128c0 70.58-57.42 128-128 128S79.1 278.6 79.1 208z"
				>
				</path>
			</svg>
		</button>
	</form>
</div>

<style>
	.search-wrapper {
		display: flex;
		align-items: center;
		width: var(--initial-width);
		transition: width 200ms ease-in-out;
	}

	.search-wrapper:has(input:hover),
	.search-wrapper:has(input:active),
	.search-wrapper:has(input:focus) {
		width: var(--focused-width);
	}

	form {
		position: relative;
		width: 100%;
		margin: 0;
	}

	input {
		background-color: var(--background-color--base);
		color: var(--color--base);
		padding: 1px 16px;
		height: 36px;
		border: none;
		border-radius: 24px;
		width: 100%;
		transition:
			width 200ms ease-in-out,
			background-color 120ms ease,
			color 120ms ease,
			box-shadow 120ms ease;
		font-family: 'Epilogue', sans-serif;
		font-size: 0.95rem;
		font-weight: 400;
		padding-right: 42px; /* space for the search button */
		box-sizing: border-box;
	}
	input::placeholder {
		color: var(--color--base);
	}

	input:hover {
		background-color: var(--background-color--hover);
		color: var(--color--hover);
	}
	input:hover::placeholder {
		color: var(--color--hover);
	}

	input:focus {
		background-color: var(--background-color--focus);
		color: var(--color--focus);
		outline: none;
		box-shadow: var(--box-shadow--focus);
	}
	input:focus::placeholder {
		color: var(--color--focus);
	}

	input:active {
		background-color: var(--background-color--active);
		color: var(--color--active);
	}
	input:active::placeholder {
		color: var(--color--active);
	}

	button {
		position: absolute;
		height: 36px;
		width: 42px;
		border-radius: 0 16px 16px 0;
		top: 0;
		right: 0;
		background: none;
		border: none;
		padding: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: 120ms ease;
		color: var(--color--base);
	}
	button svg {
		width: 16px;
		height: 16px;
		fill: currentColor;
		margin-right: 4px;
		margin-top: -2px;
	}

	form:hover button {
		color: var(--color--hover);
	}
	button:hover {
		background-color: var(--background-color--submit-hover);
		color: var(--color--submit-hover) !important;
	}

	form:focus-within button {
		color: var(--color--focus);
	}
	button:focus {
		background-color: var(--background-color--submit-focus);
		color: var(--color--submit-focus) !important;
	}

	form:active button {
		color: var(--color--active);
	}
	button:active {
		background-color: var(--background-color--submit-active);
		color: var(--color--submit-active) !important;
	}
</style>
