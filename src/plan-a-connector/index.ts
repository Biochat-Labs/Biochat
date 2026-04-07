/**
 * Biochat Plan A: Nexu Runtime Connector for LobeChat
 * 
 * Package entry point — exports manifest + executor for LobeChat plugin registration.
 * 
 * In LobeChat, register this plugin as:
 *   url: http://localhost:18790/manifest.json
 * 
 * The BiochatExecutor extends LobeChat's BaseExecutor, automatically
 * routing tool calls to the Nexu/OpenClaw runtime via HTTP.
 */

export { BiochatExecutor } from './executor';
export { BiochatManifest, BiochatIdentifier } from './manifest';
export { OPENCLAW_GATEWAY, BiochatNexuApiName } from './BiochatConnector';
