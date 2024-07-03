import type { MaybePromise } from '../types.ts';

type Groups = URLPatternComponentResult['groups'];
type Next<Data> = (data?: Partial<Data>) => Promise<Response>;

export type Method =
	| 'GET'
	| 'HEAD'
	| 'POST'
	| 'PUT'
	| 'DELETE'
	| 'CONNECT'
	| 'OPTIONS'
	| 'TRACE'
	| 'PATCH';

export type Middleware<Data> = (
	request: Request,
	groups: Groups,
	data: Data,
	next: Next<Data>,
) => MaybePromise<Response | void>;

export type Handler<Data> = (
	request: Request,
	groups: Groups,
	data: Data,
) => MaybePromise<Response>;

export type Callback<Data> = Middleware<Data> | Handler<Data>;

export type DataConstraint = Record<PropertyKey, unknown>;
