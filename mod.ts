import { Router } from './router.ts';

type Renderer = (slot: string) => Response;
type Data = { render: Renderer };

function render(slot: string) {
	return new Response(slot, { headers: { 'Content-Type': 'text/html' } });
}

const router = new Router<Data>({ render });

router.get('*', async (_request, _group, { render }, next) => {
	await next({
		render: (slot) => render(`<home-page>${slot}</home-page>`),
	});
});

router.get('/', async (_request, _group, { render }) => {
	return render('Hello world');
});

router.not_found('*', async (_request, _group, { render }) => {
	return render('Page not found');
});

Deno.serve((request) => router.handle(request));
