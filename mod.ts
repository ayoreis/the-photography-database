import { Router } from './router.ts';

const router = new Router({});

router.get('/*', async (_request, _group, _data, next) => {
	console.log('/ middleware started, next');
	await next();
	console.log('/ middleware finished');
});

router.get('/a/*', async (_request, _group, _data, next) => {
	console.log('/a/* middleware started, next\n');
	await next();
	console.log('/a/* middleware finished');
});

router.get('/:x/*', async (_request, _group, _data, next) => {
	console.log('/:x/* middleware called, next');
	await next();
	console.log('/:x/* middleware finished');
});

router.not_found('*', () => {
	return new Response('Page not found, 404', { status: 404 });
});

router.get('/a/b', () => new Response(`Hello world!`));
router.get('/a/:name', (_request, { name }) => new Response(`Hello ${name}!`));

Deno.serve(async (request: Request) => await router.handle(request));
