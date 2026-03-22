import type { EquipmentResource } from './types/db.js';

const PREVIEW_LEN = 500;

export type EquipmentResourceClient = Omit<EquipmentResource, 'extracted_text'> & {
	text_preview: string | null;
};

export function toEquipmentResourceClient(row: EquipmentResource): EquipmentResourceClient {
	const { extracted_text: full, ...rest } = row;
	const text_preview =
		full && full.length > 0
			? full.length <= PREVIEW_LEN
				? full
				: `${full.slice(0, PREVIEW_LEN)}…`
			: null;
	return { ...rest, text_preview };
}
