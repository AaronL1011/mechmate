import { error } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { env } from '$env/dynamic/public';
import QRCode from 'qrcode';
import { equipmentRepository } from '$lib/repositories.js';

function resolvePublicOrigin(url: URL, request: Request): string {
	const configured = env.PUBLIC_APP_URL?.trim();
	if (configured) {
		try {
			return new URL(configured).origin;
		} catch {
			// invalid URL, fall through to request-derived origin
		}
	}
	const forwardedProto = request.headers.get('x-forwarded-proto');
	const forwardedHost = request.headers.get('x-forwarded-host');
	if (forwardedProto && forwardedHost) {
		const host = forwardedHost.split(',')[0].trim();
		const proto = forwardedProto.split(',')[0].trim();
		return `${proto}://${host}`;
	}
	return url.origin;
}

export const GET: RequestHandler = async ({ params, url, locals, request }) => {
	if (!params.id) {
		throw error(400, 'Equipment ID is required');
	}

	const id = parseInt(params.id, 10);
	if (isNaN(id)) {
		throw error(400, 'Invalid equipment ID');
	}

	const equipment = await equipmentRepository.getById(locals.db, id);
	if (!equipment) {
		throw error(404, 'Equipment not found');
	}

	const sizeParam = url.searchParams.get('size');
	let width = 200;
	if (sizeParam !== null) {
		const parsed = parseInt(sizeParam, 10);
		if (!isNaN(parsed)) {
			width = Math.min(512, Math.max(64, parsed));
		}
	}

	const origin = resolvePublicOrigin(url, request);
	const historyUrl = `${origin}/equipment/${id}/history`;

	let buffer: Buffer;
	try {
		buffer = await QRCode.toBuffer(historyUrl, {
			type: 'png',
			width,
			margin: 2,
			errorCorrectionLevel: 'M'
		});
	} catch (err) {
		console.error('QR generation failed:', err);
		throw error(500, 'Failed to generate QR code');
	}

	return new Response(new Uint8Array(buffer), {
		headers: {
			'Content-Type': 'image/png',
			'Cache-Control': 'public, max-age=3600'
		}
	});
};
