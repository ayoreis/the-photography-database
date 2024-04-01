import { FileSystemRouter } from './file-system-router.ts';

const router = new FileSystemRouter('routes');

await router.recurse_directory();

Deno.serve(router.handle);
