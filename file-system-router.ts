import { Router } from './router.ts';

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

			const name = entry.name.slice(0, entry.name.lastIndexOf('.'));
			const pattern = name === 'index' ? parent : `${parent}/${name}`;
			const content = await Deno.readTextFile(
				`${this.#directory}/${parent}/${entry.name}`,
			);

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
