import { v4 as uuidv4 } from 'uuid';
import type { EquipmentResourceKind } from './types/db.js';

export const EQUIPMENT_RESOURCE_KINDS: EquipmentResourceKind[] = [
	'owners_manual',
	'service_manual',
	'repair_order',
	'invoice',
	'other'
];

export function parseResourceKind(value: string | null | undefined): EquipmentResourceKind {
	if (!value) return 'other';
	return EQUIPMENT_RESOURCE_KINDS.includes(value as EquipmentResourceKind)
		? (value as EquipmentResourceKind)
		: 'other';
}

const ALLOWED_MIME_EXACT = new Set(
	[
		'application/pdf',
		'text/plain',
		'text/markdown',
		'application/rtf',
		'text/rtf',
		'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
		'application/msword'
	].map((m) => m.toLowerCase())
);

export function isAllowedEquipmentResourceMime(mime: string): boolean {
	const m = mime.toLowerCase().split(';')[0].trim();
	if (ALLOWED_MIME_EXACT.has(m)) return true;
	if (m === 'text/csv') return true;
	return false;
}

export function safeResourceFilename(original: string): string {
	const ext = original.includes('.') ? original.slice(original.lastIndexOf('.')) : '';
	const base = uuidv4();
	return `${base}${ext.toLowerCase()}`;
}
