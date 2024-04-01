import { Handler, Router } from './router.ts';

const TYPESCRIPT_EXTENSION = '.ts';

export function define(handler: Handler) {
	return handler;
}

export class FileSystemRouter extends Router {
	#directory: string;

	constructor(directory: string) {
		super();

		this.#directory = directory;
	}

	async #recurse_directory(parent = '') {
		for await (const entry of Deno.readDir(`${this.#directory}/${parent}`)) {
			if (!entry.isFile) {
				await this.#recurse_directory(`${parent}/${entry.name}`);
				continue;
			}

			const extension_separator_position = entry.name.lastIndexOf('.');
			const name = entry.name.slice(0, extension_separator_position);
			const extension = entry.name.slice(extension_separator_position);
			const pattern = name === 'index' ? parent : `${parent}/${name}`;
			const real_name = `./${this.#directory}${parent}/${entry.name}`;

			if (extension === TYPESCRIPT_EXTENSION) {
				this.get(pattern, async (request, groups) => {
					const handle: Handler = (await import(real_name)).default;

					return await handle(request, groups);
				});

				continue;
			}

			const content = await Deno.readTextFile(real_name);

			this.get(pattern, () => {
				return new Response(content, {
					headers: { 'Content-Type': 'text/html' },
				});
			});
		}
	}

	async recurse_directory() {
		await this.#recurse_directory();
	}
}
