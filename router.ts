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
type NextHandler<Type> = () => Promise<Type>;
type Handler = (
	request: Request,
	next: NextHandler<Response>,
) => MaybePromise<Response>;

class Route {
	children = new Map<Pattern, Route>();
	handler: Handler | null = null;
}

function is_middleware(handler: Handler) {
	return handler.length > 1;
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
			if (!current_route.children.has(part)) {
				current_route.children.set(part, new Route());
			}

			current_route = current_route.children.get(part)!;
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
		current_route = current_route?.children.get(part);

		if (!current_route) return new Response(null, { status: 404 });

		if (!current_route.handler) {
			return await this.#handle(
				request,
				current_route.children.get(part),
				parts,
			);
		}

		if (is_middleware(current_route.handler)) {
			return await current_route.handler(request, async () => {
				return await this.#handle(
					request,
					current_route.children.get(part),
					parts,
				);
			});
		}

		if (parts.length === 0) {
			return await current_route.handler(request);
		}

		return new Response(null, { status: 404 });
	}

	handle: Deno.ServeHandler = async (request) => {
		const current_route = this.#routes[request.method as Method];
		const { pathname } = new URL(request.url);
		const parts = pathname === '/' ? [''] : pathname.split('/');

		console.log(this.#routes.GET);

		return await this.#handle(request, current_route, parts);
	};
}
