import { assertEquals } from 'jsr:@std/assert';
import { Router } from './router/mod.ts';

const router = new Router();

const response_index = new Response();
const response_not_found = new Response(null, { status: 404 });

Deno.test("Doesn't leak handlers", async () => {
	router.get('/', () => response_index);
	router.all('*', () => response_not_found);

	const response = await router.handle(
		new Request(import.meta.resolve('/non-existent-route')),
	);

	assertEquals(response, response_not_found);
});
