type Method =
	| 'GET'
	| 'HEAD'
	| 'POST'
	| 'PUT'
	| 'DELETE'
	| 'CONNECT'
	| 'OPTIONS'
	| 'TRACE'
	| 'PATCH';

type MaybePromise<Type> = Promise<Type> | Type;

type Groups = URLPatternComponentResult['groups'];
type Next<Data> = (data?: Data) => Promise<Response>;

type Middleware<Data> = (
	request: Request,
	groups: Groups,
	data: Data,
	next: Next<Data>,
) => MaybePromise<void>;

type Handler<Data> = (
	request: Request,
	groups: Groups,
	data: Data,
) => MaybePromise<Response>;

type NotFoundHandler<Data> = (
	request: Request,
	data: Data,
) => MaybePromise<Response>;

type Pattern = string;

function parts(pattern: Pattern) {
	// NOTE root pathnames always trail
	return pattern === '/' ? [''] : pattern.split('/');
}

function is_wildcard(part: string) {
	return part === '*';
}

function is_fast(part: string) {
	return part[0] !== ':';
}

function create_route<Data>(current_route: Route<Data>, part: string) {
	if (is_wildcard(part)) {
		return current_route.wildcard_child ??= new Route();
	}

	if (is_fast(part)) {
		if (!current_route.fast_children.has(part)) {
			current_route.fast_children.set(part, new Route());
		}

		return current_route.fast_children.get(part)!;
	}

	// is slow
	const group = part.slice(1);

	if (!current_route.slow_children.has(group)) {
		current_route.slow_children.set(group, new Route());
	}

	return current_route.slow_children.get(group)!;
}

function create_path<Data>(current_route: Route<Data>, pattern: string) {
	for (const part of parts(pattern)) {
		current_route = create_route(current_route, part);
	}

	return current_route;
}

function is_middleware<Data>(handler: Middleware<Data> | Handler<Data>) {
	return handler.length > 3;
}

function compose<Data>(first: Middleware<Data>, second: Middleware<Data>) {
	return async (
		request: Request,
		groups: Groups,
		data: Data,
		next: Next<Data>,
	) => {
		let response: Response;

		await first(
			request,
			groups,
			data,
			async (next_data = data) => {
				await second(
					request,
					groups,
					next_data,
					async () => response = await next(),
				);

				return response;
			},
		);

		return response!;
	};
}

function is_destination(parts: string[]) {
	return parts.length === 0;
}

class Route<Data> {
	middleware: Middleware<Data>[] = [];
	handler?: Handler<Data>;
	not_found_handler?: NotFoundHandler<Data>;
	fast_children = new Map<Pattern, this>();
	slow_children = new Map<Pattern, this>();
	wildcard_child?: Route<Data>;
}

interface Entry {
	type: string;
	// deno-lint-ignore ban-types
	callback: Function;
	groups: Groups;
}

interface MiddlewareEntry<Data> extends Entry {
	type: 'middleware';
	callback: Middleware<Data>;
}

interface HandlerEntry<Data> extends Entry {
	type: 'handler';
	callback: Handler<Data>;
}

interface NotFoundEntry<Data> extends Entry {
	type: 'not_found';
	callback: NotFoundHandler<Data>;
}

type EntryKind<Data> =
	| MiddlewareEntry<Data>
	| HandlerEntry<Data>
	| NotFoundEntry<Data>;

function* traverse_tree<Data>(
	[part, ...parts]: string[],
	current_route: Route<Data>,
): Generator<EntryKind<Data>, void, void> {
	// TODO
	if (part === undefined) {
		for (const middleware of current_route.middleware) {
			yield { type: 'middleware', callback: middleware, groups: {} };
		}

		if (current_route.handler) {
			yield { type: 'handler', callback: current_route.handler, groups: {} };
		}

		if (current_route.not_found_handler) {
			yield {
				type: 'not_found',
				callback: current_route.not_found_handler,
				groups: {},
			};
		}

		return;
	}

	if (current_route.wildcard_child) {
		yield* traverse_tree([], current_route.wildcard_child);
	}

	for (const [group, child] of current_route.slow_children) {
		// const groups = { [group]: part };

		// console.log(groups);

		yield* traverse_tree(parts, child);
	}

	if (current_route.fast_children.has(part)) {
		yield* traverse_tree(parts, current_route.fast_children.get(part)!);
	}
}

export class Router<
	Data extends Record<string | number | symbol, unknown>,
> {
	#routes: Record<Method, Route<Data>> = {
		GET: new Route(),
		HEAD: new Route(),
		POST: new Route(),
		PUT: new Route(),
		DELETE: new Route(),
		CONNECT: new Route(),
		OPTIONS: new Route(),
		TRACE: new Route(),
		PATCH: new Route(),
	};

	#default_data: Data;

	constructor(data: Data) {
		this.#default_data = data;
	}

	#add_route(
		root_route: Route<Data>,
		pattern: Pattern,
		handler: Middleware<Data> | Handler<Data>,
	) {
		const current_route = create_path(root_route, pattern);

		if (is_middleware(handler)) {
			current_route.middleware.push(handler as Middleware<Data>);
		} else {
			current_route.handler = handler as Handler<Data>;
		}

		return this;
	}

	all(pattern: Pattern, handler: Middleware<Data>): this;
	all(pattern: Pattern, handler: Handler<Data>): this;
	all(pattern: Pattern, handler: Middleware<Data> | Handler<Data>) {
		for (const method of Object.values(this.#routes)) {
			this.#add_route(method, pattern, handler);
		}

		return this;
	}

	get(pattern: Pattern, handler: Middleware<Data>): this;
	get(pattern: Pattern, handler: Handler<Data>): this;
	get(pattern: Pattern, handler: Middleware<Data> | Handler<Data>) {
		return this.#add_route(this.#routes.GET, pattern, handler);
	}

	head(pattern: Pattern, handler: Middleware<Data>): this;
	head(pattern: Pattern, handler: Handler<Data>): this;
	head(pattern: Pattern, handler: Middleware<Data> | Handler<Data>) {
		return this.#add_route(this.#routes.HEAD, pattern, handler);
	}

	post(pattern: Pattern, handler: Middleware<Data>): this;
	post(pattern: Pattern, handler: Handler<Data>): this;
	post(pattern: Pattern, handler: Middleware<Data> | Handler<Data>) {
		return this.#add_route(this.#routes.POST, pattern, handler);
	}

	put(pattern: Pattern, handler: Middleware<Data>): this;
	put(pattern: Pattern, handler: Handler<Data>): this;
	put(pattern: Pattern, handler: Middleware<Data> | Handler<Data>) {
		return this.#add_route(this.#routes.PUT, pattern, handler);
	}

	delete(pattern: Pattern, handler: Middleware<Data>): this;
	delete(pattern: Pattern, handler: Handler<Data>): this;
	delete(pattern: Pattern, handler: Middleware<Data> | Handler<Data>) {
		return this.#add_route(this.#routes.DELETE, pattern, handler);
	}

	connect(pattern: Pattern, handler: Middleware<Data>): this;
	connect(pattern: Pattern, handler: Handler<Data>): this;
	connect(pattern: Pattern, handler: Middleware<Data> | Handler<Data>) {
		return this.#add_route(this.#routes.CONNECT, pattern, handler);
	}

	options(pattern: Pattern, handler: Middleware<Data>): this;
	options(pattern: Pattern, handler: Handler<Data>): this;
	options(pattern: Pattern, handler: Middleware<Data> | Handler<Data>) {
		return this.#add_route(this.#routes.OPTIONS, pattern, handler);
	}

	trace(pattern: Pattern, handler: Middleware<Data>): this;
	trace(pattern: Pattern, handler: Handler<Data>): this;
	trace(pattern: Pattern, handler: Middleware<Data> | Handler<Data>) {
		return this.#add_route(this.#routes.TRACE, pattern, handler);
	}

	patch(pattern: Pattern, handler: Middleware<Data>): this;
	patch(pattern: Pattern, handler: Handler<Data>): this;
	patch(pattern: Pattern, handler: Middleware<Data> | Handler<Data>) {
		return this.#add_route(this.#routes.PATCH, pattern, handler);
	}

	not_found(pattern: Pattern, handler: NotFoundHandler<Data>) {
		// TODO other methods
		const current_route = create_path(this.#routes.GET, pattern);

		current_route.not_found_handler = handler;

		return this;
	}

	async handle(request: Request) {
		const root_route = this.#routes[request.method as Method];
		// TODO request vs node scoped, currently request
		const groups: Groups = {};
		const data = Object.assign({}, this.#default_data);

		const { pathname } = new URL(request.url);

		let middleware: Middleware<Data> = (request, groups, data, next) =>
			next(data);
		let handler: Handler<Data> | undefined;
		let not_found_handler: NotFoundHandler<Data> = () =>
			new Response(null, { status: 404 });

		for (const entry of traverse_tree(parts(pathname), root_route)) {
			switch (entry.type) {
				case 'middleware': {
					middleware = compose(middleware, entry.callback);

					break;
				}

				case 'handler': {
					handler = entry.callback;

					break;
				}

				case 'not_found': {
					not_found_handler = entry.callback;
					break;
				}

				default:
					entry satisfies never;
			}
		}

		return await middleware(
			request,
			{},
			this.#default_data,
			async (next_data) => {
				const new_data = next_data ? Object.assign(data, next_data) : data;

				if (handler) {
					return await handler(request, {}, new_data);
				}

				return await not_found_handler(request, new_data);
			},
		);
	}
}
