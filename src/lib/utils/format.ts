export function formatDate(dateString: string): string {
	return new Date(dateString).toLocaleDateString('en-US', {
		year: 'numeric',
		month: 'long',
		day: 'numeric'
	});
}

export function formatCurrency(amount: number | null): string {
	if (amount === null || amount === undefined) return 'N/A';
	return new Intl.NumberFormat('en-US', {
		style: 'currency',
		currency: 'USD'
	}).format(amount);
}

export function formatShortDate(dateString: string): string {
	return new Date(dateString).toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric'
	});
}

/** Relative day label e.g. "3 days ago" for timeline scan lines */
export function formatRelativeDay(dateString: string): string {
	const start = new Date(dateString);
	start.setHours(0, 0, 0, 0);
	const now = new Date();
	now.setHours(0, 0, 0, 0);
	const diffDays = Math.round((start.getTime() - now.getTime()) / 86400000);
	const rtf = new Intl.RelativeTimeFormat('en-US', { numeric: 'auto' });
	return rtf.format(diffDays, 'day');
}
