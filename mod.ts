import { STATUS_CODE, StatusCode } from 'jsr:@std/http/status';
import { Router } from 'relax/router/mod.ts';
import { file_system } from 'relax/router/file_system.ts';

function render(slot: string, status: StatusCode = STATUS_CODE.OK) {
	return new Response(slot, {
		status,
		headers: { 'Content-Type': 'text/html' },
	});
}

export const router = new Router({ render });

await file_system(router);

Deno.serve((request) => router.handle(request));
