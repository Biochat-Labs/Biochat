/**
 * BiochatConnector - Plan A Integration
 *
 * A LobeChat custom plugin that bridges to Nexu/OpenClaw's local execution runtime.
 * Exposes Nexu's file/shell capabilities via the LobeChat plugin manifest format.
 *
 * Architecture:
 *   LobeChat UI → ToolManifest → BiochatConnector → OpenClaw Gateway (localhost)
 *                                   ↓
 *                            skill SDK calls
 *                                   ↓
 *                            Nexu agent runtime
 *
 * The connector acts as a "smart proxy" - it presents a LobeChat-compatible
 * manifest while delegating actual execution to OpenClaw's exec tool.
 */

import type {
  BuiltinToolExecutor,
  BuiltinToolManifest,
  BuiltinToolResult,
  BuiltinToolContext,
  Meta,
} from '@lobechat/types';

// =============================================================================
// Constants
// =============================================================================

export const BiochatConnectorIdentifier = 'biochat-plan-a-connector';

export const BiochatConnectorApiName = {
  EXEC_SHELL: 'biochatExecShell',
  READ_FILE: 'biochatReadFile',
  WRITE_FILE: 'biochatWriteFile',
  EDIT_FILE: 'biochatEditFile',
  LIST_DIR: 'biochatListDir',
  SEARCH_FILES: 'biochatSearchFiles',
  GREP_CONTENT: 'biochatGrepContent',
  GLOB_FILES: 'biochatGlobFiles',
  MOVE_FILE: 'biochatMoveFile',
  RENAME_FILE: 'biochatRenameFile',
  GET_BACKGROUND_OUTPUT: 'biochatGetBackgroundOutput',
  KILL_PROCESS: 'biochatKillProcess',
} as const;

// =============================================================================
// Types
// =============================================================================

export interface BiochatExecShellParams {
  command: string;
  description: string;
  run_in_background?: boolean;
  timeout?: number;
}

export interface BiochatReadFileParams {
  path: string;
  loc?: [number, number];
}

export interface BiochatWriteFileParams {
  path: string;
  content: string;
}

export interface BiochatEditFileParams {
  file_path: string;
  old_string: string;
  new_string: string;
  replace_all?: boolean;
}

export interface BiochatListDirParams {
  path: string;
  limit?: number;
  sortBy?: 'name' | 'modifiedTime' | 'createdTime' | 'size';
  sortOrder?: 'asc' | 'desc';
}

export interface BiochatSearchFilesParams {
  keywords: string;
  scope?: string;
  fileTypes?: string[];
  createdAfter?: string;
  createdBefore?: string;
  modifiedAfter?: string;
  modifiedBefore?: string;
  contentContains?: string;
  exclude?: string[];
  limit?: number;
}

export interface BiochatGrepContentParams {
  pattern: string;
  scope?: string;
  output_mode?: 'content' | 'files_with_matches' | 'count';
  glob?: string;
  '-i'?: boolean;
  '-n'?: boolean;
  '-C'?: number;
  '-B'?: number;
  '-A'?: number;
  head_limit?: number;
  type?: string;
}

export interface BiochatGlobFilesParams {
  pattern: string;
  scope?: string;
}

export interface BiochatMoveFileParams {
  oldPath: string;
  newPath: string;
}

export interface BiochatRenameFileParams {
  path: string;
  newName: string;
}

export interface BiochatGetBackgroundOutputParams {
  shell_id: string;
  filter?: string;
}

export interface BiochatKillProcessParams {
  shell_id: string;
}

// =============================================================================
// OpenClaw Gateway Client
//
// The BiochatConnector communicates with the OpenClaw Gateway via its HTTP API.
// Default gateway URL: http://localhost:3141 (configurable via GATEWAY_URL env).
// =============================================================================

const GATEWAY_URL =
  process.env.BIOCHAT_GATEWAY_URL ||
  process.env.OPENCLAW_GATEWAY_URL ||
  'http://localhost:3141';

interface GatewayExecRequest {
  command: string;
  workdir?: string;
  timeout?: number;
  background?: boolean;
  env?: Record<string, string>;
}

interface GatewayExecResponse {
  id?: string; // background shell id
  output?: string;
  exitCode?: number;
  error?: string;
  success: boolean;
}

interface GatewayFileRequest {
  path: string;
  content?: string;
  old_string?: string;
  new_string?: string;
  replace_all?: boolean;
  loc?: [number, number];
  limit?: number;
  sortBy?: string;
  sortOrder?: string;
}

interface GatewayFileResponse {
  content?: string;
  results?: Array<{ name: string; path: string; isDirectory: boolean; size: number; modifiedTime: string }>;
  totalLineCount?: number;
  success: boolean;
  error?: string;
}

async function gatewayRequest<T>(path: string, body: unknown): Promise<T> {
  const url = `${GATEWAY_URL}${path}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60000),
  });

  if (!response.ok) {
    throw new Error(`Gateway request failed: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

// =============================================================================
// Tool Manifest (exported for LobeChat plugin registration)
// =============================================================================

export const BiochatConnectorManifest: BuiltinToolManifest = {
  identifier: BiochatConnectorIdentifier,
  meta: {
    avatar: '🔗',
    description:
      'Biochat Plan A: Bridge to Nexu/OpenClaw execution engine. Provides shell commands, file operations, and system-level capabilities by connecting to your local OpenClaw gateway.',
    readme: `# Biochat Plan A Connector

This plugin connects LobeChat to the Nexu/OpenClaw execution runtime running on your machine.

## Capabilities

- **Shell Execution**: Run any shell command (bash/zsh) with timeout control
- **File Operations**: Read, write, edit, list, search files on your local system
- **Background Processes**: Start long-running commands and poll for output
- **Content Search**: Grep/search within files using regex patterns
- **Glob Patterns**: Find files by path patterns

## Setup

The OpenClaw Gateway must be running on your local machine (default: http://localhost:3141).

## Security

All shell commands require human confirmation before execution. File operations within the configured workspace scope are allowed without extra confirmation.
`,
    tags: ['system', 'execution', 'shell', 'files', 'nexu', 'openclaw'],
    title: 'Biochat Plan A (Nexu Bridge)',
  },
  systemRole: `You are the Biochat Plan A connector to Nexu/OpenClaw. Your role is to bridge LobeChat's beautiful UI to Nexu's powerful execution engine.

When the user asks for system operations (file management, shell commands, etc.), use the biochat* tools. The actual execution happens on the user's local machine via the OpenClaw gateway.

Key principles:
1. Always confirm destructive operations (rm, mv over existing files) unless user explicitly requested
2. Use the same language as the user in descriptions
3. Provide clear, concise output - show what happened, not raw machinery
4. For shell commands, always include a human-readable description
5. File paths: always use absolute paths; resolve shortcuts like ~/Desktop relative to the user's home

Gateway communication:
- All tools communicate with the local OpenClaw gateway at ${GATEWAY_URL}
- Shell commands run with the user's default shell (zsh on macOS, bash on Linux)
- File operations are scoped to the configured workspace directory
- Background processes can be started with run_in_background=true and polled with biochatGetBackgroundOutput`,

  api: [
    {
      name: BiochatConnectorApiName.EXEC_SHELL,
      description:
        'Execute a shell command on the local machine via OpenClaw gateway. Supports both synchronous (returns output) and background (returns shell_id) execution.',
      parameters: {
        properties: {
          command: { description: 'The shell command to execute', type: 'string' },
          description: {
            description:
              'Clear description of what this command does (5-10 words, same language as user)',
            type: 'string',
          },
          run_in_background: {
            description: 'Set true to run in background and return shell_id for polling',
            type: 'boolean',
          },
          timeout: {
            default: 120000,
            description: 'Timeout in milliseconds (default: 120000, max: 600000)',
            type: 'number',
          },
        },
        required: ['command', 'description'],
        type: 'object',
      },
      humanIntervention: 'required',
    },
    {
      name: BiochatConnectorApiName.READ_FILE,
      description:
        'Read the content of a local file. Optionally restrict to a line range. Supports plain text files.',
      parameters: {
        properties: {
          loc: {
            description: 'Optional [startLine, endLine] range (0-indexed, inclusive)',
            items: { type: 'number' },
            type: 'array',
          },
          path: { description: 'Absolute path to the file', type: 'string' },
        },
        required: ['path'],
        type: 'object',
      },
      humanIntervention: { dynamic: { default: 'never', policy: 'required', type: 'pathScopeAudit' } },
    },
    {
      name: BiochatConnectorApiName.WRITE_FILE,
      description:
        'Write content to a local file. Creates the file if it does not exist, overwrites if it does.',
      parameters: {
        properties: {
          content: { description: 'The text content to write', type: 'string' },
          path: { description: 'Absolute path to the target file', type: 'string' },
        },
        required: ['path', 'content'],
        type: 'object',
      },
      humanIntervention: { dynamic: { default: 'never', policy: 'required', type: 'pathScopeAudit' } },
    },
    {
      name: BiochatConnectorApiName.EDIT_FILE,
      description:
        'Replace exact text in a file. Must read the file first before editing. Supports replace_all flag.',
      parameters: {
        properties: {
          file_path: { description: 'Absolute path to the file', type: 'string' },
          new_string: { description: 'Replacement text', type: 'string' },
          old_string: { description: 'Exact text to replace', type: 'string' },
          replace_all: {
            default: false,
            description: 'Replace all occurrences of old_string',
            type: 'boolean',
          },
        },
        required: ['file_path', 'old_string', 'new_string'],
        type: 'object',
      },
      humanIntervention: { dynamic: { default: 'never', policy: 'required', type: 'pathScopeAudit' } },
    },
    {
      name: BiochatConnectorApiName.LIST_DIR,
      description:
        'List files and directories at a given path. Returns metadata including size and modification time.',
      parameters: {
        properties: {
          limit: { default: 100, description: 'Maximum number of items (default: 100)', type: 'number' },
          path: { description: 'Absolute directory path', type: 'string' },
          sortBy: {
            default: 'modifiedTime',
            description: 'Sort field: name | modifiedTime | createdTime | size',
            enum: ['name', 'modifiedTime', 'createdTime', 'size'],
            type: 'string',
          },
          sortOrder: {
            default: 'desc',
            description: 'Sort direction: asc | desc',
            enum: ['asc', 'desc'],
            type: 'string',
          },
        },
        required: ['path'],
        type: 'object',
      },
      humanIntervention: { dynamic: { default: 'never', policy: 'required', type: 'pathScopeAudit' } },
    },
    {
      name: BiochatConnectorApiName.SEARCH_FILES,
      description: 'Search for files by name/keywords with optional content and date filters.',
      parameters: {
        properties: {
          contentContains: {
            description: 'Only return files whose content contains this string',
            type: 'string',
          },
          createdAfter: { description: 'ISO 8601 date string', format: 'date-time', type: 'string' },
          createdBefore: { description: 'ISO 8601 date string', format: 'date-time', type: 'string' },
          exclude: {
            description: 'File/directory paths to exclude from results',
            items: { type: 'string' },
            type: 'array',
          },
          fileTypes: {
            description: 'File type filters (e.g., "txt", "js", "public.image")',
            items: { type: 'string' },
            type: 'array',
          },
          keywords: { description: 'Search keywords', type: 'string' },
          limit: { description: 'Maximum number of results', type: 'number' },
          modifiedAfter: { description: 'ISO 8601 date string', format: 'date-time', type: 'string' },
          modifiedBefore: { description: 'ISO 8601 date string', format: 'date-time', type: 'string' },
          scope: { description: 'Directory scope to search within', type: 'string' },
        },
        required: ['keywords'],
        type: 'object',
      },
      humanIntervention: { dynamic: { default: 'never', policy: 'required', type: 'pathScopeAudit' } },
    },
    {
      name: BiochatConnectorApiName.GREP_CONTENT,
      description:
        'Search for regex patterns inside files. Supports context lines, case-insensitive mode, and multiple output formats.',
      parameters: {
        properties: {
          '-A': { description: 'Lines after match (requires output_mode: content)', type: 'number' },
          '-B': { description: 'Lines before match (requires output_mode: content)', type: 'number' },
          '-C': { description: 'Context lines around match', type: 'number' },
          '-i': { description: 'Case-insensitive search', type: 'boolean' },
          '-n': { description: 'Show line numbers (requires output_mode: content)', type: 'boolean' },
          glob: { description: 'Glob pattern to filter files (e.g. "*.ts")', type: 'string' },
          head_limit: { description: 'Limit number of matching lines', type: 'number' },
          output_mode: {
            default: 'content',
            description: 'Output format: content | files_with_matches | count',
            enum: ['content', 'files_with_matches', 'count'],
            type: 'string',
          },
          pattern: { description: 'Regular expression pattern', type: 'string' },
          scope: { description: 'Directory to search within', type: 'string' },
          type: { description: 'Filter by file extension (e.g. "ts", "py")', type: 'string' },
        },
        required: ['pattern'],
        type: 'object',
      },
      humanIntervention: { dynamic: { default: 'never', policy: 'required', type: 'pathScopeAudit' } },
    },
    {
      name: BiochatConnectorApiName.GLOB_FILES,
      description: 'Find files matching glob patterns like "**/*.ts" or "src/**/*.js".',
      parameters: {
        properties: {
          pattern: {
            description: 'Glob pattern (e.g. "**/*.js", "src/**/*.ts")',
            type: 'string',
          },
          scope: {
            description: 'Base directory for relative patterns (defaults to workspace root)',
            type: 'string',
          },
        },
        required: ['pattern'],
        type: 'object',
      },
      humanIntervention: { dynamic: { default: 'never', policy: 'required', type: 'pathScopeAudit' } },
    },
    {
      name: BiochatConnectorApiName.MOVE_FILE,
      description: 'Move or rename a file/directory. Can also be used for renaming.',
      parameters: {
        properties: {
          newPath: { description: 'Target absolute path', type: 'string' },
          oldPath: { description: 'Source absolute path', type: 'string' },
        },
        required: ['oldPath', 'newPath'],
        type: 'object',
      },
      humanIntervention: { dynamic: { default: 'never', policy: 'required', type: 'pathScopeAudit' } },
    },
    {
      name: BiochatConnectorApiName.RENAME_FILE,
      description: 'Rename a file or directory in its current location.',
      parameters: {
        properties: {
          newName: { description: 'New name (without path)', type: 'string' },
          path: { description: 'Current absolute path of the file to rename', type: 'string' },
        },
        required: ['path', 'newName'],
        type: 'object',
      },
      humanIntervention: { dynamic: { default: 'never', policy: 'required', type: 'pathScopeAudit' } },
    },
    {
      name: BiochatConnectorApiName.GET_BACKGROUND_OUTPUT,
      description:
        "Poll for output from a background shell command started with run_in_background=true.",
      parameters: {
        properties: {
          filter: { description: 'Optional regex to filter output lines', type: 'string' },
          shell_id: { description: 'The shell ID returned from execShell with run_in_background=true', type: 'string' },
        },
        required: ['shell_id'],
        type: 'object',
      },
    },
    {
      name: BiochatConnectorApiName.KILL_PROCESS,
      description: 'Kill a running background shell command by its shell ID.',
      parameters: {
        properties: {
          shell_id: { description: 'The shell ID of the running process to kill', type: 'string' },
        },
        required: ['shell_id'],
        type: 'object',
      },
    },
  ],
};

// =============================================================================
// Executor Implementation
// =============================================================================

type BiochatApiName = (typeof BiochatConnectorApiName)[keyof typeof BiochatConnectorApiName];

class BiochatConnectorExecutor implements BuiltinToolExecutor {
  readonly identifier = BiochatConnectorIdentifier;

  hasApi(apiName: string): boolean {
    return Object.values(BiochatConnectorApiName).includes(apiName as BiochatApiName);
  }

  getApiNames(): string[] {
    return Object.values(BiochatConnectorApiName);
  }

  async invoke(
    apiName: string,
    params: unknown,
    ctx: BuiltinToolContext,
  ): Promise<BuiltinToolResult> {
    try {
      switch (apiName) {
        case BiochatConnectorApiName.EXEC_SHELL:
          return this.execShell(params as BiochatExecShellParams);
        case BiochatConnectorApiName.READ_FILE:
          return this.readFile(params as BiochatReadFileParams);
        case BiochatConnectorApiName.WRITE_FILE:
          return this.writeFile(params as BiochatWriteFileParams);
        case BiochatConnectorApiName.EDIT_FILE:
          return this.editFile(params as BiochatEditFileParams);
        case BiochatConnectorApiName.LIST_DIR:
          return this.listDir(params as BiochatListDirParams);
        case BiochatConnectorApiName.SEARCH_FILES:
          return this.searchFiles(params as BiochatSearchFilesParams);
        case BiochatConnectorApiName.GREP_CONTENT:
          return this.grepContent(params as BiochatGrepContentParams);
        case BiochatConnectorApiName.GLOB_FILES:
          return this.globFiles(params as BiochatGlobFilesParams);
        case BiochatConnectorApiName.MOVE_FILE:
          return this.moveFile(params as BiochatMoveFileParams);
        case BiochatConnectorApiName.RENAME_FILE:
          return this.renameFile(params as BiochatRenameFileParams);
        case BiochatConnectorApiName.GET_BACKGROUND_OUTPUT:
          return this.getBackgroundOutput(params as BiochatGetBackgroundOutputParams);
        case BiochatConnectorApiName.KILL_PROCESS:
          return this.killProcess(params as BiochatKillProcessParams);
        default:
          return { success: false, error: { message: `Unknown API: ${apiName}`, type: 'ApiNotFound' } };
      }
    } catch (err) {
      const error = err as Error;
      return {
        success: false,
        error: { message: error.message, type: 'PluginServerError', body: error },
      };
    }
  }

  // -------------------------------------------------------------------------
  // Shell execution via OpenClaw gateway
  // -------------------------------------------------------------------------
  private async execShell(params: BiochatExecShellParams): Promise<BuiltinToolResult> {
    const body: GatewayExecRequest = {
      command: params.command,
      background: params.run_in_background ?? false,
      timeout: params.timeout,
      workdir: undefined,
    };

    const result = await gatewayRequest<GatewayExecResponse>('/exec', body);

    if (params.run_in_background) {
      return {
        success: true,
        content: result.id
          ? `Background shell started with ID: ${result.id}\nUse biochatGetBackgroundOutput to poll for results.`
          : `Background shell started.\nUse biochatGetBackgroundOutput to poll.`,
      };
    }

    if (!result.success) {
      return {
        success: false,
        error: { message: result.error || 'Command failed', type: 'ShellError' },
        content: result.output || '',
      };
    }

    return {
      success: true,
      content: result.output || '',
    };
  }

  private async getBackgroundOutput(params: BiochatGetBackgroundOutputParams): Promise<BuiltinToolResult> {
    const result = await gatewayRequest<GatewayExecResponse>(
      `/exec/${params.shell_id}/output`,
      { filter: params.filter },
    );
    return { success: true, content: result.output || '' };
  }

  private async killProcess(params: BiochatKillProcessParams): Promise<BuiltinToolResult> {
    const result = await gatewayRequest<GatewayExecResponse>(`/exec/${params.shell_id}/kill`, {});
    return {
      success: result.success,
      content: result.success ? `Process ${params.shell_id} killed.` : result.error || 'Kill failed',
    };
  }

  // -------------------------------------------------------------------------
  // File operations via OpenClaw gateway
  // -------------------------------------------------------------------------
  private async readFile(params: BiochatReadFileParams): Promise<BuiltinToolResult> {
    const body: GatewayFileRequest = {
      path: params.path,
      loc: params.loc,
    };
    const result = await gatewayRequest<GatewayFileResponse>('/file/read', body);
    if (!result.success) {
      return { success: false, error: { message: result.error || 'Read failed', type: 'FileError' } };
    }
    const totalLineInfo = result.totalLineCount !== undefined ? ` (total ${result.totalLineCount} lines)` : '';
    return { success: true, content: result.content || '', state: { totalLineCount: result.totalLineCount } };
  }

  private async writeFile(params: BiochatWriteFileParams): Promise<BuiltinToolResult> {
    const body: GatewayFileRequest = { path: params.path, content: params.content };
    const result = await gatewayRequest<GatewayFileResponse>('/file/write', body);
    if (!result.success) {
      return { success: false, error: { message: result.error || 'Write failed', type: 'FileError' } };
    }
    return { success: true, content: `Written ${params.content.length} characters to ${params.path}` };
  }

  private async editFile(params: BiochatEditFileParams): Promise<BuiltinToolResult> {
    const body: GatewayFileRequest = {
      path: params.file_path,
      old_string: params.old_string,
      new_string: params.new_string,
      replace_all: params.replace_all,
    };
    const result = await gatewayRequest<GatewayFileResponse>('/file/edit', body);
    if (!result.success) {
      return { success: false, error: { message: result.error || 'Edit failed', type: 'FileError' } };
    }
    return { success: true, content: `Edited ${params.file_path}` };
  }

  private async listDir(params: BiochatListDirParams): Promise<BuiltinToolResult> {
    const body: GatewayFileRequest = {
      path: params.path,
      limit: params.limit,
      sortBy: params.sortBy,
      sortOrder: params.sortOrder,
    };
    const result = await gatewayRequest<GatewayFileResponse>('/file/list', body);
    if (!result.success) {
      return { success: false, error: { message: result.error || 'List failed', type: 'FileError' } };
    }
    const lines = result.results?.map(
      (r) => `${r.isDirectory ? '📁' : '📄'} ${r.name}${r.isDirectory ? '/' : ''}  (${r.size} bytes, ${r.modifiedTime})`,
    );
    return { success: true, content: lines?.join('\n') || '(empty directory)', state: { results: result.results } };
  }

  private async searchFiles(params: BiochatSearchFilesParams): Promise<BuiltinToolResult> {
    const body: GatewayFileRequest = {
      path: params.scope || '/',
      limit: params.limit,
    };
    const result = await gatewayRequest<GatewayFileResponse>('/file/search', body);
    if (!result.success) {
      return { success: false, error: { message: result.error || 'Search failed', type: 'FileError' } };
    }
    const lines = result.results?.map((r) => `${r.path}`);
    return { success: true, content: lines?.join('\n') || 'No files found', state: { results: result.results } };
  }

  private async grepContent(params: BiochatGrepContentParams): Promise<BuiltinToolResult> {
    const body: GatewayFileRequest = {
      path: params.scope || '/',
      ...params,
    };
    const result = await gatewayRequest<GatewayFileResponse>('/file/grep', body);
    if (!result.success) {
      return { success: false, error: { message: result.error || 'Grep failed', type: 'FileError' } };
    }
    return { success: true, content: result.content || '' };
  }

  private async globFiles(params: BiochatGlobFilesParams): Promise<BuiltinToolResult> {
    const body: GatewayFileRequest = { path: params.scope || '', pattern: params.pattern };
    const result = await gatewayRequest<GatewayFileResponse>('/file/glob', body);
    if (!result.success) {
      return { success: false, error: { message: result.error || 'Glob failed', type: 'FileError' } };
    }
    return { success: true, content: result.content || '' };
  }

  private async moveFile(params: BiochatMoveFileParams): Promise<BuiltinToolResult> {
    const body: GatewayFileRequest = { path: params.oldPath, new_string: params.newPath };
    const result = await gatewayRequest<GatewayFileResponse>('/file/move', body);
    if (!result.success) {
      return { success: false, error: { message: result.error || 'Move failed', type: 'FileError' } };
    }
    return { success: true, content: `Moved ${params.oldPath} → ${params.newPath}` };
  }

  private async renameFile(params: BiochatRenameFileParams): Promise<BuiltinToolResult> {
    const dir = params.path.substring(0, params.path.lastIndexOf('/'));
    const newPath = `${dir}/${params.newName}`;
    const body: GatewayFileRequest = { path: params.path, new_string: newPath };
    const result = await gatewayRequest<GatewayFileResponse>('/file/move', body);
    if (!result.success) {
      return { success: false, error: { message: result.error || 'Rename failed', type: 'FileError' } };
    }
    return { success: true, content: `Renamed ${params.path} → ${newPath}` };
  }
}

// =============================================================================
// Export singleton executor instance (for plugin registry)
// =============================================================================

export const biochatConnectorExecutor = new BiochatConnectorExecutor();

export default biochatConnectorExecutor;
