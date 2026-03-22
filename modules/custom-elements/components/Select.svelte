<svelte:options
	customElement={{
		props: {
			placeholder: { reflect: true, type: 'String', attribute: 'placeholder' },
			searchPlaceholder: { reflect: true, type: 'String', attribute: 'search-placeholder' },
			multiple: { reflect: true, type: 'Boolean', attribute: 'multiple' },
			closeOnSelect: { reflect: true, type: 'Boolean', attribute: 'close-on-select' },
			style: { reflect: true, type: 'String', attribute: 'style' },
			itemsTextPlural: { reflect: true, type: 'String', attribute: 'items-text-plural' },
			itemsTextSingular: { reflect: true, type: 'String', attribute: 'items-text-singular' },
			variant: { reflect: true, type: 'String', attribute: 'variant' },
		},
	}}
/>

<script lang="ts" module>
	import { untrack } from 'svelte';

	interface ChangeData {
		value: string | null;
		values: string[];
		options: Option[];
	}

	interface Option {
		label: string;
		value: string;
	}

	export interface ComboboxProps {
		/** The text that appears for the field when there is no selection. */
		placeholder?: string;
		/** The text that appears in the dropdown search box. */
		searchPlaceholder?: string;
		/** Whether multiple values may be selected. */
		multiple?: boolean;
		/** Whether the dropdown should close on selection. By default, this is `true` when `multiple` is also `true`. */
		closeOnSelect?: boolean;
		onChange?: (data: ChangeData) => void;
		style?: string;
		/** The current selected options. */
		selectedOptions?: Option[];
		/** The plural form of the type of item for this select element. It is shown when more that one option is selected. Defaults to "items". */
		itemsTextPlural?: string;
		itemsTextSingular?: string;
		variant?: 'default' | 'button' | 'button--white';
	}
</script>

<script lang="ts">
	let {
		placeholder: _placeholder,
		searchPlaceholder: _searchPlaceholder,
		multiple = false,
		closeOnSelect: _closeOnSelect,
		onChange,
		style,
		selectedOptions = $bindable([]),
		itemsTextPlural = 'items',
		itemsTextSingular = 'item',
		variant = 'default',
	}: ComboboxProps = $props();
	const closeOnSelect = $derived(_closeOnSelect ?? !multiple);
	const anOrA = $derived(itemsTextSingular && ['a', 'e', 'i', 'o', 'u'].includes(itemsTextSingular?.[0]?.toLowerCase() || '') ? 'an' : 'a');
	const placeholder = $derived(_placeholder ?? (multiple ? 'Select ' + itemsTextPlural : `Select ${anOrA} ${itemsTextSingular}`));
	const searchPlaceholder = $derived(_searchPlaceholder ?? `Search for ${anOrA} ${itemsTextSingular}`);

	let open: boolean = $state(false);
	let hasOpened: boolean = $state(false);
	let optionsElement: HTMLDivElement | null = $state(null);
	let popoverElement: HTMLDivElement | null = $state(null);
	let filterInputElement: HTMLInputElement | null = $state(null);
	const selectedValues = $derived(selectedOptions.map((option) => option.value));
	let filterValue: string = $state('');
	let noAvailableOptions: boolean = $state(false);

	function updateOptions(filterValue: string) {
		if (filterValue.length <= 1) {
			applyStyles();
		}

		const host = getHost();
		if (!host) {
			return;
		}

		const optionGroupElements = host.querySelectorAll('optgroup');
		const optionElements = host.querySelectorAll('option');

		optionElements.forEach((optionElement) => {
			const value = optionElement.getAttribute('value') || optionElement.textContent || '';

			// hide options that don't match the filter value
			const searchableText = value.toLowerCase() + ' ' + (optionElement.textContent || '').toLowerCase();
			if (searchableText.includes(filterValue.toLowerCase())) {
				optionElement.classList.remove('hidden');
				optionElement.setAttribute('tabindex', '0');
			} else {
				optionElement.classList.add('hidden');
				optionElement.setAttribute('tabindex', '-1');
			}

			// indicate which options are selected
			if (selectedValues.includes(value)) {
				optionElement.setAttribute('selected', 'selected');
			} else {
				optionElement.removeAttribute('selected');
			}

			// register click and keyboard events for selecting/deselecting the option
			optionElement.onclick = () => {
				if (optionElement.classList.contains('hidden')) {
					return;
				}

				if (selectedValues.includes(value)) {
					if (!multiple) {
						selectedOptions = [];
					} else {
						selectedOptions = selectedOptions.filter((option) => option.value !== value);
					}
				} else {
					const option = { label: optionElement.textContent?.trim() || value, value };
					if (!multiple) {
						selectedOptions = [option];
					} else {
						selectedOptions = [...selectedOptions, option];
					}
				}

				if (closeOnSelect) {
					popoverElement?.hidePopover();
				}
			};
			optionElement.onkeydown = (evt) => {
				if (evt.key === 'Enter' || evt.key === ' ') {
					evt.preventDefault();
					optionElement.click();
				}
			};
		});

		// hide option groups that don't have any visible options
		optionGroupElements.forEach((groupElement) => {
			const options = groupElement.querySelectorAll('option');
			const hasVisibleOptions = Array.from(options).some((option) => !option.classList.contains('hidden'));
			if (hasVisibleOptions) {
				groupElement.classList.remove('hidden');
			} else {
				groupElement.classList.add('hidden');
			}
		});

		const visibleOptionElements = host.querySelectorAll('option:not(.hidden)');
		noAvailableOptions = visibleOptionElements.length === 0;
	}

	// re-render the options whenever the filter value or selected values change
	$effect(() => {
		if (open) {
			selectedValues; // track selectedValues changes
			updateOptions(filterValue);
		}
	});

	// when the menu is not open, watch the DOM for changes to the option elements
	let mutationObserver: MutationObserver | null = null;
	function checkOptionElementsChanges() {
		const host = getHost();
		if (!host) {
			return;
		}

		const optionElements = host.querySelectorAll('option');
		const newSelectedOptions: Option[] = [];
		optionElements.forEach((optionElement) => {
			if (optionElement.hasAttribute('selected')) {
				const value = optionElement.getAttribute('value') || optionElement.textContent || '';
				newSelectedOptions.push({ label: optionElement.textContent?.trim() || value, value });
			}
		});

		selectedOptions = newSelectedOptions;
	}
	$effect(() => {
		const host = getHost();
		if (!open && host) {
			if (mutationObserver) {
				mutationObserver.disconnect();
			} else {
				// on the first run, we need to immediately check in addition to waiting for changes
				checkOptionElementsChanges();
			}

			mutationObserver = new MutationObserver(() => {
				checkOptionElementsChanges();
			});

			mutationObserver.observe(host, { subtree: true, childList: true, attributeFilter: ['selected'] });
		}

		return () => {
			if (mutationObserver) {
				mutationObserver.disconnect();
			}
		};
	});

	// dispatch events when the selection changes
	let dispatchEffectHasInitialRun = false;
	$effect(() => {
		selectedOptions; // track selectedOptions changes
		if (dispatchEffectHasInitialRun) {
			untrack(() => dispatchChangeEvent());
		} else {
			dispatchEffectHasInitialRun = true;
		}
	});

	function dispatchChangeEvent() {
		const eventDetail = {
			value: selectedValues[0] || null,
			values: selectedValues,
			options: selectedOptions,
		} satisfies ChangeData;

		const host = getHost();
		if (!host) {
			return;
		}

		if (host.isCustomElement) {
			const event = new CustomEvent('change', {
				detail: eventDetail,
			});
			host.dispatchEvent(event);
		}

		try {
			if (onChange && typeof onChange === 'function') {
				onChange(eventDetail);
			}
		} catch (error) {
			console.error('Error in onChange handler:', error);
		}
	}

	const comboboxId = crypto.randomUUID();

	/**
	 * Injects styles for the options into the host element. This is necessary because
	 * shadow DOM does not allow us to style the children of the host element.
	 */
	function applyStyles() {
		const host = getHost();
		if (!host) {
			console.error('Host element not found. Cannot apply styles.');
			return;
		}

		const style = host.querySelector(`style[data-for='${comboboxId}']`);
		if (!style) {
			const newStyle = document.createElement('style');
			newStyle.setAttribute('data-for', comboboxId);
			newStyle.textContent = `
        [data-id='${comboboxId}'] optgroup {
          font-weight: 600;
          font-size: 12px;
          line-height: 24px;
          margin-top: 8px;
          color: light-dark(rgba(0 0 0 / 0.6), rgba(255 255 255 / 0.6));
        }

        [data-id='${comboboxId}'] option {
          color: light-dark(#111, #e0e0e0);
          position: relative;
          padding: 6px 8px 6px 36px;
          line-height: 1.5;
          height: 36px;
          font-size: 0.9rem;
          display: block;
          align-content: center;
          box-sizing: border-box;
          text-box-trim: trim-both;
          text-box-edge: cap alphabetic;
          cursor: default;
        }
        [data-id='${comboboxId}'] option:hover {
          background-color: var(--hover-bg);
        }
        [data-id='${comboboxId}'] option:active {
          background-color: var(--active-bg);
        }
        [data-id='${comboboxId}'] option:focus-visible {
          box-shadow: 0 0 0 2px var(--shi-adaptive-color--purple);
          outline: none;
        }
        [data-id='${comboboxId}'] option[disabled] {
          opacity: 0.5;
          cursor: not-allowed;
        }

        [data-id='${comboboxId}'] .hidden {
          display: none;
        }

        /* checkmark and radio styles */
        [data-id='${comboboxId}'] option::before, [data-id='${comboboxId}'] option::after {
          content: '';
          position: absolute;
          left: 8px;
          top: 0;
          width: 20px;
          height: 36px;
          mask-image: none;
          mask-position: center;
          mask-size: contain;
          mask-repeat: no-repeat;
          background-color: transparent;
        }
        [data-id='${comboboxId}'] option[selected]::before {
          background-color: light-dark(var(--shi-color-purple), oklch(from var(--shi-color-purple) calc(l + 0.48) calc(c - 0.08) h));
        }
        [data-id='${comboboxId}'].multiple option[selected]::before {
          mask-image: url(data:image/svg+xml,%3Csvg%20width%3D%2224%22%20height%3D%2224%22%20fill%3D%22none%22%20viewBox%3D%220%200%2024%2024%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20%20%20%20d%3D%22m8.5%2016.586-3.793-3.793a1%201%200%200%200-1.414%201.414l4.5%204.5a1%201%200%200%200%201.414%200l11-11a1%201%200%200%200-1.414-1.414L8.5%2016.586Z%22%20%20%20%20fill%3D%22%23ffffff%22%20%2F%3E%3C%2Fsvg%3E);
        }
        [data-id='${comboboxId}']:not(.multiple) option:not([selected])::before {
          /* radio outline */
          mask-image: url(data:image/svg+xml,%3Csvg%20width%3D%2224%22%20height%3D%2224%22%20fill%3D%22none%22%20viewBox%3D%220%200%2024%2024%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M12%2022.002c5.524%200%2010.002-4.478%2010.002-10.001%200-5.524-4.478-10.002-10.002-10.002-5.524%200-10.002%204.478-10.002%2010.002%200%205.523%204.478%2010.001%2010.002%2010.001Zm0-1.5A8.501%208.501%200%201%201%2012%203.5a8.501%208.501%200%200%201%200%2017.003Z%22%20fill%3D%22%23ffffff%22%2F%3E%3C%2Fsvg%3E);
          background-color: light-dark(rgba(0 0 0 / 0.5), rgba(255 255 255 / 0.5));
        }
        [data-id='${comboboxId}']:not(.multiple) option[selected]::before {
          /* radio filled circle */
          mask-image: url("data:image/svg+xml,%3Csvg%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M0%2010C0%204.47715%204.47715%200%2010%200C15.5228%200%2020%204.47715%2020%2010C20%2015.5228%2015.5228%2020%2010%2020C4.47715%2020%200%2015.5228%200%2010Z%22%20fill%3D%22%23FFFFFF%22%20transform%3D%22translate(2%202)%22%20%2F%3E%3C%2Fsvg%3E");
        }
        [data-id='${comboboxId}']:not(.multiple) option[selected]::after {
          /* radio center */
          mask-image: url("data:image/svg+xml,%3Csvg%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M5.998%200C9.3106%204.76837e-07%2011.996%202.6854%2011.996%205.998C11.996%209.3106%209.3106%2011.996%205.998%2011.996C2.6854%2011.996%200%209.3106%200%205.998C4.76837e-07%202.6854%202.6854%204.76837e-07%205.998%204.76837e-07C5.998%204.76837e-07%205.998%200%205.998%200Z%22%20fill%3D%22%23ffffff%22%20transform%3D%22translate(5.999%205.999)%22%20%20%2F%3E%3C%2Fsvg%3E");
          background-color: light-dark(white, black);
        }
      `;
			host.setAttribute('data-id', comboboxId);
			host.appendChild(newStyle);
		}

		if (multiple) {
			host.classList.add('multiple');
		} else {
			host.classList.remove('multiple');
		}
	}

	/**
	 * Gets the host element for the options. When in custom element mode, this will be the custom element itself.
	 * When in non-custom element mode, this will be the options container element.
	 */
	function getHost() {
		if (!optionsElement) {
			console.error('Options element not found');
			return null;
		}

		const slotElem = optionsElement.querySelector('slot');
		if (!slotElem) {
			const element = optionsElement;
			Object.defineProperty(element, 'isCustomElement', {
				value: false,
				configurable: true,
			});
			return element as HTMLDivElement & { isCustomElement: boolean };
		}

		const host = (slotElem.getRootNode() as Node & { host: HTMLElement | undefined }).host;
		if (!host) {
			console.error('Host element not found');
			return null;
		}

		Object.defineProperty(host, 'isCustomElement', {
			value: true,
			configurable: true,
		});
		return host as HTMLElement & { isCustomElement: boolean };
	}
</script>

<div class="select" class:open {style}>
	<button
		class="label"
		popovertarget={comboboxId}
		popovertargetaction="toggle"
		class:variant-button={variant === 'button' || variant.startsWith('button--')}
		class:variant-button--white={variant === 'button--white'}
		role="listbox"
		aria-multiselectable={multiple}
		aria-label={placeholder}
	>
		{selectedOptions.length === 1
			? selectedOptions[0]!.label
			: selectedOptions.length > 0
				? `${selectedOptions.length} ${itemsTextPlural}`
				: placeholder}
		<svg width="16" height="16" viewBox="0 0 24 24">
			<path
				d="M4.293 8.293a1 1 0 0 1 1.414 0L12 14.586l6.293-6.293a1 1 0 1 1 1.414 1.414l-7 7a1 1 0 0 1-1.414 0l-7-7a1 1 0 0 1 0-1.414Z"
				fill="currentColor"
			/>
		</svg>
	</button>
	<div
		class="form"
		class:hasOpened
		inert={!open}
		popover="auto"
		id={comboboxId}
		ontoggle={() => {
			open = !open;
			hasOpened = true;
			setTimeout(() => {
				if (!open) {
					filterValue = '';
				} else {
					filterInputElement?.focus();
				}
			}, 200);
		}}
		onclose={() => {
			open = false;
		}}
		bind:this={popoverElement}
	>
		<input bind:this={filterInputElement} placeholder={searchPlaceholder} type="text" bind:value={filterValue} />
		<div class="actions">
			<button class="action" onclick={() => (selectedOptions = [])}>Clear selection</button>
		</div>
		<div class="options" bind:this={optionsElement} class:multiple>
			<slot />
			{#if noAvailableOptions}
				<div class="no-options">
					There are no available options{filterValue ? ' that match your search' : ''}.
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	:host {
		display: block;
	}

	.select {
		--hover-bg: light-dark(#f0f0f0, #2e2e2e);
		--active-bg: light-dark(#e5e5e5, #383838);
	}

	.label {
		appearance: none;
		font-family: inherit;
		display: flex;
		width: 100%;
		background-color: var(--shi-surface-background-color);
		color: var(--shi-surface-color);
		border: none;
		--box-shadow-color: var(--shi-divider-color);
		box-shadow: inset 0 0 0 1px var(--box-shadow-color);
		height: 38px;
		box-sizing: border-box;
		font-size: 0.85rem;
		align-items: center;
		justify-content: space-between;
		padding: 0 1rem;
		anchor-name: --trigger-button;
	}
	.label:hover {
		background-color: var(--hover-bg);
	}
	.label:active {
		background-color: var(--active-bg);
	}
	.label:focus-visible {
		outline-offset: 0.3rem;
		outline-width: 0.2rem;
	}
	.label.variant-button {
		text-transform: uppercase;
		font-weight: 600;
		font-size: 0.9em;
		@media (min-width: 992px) {
			font-size: 1rem;
		}
	}
	.label.variant-button--white {
		background-color: white;
		--box-shadow-color: white;
		color: black;
	}
	.label.variant-button:hover {
		background-color: var(--shi-color-yellow);
		--box-shadow-color: var(--shi-color-yellow);
		color: var(--shi-color--on-yellow);
		text-decoration: none;
	}
	.label.variant-button:active {
		background-color: var(--shi-color-blue);
		--box-shadow-color: var(--shi-color-blue);
		color: var(--shi-color--on-blue);
	}

	.label svg {
		width: 16px;
		height: 16px;
		vertical-align: middle;
		transition: transform var(--shi-transition-200ms) ease;
	}
	.select.open .label svg {
		transform: rotate(-180deg);
	}

	::slotted(optgroup) {
		background: red;
	}

	.form {
		position-anchor: --trigger-button;
		position: fixed;
		position-area: bottom span-right;
		width: anchor-size(width);
		box-sizing: border-box;
		margin: -1 0 0;
		inset: unset;
		display: block;
		border: 1px solid var(--shi-divider-color);
		background-color: var(--shi-surface-background-color);
		color: var(--shi-surface-color);
		padding: 0;

		transition: overlay var(--shi-transition-200ms) allow-discrete; /* keep layer on top during animation */

		opacity: 0;
		overlay: auto;
		pointer-events: none;

		&:popover-open {
			animation: popover-open var(--shi-transition-200ms) ease forwards;
			pointer-events: auto;
		}

		&.hasOpened:not(:popover-open) {
			animation: popover-close var(--shi-transition-200ms) ease forwards;
		}
	}

	@keyframes popover-open {
		from {
			opacity: 0;
			transform: translateY(-4px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@keyframes popover-close {
		from {
			opacity: 1;
			transform: translateY(0);
		}
		to {
			opacity: 0;
			transform: translateY(-4px);
		}
	}

	input {
		width: calc(100% - 16px);
		box-sizing: border-box;
		padding: 8px;
		border: 1px solid var(--shi-divider-color);
		background-color: transparent;
		height: 38px;
		box-sizing: border-box;
		margin: 8px 8px 0;
		font-family: inherit;
	}
	input:focus {
		outline: none;
		box-shadow: 0 0 0 2px var(--shi-adaptive-color--purple);
	}

	.options {
		max-height: min(calc(100vh - 42px), 300px);
		overflow: auto;
		padding: 8px;
		box-sizing: border-box;
	}

	.no-options {
		font-size: 0.9rem;
		color: var(--shi-surface-color);
		padding: 8px;
	}

	.actions {
		display: flex;
		gap: 8px;
		margin: 8px 8px 0;
	}

	button.action {
		appearance: none;
		font-family: inherit;
		border: none;
		padding: 2px 0.75rem 0;
		font-size: 0.85rem;
		line-height: 1.5;
		text-decoration: none;
		text-transform: uppercase;
		font-weight: 600;
		user-select: none;
		box-sizing: border-box;
		transition:
			background-color var(--shi-transition-120ms) ease,
			box-shadow var(--shi-transition-120ms) ease;
		min-height: 32px;
		display: inline-flex;
		align-items: center;
		background-color: var(--shi-surface-background-color);
		--box-shadow-color: var(--shi-divider-color);
		box-shadow: inset 0 0 0 1px var(--box-shadow-color);
		color: var(--shi-surface-color);
	}
	button.action:hover {
		background-color: var(--shi-color-yellow);
		--box-shadow-color: var(--shi-color-yellow);
		color: var(--shi-color--on-yellow);
		text-decoration: none;
	}
	button.action:active {
		background-color: var(--shi-color-blue);
		--box-shadow-color: var(--shi-color-blue);
		color: var(--shi-color--on-blue);
	}
	button.action:focus-visible {
		outline: none;
		box-shadow: 0 0 0 2px var(--shi-adaptive-color--purple);
	}
</style>
