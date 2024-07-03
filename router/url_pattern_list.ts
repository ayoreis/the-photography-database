type Groups = URLPatternComponentResult['groups'];

class Route {
	patterns: URLPattern[] = [];
	fast_children = new Map<URLPattern['pathname'], this>();
	slow_children = new Map<URLPattern['pathname'], this>();
	wildcard_child?: Route;
}

function is_wildcard(part: string) {
	return part === '*';
}

function is_fast(part: string) {
	return part[0] !== ':';
}

function ensure_path_part(current_route: Route, part: string) {
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

function ensure_path(current_route: Route, pattern: URLPattern) {
	for (const part of parts(pattern.pathname)) {
		current_route = ensure_path_part(current_route, part);
	}

	current_route.patterns.push(pattern);

	return current_route;
}

function parts(pattern: URLPattern['pathname']) {
	// NOTE root pathnames always trail
	if (pattern === '/') return [''];
	if (pattern === '/*') return ['*'];
	return pattern.split('/');
}

function is_destination(part?: string) {
	return part === undefined;
}

export class URLPatternList {
	#root_route = new Route();

	constructor(list: Iterable<URLPattern>) {
		for (const pattern of list) {
			ensure_path(this.#root_route, pattern);
		}
	}

	*#exec(
		[part, ...parts]: string[],
		current_route = this.#root_route,
		groups: Groups = {},
	): Generator<{ pattern: URLPattern; groups: Groups }, void, undefined> {
		if (is_destination(part)) {
			for (const pattern of current_route.patterns) {
				yield { pattern, groups };
			}

			return;
		}

		if (current_route.fast_children.has(part)) {
			yield* this.#exec(
				parts,
				current_route.fast_children.get(part)!,
				groups,
			);
		}

		for (const [group, child] of current_route.slow_children) {
			groups[group] = part;
			yield* this.#exec(parts, child, groups);
		}

		if (current_route.wildcard_child) {
			yield* this.#exec([], current_route.wildcard_child, groups);
		}
	}

	*exec(pathname: string) {
		yield* this.#exec(parts(pathname));
	}
}
