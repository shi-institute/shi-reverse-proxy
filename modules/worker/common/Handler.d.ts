import { RewritableRequest } from './RewritableRequest';

export type ReverseProxyHandler<Props = unknown, Env = Cloudflare.Env, QueueHandlerMessage = unknown, CfHostMetadata = unknown> = Omit<
	ExportedHandler<Env, QueueHandlerMessage, CfHostMetadata>,
	'fetch'
> & {
	fetch: (
		request: RewritableRequest<Parameters<ExportedHandler<Env, QueueHandlerMessage, CfHostMetadata>['fetch']>[0]>,
		env: Env,
		ctx: ExecutionContext<Props>,
	) => Promise<Response | void>;
};
