/**
 * Biochat Plan A: Executor
 * 
 * Implements the LobeChat BaseExecutor pattern (from @lobechat/types).
 * Each method name matches an API declared in the manifest.
 * 
 * Real pattern reference:
 *   class LocalSystemExecutor extends BaseExecutor<typeof LocalSystemApiEnum>
 * 
 * The BaseExecutor base class (packages/types/src/tool/builtin.ts) provides:
 *   - hasApi(apiName) — checks if apiName is in the enum values
 *   - getApiNames() — returns all enum values
 *   - invoke(apiName, params, ctx) — routes to this[apiName](params, ctx)
 * 
 * BiochatExecutor routes all calls to the Nexu/OpenClaw runtime.
 */

import type { BuiltinToolContext, BuiltinToolResult } from '@lobechat/types';
import { BaseExecutor } from '@lobechat/types';

import {
  BiochatNexuApiName,
  invokeNexuSkill,
  OPENCLAW_GATEWAY,
  shellExec,
} from '../BiochatConnector';

// API name enum (must match manifest.ts)
const BiochatApiEnum = {
  invokeNexuSkill: 'invokeNexuSkill',
  shell: 'shell',
  readFile: 'readFile',
  writeFile: 'writeFile',
  listFiles: 'listFiles',
  deleteFile: 'deleteFile',
  searchFiles: 'searchFiles',
  grepContent: 'grepContent',
  runBackground: 'runBackground',
  getOutput: 'getOutput',
  killProcess: 'killProcess',
} as const;

/**
 * BiochatExecutor — Nexu Runtime Bridge for LobeChat
 *
 * Extends LobeChat's BaseExecutor to automatically route LobeChat
 * tool calls to the Nexu/OpenClaw execution engine.
 *
 * Usage in LobeChat:
 *   const executor = new BiochatExecutor();
 *   const result = await executor.invoke('shell', { command: 'ls -la' }, ctx);
 */
class BiochatExecutor extends BaseExecutor<typeof BiochatApiEnum> {
  readonly identifier = 'biochat-nexu-connector';
  protected readonly apiEnum = BiochatApiEnum;

  // ========================================================================
  // Nexu Skill Invocation
  // ========================================================================

  async invokeNexuSkill(
    params: { skill: string; args?: Record<string, any> },
    _ctx: BuiltinToolContext,
  ): Promise<BuiltinToolResult> {
    return invokeNexuSkill(params.skill, params.args || {});
  }

  // ========================================================================
  // Shell Execution
  // ========================================================================

  async shell(
    params: { command: string; cwd?: string; timeout?: number },
    _ctx: BuiltinToolContext,
  ): Promise<BuiltinToolResult> {
    return shellExec(params.command, params.cwd, params.timeout);
  }

  // ========================================================================
  // File Operations (delegated to Nexu file tool)
  // ========================================================================

  async readFile(
    params: { path: string; encoding?: string; limit?: number },
    _ctx: BuiltinToolContext,
  ): Promise<BuiltinToolResult> {
    const { execSync } = require('child_process');
    try {
      const flags = params.encoding === 'base64' ? '-b' : '-r';
      const limitFlag = params.limit ? `head -c ${params.limit}` : '';
      const cmd = `curl -s ${OPENCLAW_GATEWAY}/file/read -X POST -H "Content-Type: application/json" -d '{"path":"${params.path}"}' ${limitFlag}`;
      const content = execSync(cmd, { encoding: 'utf-8' });
      return { content, success: true };
    } catch (err: any) {
      return { content: undefined, error: { message: err.message, type: 'ReadError' }, success: false };
    }
  }

  async writeFile(
    params: { path: string; content: string },
    _ctx: BuiltinToolContext,
  ): Promise<BuiltinToolResult> {
    const { execSync } = require('child_process');
    try {
      // Escape content for shell safety
      const contentEscaped = params.content.replace(/'/g, "'\\''");
      const cmd = `curl -s ${OPENCLAW_GATEWAY}/file/write -X POST -H "Content-Type: application/json" -d '{"path":"${params.path}","content":"'${contentEscaped}'"}'`;
      const result = execSync(cmd, { encoding: 'utf-8' });
      return { content: result, success: true };
    } catch (err: any) {
      return { content: undefined, error: { message: err.message, type: 'WriteError' }, success: false };
    }
  }

  async listFiles(
    params: { path?: string; recursive?: boolean },
    _ctx: BuiltinToolContext,
  ): Promise<BuiltinToolResult> {
    const { execSync } = require('child_process');
    try {
      const cmd = `curl -s ${OPENCLAW_GATEWAY}/file/list -X POST -H "Content-Type: application/json" -d '{"path":"${params.path || '.'}'}"`;
      const output = execSync(cmd, { encoding: 'utf-8' });
      const parsed = JSON.parse(output);
      const entries = Array.isArray(parsed) ? parsed : parsed.entries || [];
      const content = entries.map((f: any) => `${f.type === 'directory' ? '📁' : '📄'} ${f.name}`).join('\n');
      return { content: content || 'No files found', success: true, state: { entries } };
    } catch (err: any) {
      return { content: undefined, error: { message: err.message, type: 'ListError' }, success: false };
    }
  }

  async deleteFile(
    params: { path: string },
    _ctx: BuiltinToolContext,
  ): Promise<BuiltinToolResult> {
    const { execSync } = require('child_process');
    try {
      const cmd = `curl -s ${OPENCLAW_GATEWAY}/file/delete -X POST -H "Content-Type: application/json" -d '{"path":"${params.path}"}'`;
      const result = execSync(cmd, { encoding: 'utf-8' });
      return { content: result, success: true };
    } catch (err: any) {
      return { content: undefined, error: { message: err.message, type: 'DeleteError' }, success: false };
    }
  }

  // ========================================================================
  // Search & Content
  // ========================================================================

  async searchFiles(
    params: { keywords: string; path?: string; fileTypes?: string[] },
    _ctx: BuiltinToolContext,
  ): Promise<BuiltinToolResult> {
    return invokeNexuSkill('file-organizer', {
      action: 'search',
      keywords: params.keywords,
      path: params.path,
      extensions: params.fileTypes,
    });
  }

  async grepContent(
    params: {
      pattern: string;
      path?: string;
      '-i'?: boolean;
      '-n'?: boolean;
      output_mode?: 'content' | 'files_with_matches' | 'count';
    },
    _ctx: BuiltinToolContext,
  ): Promise<BuiltinToolResult> {
    return invokeNexuSkill('file-search', {
      pattern: params.pattern,
      path: params.path || '.',
      caseInsensitive: params['-i'] || false,
      includeLineNumbers: params['-n'] !== false,
      mode: params.output_mode || 'content',
    });
  }

  // ========================================================================
  // Background Processes
  // ========================================================================

  async runBackground(
    params: { command: string; cwd?: string },
    _ctx: BuiltinToolContext,
  ): Promise<BuiltinToolResult> {
    const { execSync } = require('child_process');
    try {
      const cmd = `curl -s ${OPENCLAW_GATEWAY}/exec/background -X POST -H "Content-Type: application/json" -d '{"command":"${params.command.replace(/"/g, '\\"')}","cwd":"${params.cwd || ''}"}'`;
      const result = execSync(cmd, { encoding: 'utf-8' });
      const parsed = JSON.parse(result);
      return {
        content: `Background process started: shell_id=${parsed.shell_id}`,
        state: { shell_id: parsed.shell_id },
        success: true,
      };
    } catch (err: any) {
      return { content: undefined, error: { message: err.message, type: 'BgExecError' }, success: false };
    }
  }

  async getOutput(
    params: { shell_id: string },
    _ctx: BuiltinToolContext,
  ): Promise<BuiltinToolResult> {
    return invokeNexuSkill('shell-output', { shell_id: params.shell_id });
  }

  async killProcess(
    params: { shell_id: string },
    _ctx: BuiltinToolContext,
  ): Promise<BuiltinToolResult> {
    return invokeNexuSkill('shell-kill', { shell_id: params.shell_id });
  }
}

export { BiochatExecutor };
