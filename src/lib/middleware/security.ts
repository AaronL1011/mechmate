// Security middleware for Mechmate
import type { RequestEvent } from '@sveltejs/kit';
import { error } from '@sveltejs/kit';
import { getConfig } from '../config.js';

// Rate limiting store (in production, use Redis or database)
interface RateLimitEntry {
	count: number;
	resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up expired entries periodically
setInterval(() => {
	const now = Date.now();
	for (const [key, entry] of rateLimitStore.entries()) {
		if (now > entry.resetTime) {
			rateLimitStore.delete(key);
		}
	}
}, 60000); // Clean up every minute

export async function applyRateLimit(event: RequestEvent): Promise<void> {
	const config = getConfig();

	if (!config.RATE_LIMIT_ENABLED) {
		return;
	}

	// Get client identifier (IP address + user agent for better uniqueness)
	const clientIp = getClientIP(event);
	const userAgent = event.request.headers.get('user-agent') || 'unknown';
	const clientKey = `${clientIp}:${hashString(userAgent)}`;

	const now = Date.now();
	const windowMs = config.RATE_LIMIT_WINDOW_MS;
	const maxRequests = config.RATE_LIMIT_MAX_REQUESTS;

	let entry = rateLimitStore.get(clientKey);

	if (!entry || now > entry.resetTime) {
		// Create new entry or reset expired entry
		entry = {
			count: 1,
			resetTime: now + windowMs
		};
		rateLimitStore.set(clientKey, entry);
		return;
	}

	// Increment request count
	entry.count++;

	if (entry.count > maxRequests) {
		// Rate limit exceeded
		const retryAfter = Math.ceil((entry.resetTime - now) / 1000);

		throw error(429, `Too many requests. Try again in ${retryAfter} seconds.`);
	}

	// Update the entry
	rateLimitStore.set(clientKey, entry);
}

export function addSecurityHeaders(response: Response): Response {
	// Security headers for production
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('X-XSS-Protection', '1; mode=block');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

	// Content Security Policy
	const csp = [
		"default-src 'self'",
		"script-src 'self' 'unsafe-inline' 'unsafe-eval'", // SvelteKit needs unsafe-inline and unsafe-eval
		"style-src 'self' 'unsafe-inline'", // Tailwind needs unsafe-inline
		"img-src 'self' data: blob:",
		"font-src 'self' data:",
		"connect-src 'self'",
		"media-src 'self'",
		"object-src 'none'",
		"base-uri 'self'",
		"form-action 'self'",
		"frame-ancestors 'none'",
		'upgrade-insecure-requests'
	].join('; ');

	response.headers.set('Content-Security-Policy', csp);

	return response;
}

// Get client IP address with proxy support
function getClientIP(event: RequestEvent): string {
	// Check for forwarded headers (from reverse proxies)
	const forwarded = event.request.headers.get('x-forwarded-for');
	if (forwarded) {
		// Take the first IP from the comma-separated list
		return forwarded.split(',')[0].trim();
	}

	const realIp = event.request.headers.get('x-real-ip');
	if (realIp) {
		return realIp;
	}

	// Fallback to connection info
	return event.getClientAddress() || 'unknown';
}

// Simple hash function for user agent strings
function hashString(str: string): string {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		const char = str.charCodeAt(i);
		hash = (hash << 5) - hash + char;
		hash = hash & hash; // Convert to 32-bit integer
	}
	return Math.abs(hash).toString(36);
}

// Request validation helpers
export function validateContentType(event: RequestEvent, allowedTypes: string[]): boolean {
	const contentType = event.request.headers.get('content-type');
	if (!contentType) return false;

	return allowedTypes.some((type) => contentType.includes(type));
}

export function validateContentLength(event: RequestEvent, maxSizeBytes: number): boolean {
	const contentLength = event.request.headers.get('content-length');
	if (!contentLength) return true; // No content-length header is okay

	const size = parseInt(contentLength, 10);
	return !isNaN(size) && size <= maxSizeBytes;
}

// CORS helper
export function applyCORS(event: RequestEvent, response: Response): Response {
	const config = getConfig();

	if (!config.CORS_ENABLED) {
		return response;
	}

	const origin = event.request.headers.get('origin');
	const allowedOrigin = config.CORS_ORIGIN || '*';

	if (allowedOrigin === '*' || origin === allowedOrigin) {
		response.headers.set('Access-Control-Allow-Origin', allowedOrigin);
		response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
		response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
		response.headers.set('Access-Control-Max-Age', '86400'); // 24 hours
	}

	return response;
}
