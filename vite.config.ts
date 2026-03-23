import tailwindcss from '@tailwindcss/vite';
import devtoolsJson from 'vite-plugin-devtools-json';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit(), devtoolsJson(), basicSsl()]
});
