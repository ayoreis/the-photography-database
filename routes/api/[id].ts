import { define } from '../../file-system-router.ts';

export default define((_request, groups) => {
	console.log('API hit!');

	return new Response(`Recieved request for ${groups.id}`);
});
