import { Hono } from 'jsr:@hono/hono';
import { Router } from './router/mod.ts';

Deno.bench('Relax', { group: 'routers', baseline: true }, async () => {
	const router = new Router();

	router.get('*', async (_request, _groups, _data, next) => void await next());
	router.get('/', () => new Response('Home'));
	router.get('/about', () => new Response('About'));
	router.get('/posts/:id', (_request, { id }) => new Response(`Post: ${id}`));

	await router.handle(new Request(import.meta.resolve('/')));
	await router.handle(new Request(import.meta.resolve('/about')));
	await router.handle(new Request(import.meta.resolve('/posts/1')));
	await router.handle(new Request(import.meta.resolve('/non-existent')));
});

Deno.bench('Hono', { group: 'routers' }, async () => {
	const router = new Hono();

	router.get('*', async (_context, next) => await next());
	router.get('/', () => new Response('Home'));
	router.get('/about', () => new Response('About'));
	router.get(
		'/posts/:id',
		({ req }) => new Response(`Post: ${req.param('id')}`),
	);

	await router.fetch(new Request(import.meta.resolve('/')));
	await router.fetch(new Request(import.meta.resolve('/about')));
	await router.fetch(new Request(import.meta.resolve('/posts/1')));
	await router.fetch(new Request(import.meta.resolve('/non-existent')));
});
