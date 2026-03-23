import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';
import type { EquipmentResourceExtractionStatus } from '../types/db.js';

export const MAX_STORED_EXTRACTED_CHARS = 400_000;

export interface ExtractionOutcome {
	status: EquipmentResourceExtractionStatus;
	text: string | null;
	text_truncated: boolean;
	errorMessage?: string;
}

function normalizeWhitespace(text: string): string {
	return text
		.replace(/\r\n/g, '\n')
		.replace(/\r/g, '\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
}

function capText(text: string): { text: string; truncated: boolean } {
	if (text.length <= MAX_STORED_EXTRACTED_CHARS) {
		return { text, truncated: false };
	}
	return {
		text: text.slice(0, MAX_STORED_EXTRACTED_CHARS),
		truncated: true
	};
}

export async function extractTextFromBuffer(
	buffer: Buffer,
	mimeRaw: string
): Promise<ExtractionOutcome> {
	const mime = mimeRaw.toLowerCase().split(';')[0].trim();

	try {
		if (mime === 'text/plain' || mime === 'text/markdown' || mime === 'text/csv') {
			const raw = buffer.toString('utf8');
			const normalized = normalizeWhitespace(raw);
			if (!normalized) {
				return { status: 'skipped', text: null, text_truncated: false };
			}
			const { text, truncated } = capText(normalized);
			return { status: 'ok', text, text_truncated: truncated };
		}

		if (mime === 'application/rtf' || mime === 'text/rtf') {
			const raw = buffer.toString('utf8');
			const normalized = normalizeWhitespace(raw);
			if (normalized.length < 20) {
				return { status: 'skipped', text: null, text_truncated: false };
			}
			const { text, truncated } = capText(normalized);
			return { status: 'ok', text, text_truncated: truncated };
		}

		if (mime === 'application/pdf') {
			const parser = new PDFParse({ data: buffer });
			try {
				const textResult = await parser.getText();
				const normalized = normalizeWhitespace(textResult.text || '');
				if (!normalized) {
					return { status: 'skipped', text: null, text_truncated: false };
				}
				const { text, truncated } = capText(normalized);
				return { status: 'ok', text, text_truncated: truncated };
			} finally {
				await parser.destroy();
			}
		}

		if (
			mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
			mime === 'application/msword'
		) {
			const result = await mammoth.extractRawText({ buffer });
			const normalized = normalizeWhitespace(result.value || '');
			if (!normalized) {
				return { status: 'skipped', text: null, text_truncated: false };
			}
			const { text, truncated } = capText(normalized);
			return { status: 'ok', text, text_truncated: truncated };
		}

		return { status: 'skipped', text: null, text_truncated: false };
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Unknown extraction error';
		return {
			status: 'failed',
			text: null,
			text_truncated: false,
			errorMessage: message
		};
	}
}
