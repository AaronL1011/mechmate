/** @type {import('tailwindcss').Config} */
import typography from '@tailwindcss/typography';

export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	darkMode: 'media', // Enable dark mode based on system preference
	theme: {
		extend: {}
	},
	plugins: [typography]
};
