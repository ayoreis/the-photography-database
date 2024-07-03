import { get } from 'relax/router/file_system.ts';

export default get((_request, _groups, { render }) => {
	return render('<h1>Home sweet home</h1>');
});
