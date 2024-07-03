import { STATUS_CODE } from 'jsr:@std/http/status';
import type {
	Callback,
	DataConstraint,
	Handler,
	Method,
	Middleware,
} from './types.ts';
import { URLPatternList } from './url_pattern_list.ts';
import { MaybePromise } from '../types.ts';

interface MiddlewareEntry<Data> {
	type: 'middleware';
	callback: Middleware<Data>;
}

interface HandlerEntry<Data> {
	type: 'handler';
	callback: Handler<Data>;
}

type Entry<Data> =
	| MiddlewareEntry<Data>
	| HandlerEntry<Data>;

interface Routes<Data> {
	entries: Map<URLPattern, Entry<Data>>;
	url_pattern_list: URLPatternList | null;
}

interface Helper<Data extends DataConstraint> {
	(pattern: Pattern, middleware: Middleware<Data>): Router<Data>;
	(pattern: Pattern, handler: Handler<Data>): Router<Data>;
}

type Pattern = string | URLPattern;

function is_middleware<Data>(
	callback: Callback<Data>,
): callback is Middleware<Data> {
	return callback.length > 3;
}

declare const DATA_BRAND: unique symbol;
type DataDefault = DataConstraint;
type DataBrand = { [DATA_BRAND]: 'I have a bad feeling about this' };
type DataBrandedDefault = DataDefault & DataBrand;

export class Router<Data extends DataDefault = DataBrandedDefault> {
	#routes: Record<Method, Routes<Data>> = {
		GET: { entries: new Map(), url_pattern_list: null },
		HEAD: { entries: new Map(), url_pattern_list: null },
		POST: { entries: new Map(), url_pattern_list: null },
		PUT: { entries: new Map(), url_pattern_list: null },
		DELETE: { entries: new Map(), url_pattern_list: null },
		CONNECT: { entries: new Map(), url_pattern_list: null },
		OPTIONS: { entries: new Map(), url_pattern_list: null },
		TRACE: { entries: new Map(), url_pattern_list: null },
		PATCH: { entries: new Map(), url_pattern_list: null },
	};

	#default_data: Data;

	constructor(...[data]: Data extends DataBrand ? [] : [Data]) {
		// @ts-ignore weird stuff
		this.#default_data = data ?? {};
	}

	#add_route(
		route: Routes<Data>,
		pattern: Pattern,
		callback: Callback<Data>,
	) {
		const url_pattern = typeof pattern === 'string'
			? new URLPattern({ pathname: pattern })
			: pattern;

		if (is_middleware(callback)) {
			route.entries.set(url_pattern, { type: 'middleware', callback });
		} else {
			route.entries.set(url_pattern, { type: 'handler', callback });
		}

		route.url_pattern_list = null;

		return this;
	}

	all: Helper<Data> = (pattern, callback) => {
		for (const route of Object.values(this.#routes)) {
			this.#add_route(route, pattern, callback);
		}

		return this;
	};

	get: Helper<Data> = this.#add_route.bind(this, this.#routes.GET);
	head: Helper<Data> = this.#add_route.bind(this, this.#routes.HEAD);
	post: Helper<Data> = this.#add_route.bind(this, this.#routes.POST);
	put: Helper<Data> = this.#add_route.bind(this, this.#routes.PUT);
	delete: Helper<Data> = this.#add_route.bind(this, this.#routes.DELETE);
	connect: Helper<Data> = this.#add_route.bind(this, this.#routes.CONNECT);
	options: Helper<Data> = this.#add_route.bind(this, this.#routes.OPTIONS);
	trace: Helper<Data> = this.#add_route.bind(this, this.#routes.TRACE);
	patch: Helper<Data> = this.#add_route.bind(this, this.#routes.PATCH);

	async handle(request: Request) {
		const method = request.method as Method;
		const route = this.#routes[method];
		const { pathname } = new URL(request.url);
		let handler!: (data: Data) => MaybePromise<Response>;

		route.url_pattern_list = new URLPatternList(route.entries.keys());

		for (const { pattern, groups } of route.url_pattern_list.exec(pathname)) {
			const { type, callback } = route.entries.get(pattern)!;

			switch (type) {
				case 'middleware': {
					const previous_handler = handler;
					let has_run = false;

					handler = async (data) => {
						const { promise, resolve } = Promise.withResolvers<Response>();

						const response = await callback(
							request,
							groups,
							data,
							async (new_data) => {
								if (has_run) {
									throw new Error('Can only run next once');
								}

								const response = await previous_handler({
									...data,
									...new_data,
								});

								resolve(response);
								has_run = true;

								return response;
							},
						);

						return response ?? await promise;
					};

					break;
				}

				case 'handler': {
					handler ??= (data) => callback(request, groups, data);

					break;
				}

				default:
					callback satisfies never;
			}
		}

		if (!handler) {
			return new Response(null, { status: STATUS_CODE.NotFound });
		}

		return await handler({ ...this.#default_data });
	}
}
