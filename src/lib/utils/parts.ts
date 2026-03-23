/**
 * maintenance_logs.parts_used is stored as JSON text. Writers typically store JSON.stringify(string[]).
 * Some paths may double-encode or pass objects; this normalizes to display-safe string[].
 */
export function normalizePartsUsed(raw: unknown): string[] {
	if (raw == null || raw === '') return [];

	let value: unknown = raw;
	if (typeof value === 'string') {
		const rawStr = value;
		try {
			value = JSON.parse(rawStr);
		} catch {
			const s = rawStr.trim();
			return s ? [s] : [];
		}
	}

	while (typeof value === 'string') {
		const t = value.trim();
		if (!t) return [];
		if (t.startsWith('[') || t.startsWith('{')) {
			try {
				value = JSON.parse(t);
			} catch {
				return [t];
			}
		} else {
			return [t];
		}
	}

	if (!Array.isArray(value)) {
		if (value && typeof value === 'object') {
			const s = formatPartRecord(value as Record<string, unknown>);
			return s ? [s] : [];
		}
		return value != null && value !== '' ? [String(value)] : [];
	}

	return value.map(coercePartToString).filter((s) => s.length > 0);
}

function coercePartToString(item: unknown): string {
	if (item == null) return '';
	if (typeof item === 'string') return item.trim();
	if (typeof item === 'number' || typeof item === 'boolean') return String(item);
	if (typeof item === 'object') {
		return formatPartRecord(item as Record<string, unknown>);
	}
	return String(item);
}

function formatPartRecord(o: Record<string, unknown>): string {
	if (typeof o.name === 'string') {
		const qty = o.quantity != null ? ` × ${String(o.quantity)}` : '';
		return `${o.name}${qty}`.trim();
	}
	if (typeof o.part === 'string') {
		return o.part.trim();
	}
	return JSON.stringify(o);
}
