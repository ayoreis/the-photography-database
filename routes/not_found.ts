import { STATUS_CODE } from 'jsr:@std/http/status';
import { get } from 'relax/router/file_system.ts';

export default get((_request, _groups, { render }) => {
	return render('<h1>Page not found</h1>', STATUS_CODE.NotFound);
});
