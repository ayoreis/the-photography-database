import { MaybeArray } from 'relax/types.ts';
import type { Router } from './mod.ts';
import type {
	Callback,
	DataConstraint,
	Handler,
	Method,
	Middleware,
} from './types.ts';

import type { router } from '_/mod.ts';

interface Route<Data> {
	method: Method;
	callback: Callback<Data>;
}

function helper(method: Method) {
	type Data = typeof router extends Router<infer Data> ? Data : never;

	function helper(middleware: Middleware<Data>): Route<Data>;
	function helper(handler: Handler<Data>): Route<Data>;
	function helper(callback: Callback<Data>) {
		return { method, callback };
	}

	return helper;
}

const DIRECTORY = 'routes';

export const get = helper('GET');
export const head = helper('HEAD');
export const post = helper('POST');
export const put = helper('PUT');
export const delete_helper = helper('DELETE');
export const connect = helper('CONNECT');
export const options = helper('OPTIONS');
export const trace = helper('TRACE');
export const patch = helper('PATCH');

async function _file_system<Data extends DataConstraint>(
	router: Router<Data>,
	parent = '',
) {
	for await (const entry of Deno.readDir(`${DIRECTORY}/${parent}`)) {
		if (!entry.isFile) {
			await _file_system(router, `${parent}/${entry.name}`);

			continue;
		}

		const path = `../${DIRECTORY}${parent}/${entry.name}`;
		const route_export: MaybeArray<Route<Data>> = (await import(path)).default;
		const routes = Array.isArray(route_export) ? route_export : [route_export];
		const name = entry.name.slice(0, entry.name.lastIndexOf('.'));

		const pattern = name === 'index'
			? parent
			: name === 'not_found'
			? `${parent}/*`
			: `${parent}/${name}`;

		for (const route of routes) {
			const method = route.method.toLowerCase() as Lowercase<
				typeof route.method
			>;

			router[method](pattern, route.callback);
		}
	}
}

export async function file_system<Data extends DataConstraint>(
	router: Router<Data>,
) {
	return await _file_system(router);
}
