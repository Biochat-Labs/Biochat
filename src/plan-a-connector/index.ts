/**
 * Plan A: LobeChat Plugin Manifest
 *
 * This file re-exports the BiochatConnector as a LobeChat-compatible
 * BuiltinToolManifest for use in the Biochat fusion build.
 *
 * Usage in Biochat's plugin registry:
 *   import { BiochatConnectorManifest } from './manifest';
 *   registerBuiltinTool(BiochatConnectorManifest, biochatConnectorExecutor);
 */

export {
  BiochatConnectorIdentifier,
  BiochatConnectorApiName,
  BiochatConnectorManifest,
  biochatConnectorExecutor,
} from './BiochatConnector';

// Re-export types for consumers
export type {
  BiochatExecShellParams,
  BiochatReadFileParams,
  BiochatWriteFileParams,
  BiochatEditFileParams,
  BiochatListDirParams,
  BiochatSearchFilesParams,
  BiochatGrepContentParams,
  BiochatGlobFilesParams,
  BiochatMoveFileParams,
  BiochatRenameFileParams,
  BiochatGetBackgroundOutputParams,
  BiochatKillProcessParams,
} from './BiochatConnector';
