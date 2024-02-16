const html = await Deno.readTextFile('index.html');

Deno.serve(() =>
	new Response(html, { headers: { 'Content-Type': 'text/html' } })
);
