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

type MaybePromise<Type> = Type | Promise<Type>;
type Pattern = string;
type Groups = URLPatternComponentResult['groups'];
type NextHandler = () => Promise<Response>;

export type Handler = (
	request: Request,
	group: Groups,
	next: NextHandler,
) => MaybePromise<Response>;

class Route {
	fast_children = new Map<Pattern, Route>();
	slow_children = new Map<Pattern, Route>();
	handler: Handler | null = null;
}

function is_middleware(handler: Handler) {
	return handler.length > 2;
}

function is_fast(part: string) {
	return !part.includes('[');
}

export class Router {
	#routes: Record<Method, Route> = {
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

	#add_route(
		root_route: Route,
		pattern: Pattern,
		handler: Handler,
	) {
		// NOTE root pathnames always trail
		const parts = pattern === '/' ? [''] : pattern.split('/');
		let current_route = root_route;

		for (const part of parts) {
			if (is_fast(part)) {
				if (!current_route.fast_children.has(part)) {
					current_route.fast_children.set(part, new Route());
				}

				current_route = current_route.fast_children.get(part)!;

				continue;
			}

			const group = part.slice(1, -1);

			if (!current_route.slow_children.has(part)) {
				current_route.slow_children.set(group, new Route());
			}

			current_route = current_route.slow_children.get(group)!;
		}

		current_route.handler = handler;

		return this;
	}

	all(pattern: Pattern, handler: Handler) {
		for (const method of Object.values(this.#routes)) {
			this.#add_route(method, pattern, handler);
		}

		return this;
	}

	get(pattern: Pattern, handler: Handler) {
		return this.#add_route(this.#routes.GET, pattern, handler);
	}

	head(pattern: Pattern, handler: Handler) {
		return this.#add_route(this.#routes.HEAD, pattern, handler);
	}

	post(pattern: Pattern, handler: Handler) {
		return this.#add_route(this.#routes.POST, pattern, handler);
	}

	put(pattern: Pattern, handler: Handler) {
		return this.#add_route(this.#routes.PUT, pattern, handler);
	}

	delete(pattern: Pattern, handler: Handler) {
		return this.#add_route(this.#routes.DELETE, pattern, handler);
	}

	connect(pattern: Pattern, handler: Handler) {
		return this.#add_route(this.#routes.CONNECT, pattern, handler);
	}

	options(pattern: Pattern, handler: Handler) {
		return this.#add_route(this.#routes.OPTIONS, pattern, handler);
	}

	trace(pattern: Pattern, handler: Handler) {
		return this.#add_route(this.#routes.TRACE, pattern, handler);
	}

	patch(pattern: Pattern, handler: Handler) {
		return this.#add_route(this.#routes.PATCH, pattern, handler);
	}

	async #handle(
		request: Request,
		current_route: Route | undefined,
		[part, ...parts]: string[],
	): Promise<Response> {
		const fast_route = current_route?.fast_children.get(part);
		const is_fast = fast_route !== undefined;
		let key;

		if (is_fast) {
			current_route = fast_route;
		} else {
			[key, current_route] = current_route?.slow_children.entries().next()
				.value ?? [];
		}

		if (!current_route) return new Response(null, { status: 404 });

		if (!current_route.handler) {
			return await this.#handle(request, current_route, parts);
		}

		if (is_middleware(current_route.handler)) {
			return await current_route.handler(request, async () => {
				return await this.#handle(request, current_route, parts);
			});
		}

		if (parts.length === 0) {
			const groups = is_fast ? undefined : { [key]: part };

			return await current_route.handler(request, groups);
		}

		return await this.#handle(request, current_route, parts);
	}

	handle: Deno.ServeHandler = async (request) => {
		const current_route = this.#routes[request.method as Method];
		const { pathname } = new URL(request.url);
		const parts = pathname === '/' ? [''] : pathname.split('/');

		return await this.#handle(request, current_route, parts);
	};
}
