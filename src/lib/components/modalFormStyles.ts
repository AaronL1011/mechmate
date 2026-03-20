/** Shared Tailwind classes for modal forms — single place to tweak field styling. */

export const labelClass =
	'block text-sm font-medium text-gray-700 dark:text-gray-300';

const inputFieldCore =
	'block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder:text-gray-500';

export const inputClass = `mt-1 ${inputFieldCore}`;

/** Same as input fields without top margin (e.g. inside horizontal flex rows). */
export const inputFieldClass = inputFieldCore;

export const selectClass =
	'mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white';

export const textareaClass =
	'mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder:text-gray-500';

export const errorAlertClass =
	'rounded-md border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20';

export const errorTextClass = 'text-sm text-red-800 dark:text-red-200';

/** Input with adjacent suffix/prefix (flex row) */
export const inputAffixInputClass =
	'flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder:text-gray-500';

export const inputAffixAddonClass =
	'inline-flex shrink-0 items-center border border-gray-300 bg-gray-50 px-3 text-sm text-gray-500 dark:border-gray-600 dark:bg-gray-600 dark:text-gray-400';

export const affixRowClass = 'mt-1 flex rounded-md shadow-sm';

export const affixInputLeftClass =
	'flex-1 rounded-l-md border border-r-0 border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder:text-gray-500';

export const affixAddonRightClass =
	'inline-flex shrink-0 items-center rounded-r-md border border-l-0 border-gray-300 bg-gray-50 px-3 text-sm text-gray-500 dark:border-gray-600 dark:bg-gray-600 dark:text-gray-400';

export const affixAddonLeftClass =
	'inline-flex shrink-0 items-center rounded-l-md border border-r-0 border-gray-300 bg-gray-50 px-3 text-sm text-gray-500 dark:border-gray-600 dark:bg-gray-600 dark:text-gray-400';

export const affixInputRightClass =
	'flex-1 rounded-r-md border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder:text-gray-500';

export const modalFooterClass =
	'shrink-0 border-t border-gray-100 bg-white pt-4 dark:border-gray-700 dark:bg-gray-800';

export const footerButtonRowClass =
	'flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3';

export const btnCancelClass =
	'w-full rounded-md border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:w-auto dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600';

export const btnPrimaryClass =
	'w-full rounded-md border border-transparent bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto dark:bg-blue-700 dark:hover:bg-blue-600';

export const detailsSummaryClass =
	'flex cursor-pointer list-none items-center gap-2 text-sm font-medium text-gray-700 marker:hidden dark:text-gray-300 [&::-webkit-details-marker]:hidden';

export const responsiveTwoColGridClass = 'grid grid-cols-1 gap-4 sm:grid-cols-2';
