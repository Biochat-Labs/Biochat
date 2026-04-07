/**
 * Biochat Plan A: BiochatConnector
 * 
 * LobeChat builtin tool plugin that bridges to Nexu/OpenClaw runtime.
 * 
 * Architecture (mirrors lobe-local-system pattern):
 * - Extends LobeChat's BaseExecutor for automatic API routing
 * - Manifest declares all APIs following BuiltinToolManifest schema
 * - ExecutionRuntime delegates to OpenClaw HTTP API
 * 
 * Based on: packages/builtin-tool-local-system (LobeChat main branch)
 * Real types from: @lobechat/types (BuiltinToolManifest, BaseExecutor, BuiltinToolContext)
 */

import type {
  BuiltinToolContext,
  BuiltinToolResult,
} from '@lobechat/types';
import { BaseExecutor } from '@lobechat/types';

// Re-export manifest and identifier for LobeChat plugin registration
export { BiochatManifest as BiochatToolManifest, BiochatIdentifier } from './manifest';
export { BiochatExecutor } from './executor';

/**
 * Nexu/OpenClaw Gateway
 * 
 * Biochat Connector routes all tool calls to the OpenClaw runtime.
 * Default: http://localhost:3141 (OpenClaw default port)
 * 
 * OpenClaw Skill Invocation API:
 * POST /skill/invoke { skill: string, args: object }
 * 
 * OpenClaw File API:
 * POST /file/read   { path: string }
 * POST /file/write  { path: string, content: string }
 * POST /file/list   { path: string }
 * POST /file/delete { path: string }
 * 
 * OpenClaw Shell API:
 * POST /exec        { command: string, cwd?: string }
 */

const OPENCLAW_GATEWAY = process.env.OPENCLAW_GATEWAY || 'http://localhost:3141';
const SKILL_INVOKE_API = `${OPENCLAW_GATEWAY}/skill/invoke`;
const SHELL_EXEC_API = `${OPENCLAW_GATEWAY}/exec`;
const FILE_API = `${OPENCLAW_GATEWAY}/file`;

export { OPENCLAW_GATEWAY };

// ============================================================================
// Nexu Skill API Names (matches Nexu/OpenClaw skill registry)
// ============================================================================

export const BiochatNexuApiName = {
  // Nexu skill invoker — calls any Nexu skill by name
  invokeNexuSkill: 'invokeNexuSkill',
  // Shell execution
  shell: 'shell',
  // File operations (maps to Nexu file tools)
  readFile: 'readFile',
  writeFile: 'writeFile',
  listFiles: 'listFiles',
  deleteFile: 'deleteFile',
  // Search & grep
  searchFiles: 'searchFiles',
  grepContent: 'grepContent',
  // Background processes
  runBackground: 'runBackground',
  getOutput: 'getOutput',
  killProcess: 'killProcess',
} as const;

export type BiochatNexuApiName = typeof BiochatNexuApiName[keyof typeof BiochatNexuApiName];

// ============================================================================
// HTTP Client (no external dependencies — uses Node built-in http)
// ============================================================================

async function nexuPost<T = any>(url: string, body: object, timeoutMs = 30000): Promise<T> {
  const { execSync } = require('child_process');
  
  const bodyStr = JSON.stringify(body);
  const curlCmd = [
    'curl', '-s', '-X', 'POST', url,
    '-H', 'Content-Type: application/json',
    '-d", bodyStr,
    '--max-time', String(Math.floor(timeoutMs / 1000)),
  ].join(' ');

  try {
    const output = execSync(curlCmd, { encoding: 'utf-8', timeout: timeoutMs + 5000 });
    return JSON.parse(output);
  } catch (err: any) {
    throw new Error(`Nexu API error at ${url}: ${err.message}`);
  }
}

// ============================================================================
// Nexu Skill Invoker
// ============================================================================

export async function invokeNexuSkill(
  skillName: string,
  args: Record<string, any>,
): Promise<BuiltinToolResult> {
  try {
    const result = await nexuPost<{ success: boolean; output?: string; error?: string }>(
      SKILL_INVOKE_API,
      { skill: skillName, args },
    );
    return {
      content: result.output || JSON.stringify(result),
      success: result.success !== false,
    };
  } catch (err: any) {
    return { content: undefined, error: { message: err.message, type: 'NexuSkillError' }, success: false };
  }
}

// ============================================================================
// Shell Executor
// ============================================================================

export async function shellExec(
  command: string,
  cwd?: string,
  timeoutMs = 60000,
): Promise<BuiltinToolResult> {
  try {
    const result = await nexuPost<{ stdout?: string; stderr?: string; exitCode?: number }>(
      SHELL_EXEC_API,
      { command, cwd, timeoutMs },
    );
    const output = [result.stdout, result.stderr].filter(Boolean).join('\n');
    return {
      content: output || `Exit code: ${result.exitCode}`,
      success: result.exitCode === 0,
    };
  } catch (err: any) {
    return { content: undefined, error: { message: err.message, type: 'ShellError' }, success: false };
  }
}

// ============================================================================
// File Operations
// ============================================================================

export async function fileOp(
  op: 'read' | 'write' | 'list' | 'delete',
  path: string,
  content?: string,
): Promise<BuiltinToolResult> {
  try {
    const result = await nexuPost<{ content?: string; entries?: any[]; success: boolean; error?: string }>(
      `${FILE_API}/${op}`,
      op === 'write' ? { path, content } : { path },
    );
    return {
      content: Array.isArray(result) ? JSON.stringify(result) : (result.content || JSON.stringify(result)),
      success: result.success !== false,
      state: result,
    };
  } catch (err: any) {
    return { content: undefined, error: { message: err.message, type: 'FileOpError' }, success: false };
  }
}
