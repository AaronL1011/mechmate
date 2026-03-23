import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, url }) => {
	const base = url.origin;
	const agentChatUrl = new URL('/api/agent/chat', base);
	const res = await fetch(agentChatUrl.toString(), {
		method: 'POST',
		headers: request.headers,
		body: request.body
	});
	const data = await res.json().catch(() => ({}));
	return new Response(JSON.stringify(data), {
		status: res.status,
		headers: { 'Content-Type': 'application/json' }
	});
};
