/**
 * Biochat Plan A: Tool Manifest
 * 
 * Declares all Biochat (Nexu-powered) tools following LobeChat's
 * BuiltinToolManifest schema from @lobechat/types.
 * 
 * Real schema reference (from packages/types/src/tool/builtin.ts):
 * - BuiltinToolManifest { api, identifier, meta, systemRole, type }
 * - LobeChatPluginApi { name, description, parameters, humanIntervention, renderDisplayControl }
 */

import type { BuiltinToolManifest } from '@lobechat/types';

export const BiochatIdentifier = 'biochat-nexu-connector';

export const BiochatManifest: BuiltinToolManifest = {
  api: [
    // ========================================================================
    // Nexu Skill Invocation
    // ========================================================================
    {
      description:
        'Call any Nexu skill by name with arguments. Nexu skills include: weather, calendar, email, github, file-organizer, healthcheck, and 30+ more. Returns the skill output as text.',
      name: 'invokeNexuSkill',
      parameters: {
        properties: {
          args: {
            additionalProperties: true,
            description: 'Key-value arguments to pass to the skill',
            type: 'object',
          },
          skill: {
            description: 'The Nexu skill name to invoke (e.g. "weather", "calendar", "github")',
            type: 'string',
          },
        },
        required: ['skill'],
        type: 'object',
      },
    },

    // ========================================================================
    // Shell Execution
    // ========================================================================
    {
      description:
        'Execute a shell command on the local machine via Nexu runtime. Returns stdout/stderr output. All shell commands require human confirmation before execution.',
      humanIntervention: 'required',
      name: 'shell',
      parameters: {
        properties: {
          command: {
            description: 'The shell command to execute (e.g. "ls -la", "git status")',
            type: 'string',
          },
          cwd: {
            description: 'Optional working directory for the command',
            type: 'string',
          },
          timeout: {
            default: 60000,
            description: 'Timeout in milliseconds (default: 60000, max: 300000)',
            type: 'number',
          },
        },
        required: ['command'],
        type: 'object',
      },
    },

    // ========================================================================
    // File Operations
    // ========================================================================
    {
      description: 'Read the content of a local file via Nexu file tool.',
      humanIntervention: {
        dynamic: { default: 'never', policy: 'required', type: 'pathScopeAudit' },
      },
      name: 'readFile',
      parameters: {
        properties: {
          encoding: {
            default: 'utf-8',
            description: 'File encoding (default: utf-8)',
            enum: ['utf-8', 'base64', 'binary'],
            type: 'string',
          },
          limit: {
            description: 'Maximum number of bytes to read (for large files)',
            type: 'number',
          },
          path: {
            description: 'Absolute path to the file to read',
            type: 'string',
          },
        },
        required: ['path'],
        type: 'object',
      },
    },
    {
      description: 'Write content to a local file via Nexu file tool. Creates or overwrites.',
      humanIntervention: {
        dynamic: { default: 'never', policy: 'required', type: 'pathScopeAudit' },
      },
      name: 'writeFile',
      parameters: {
        properties: {
          content: {
            description: 'The content to write to the file',
            type: 'string',
          },
          path: {
            description: 'Absolute path of the file to write',
            type: 'string',
          },
        },
        required: ['path', 'content'],
        type: 'object',
      },
    },
    {
      description: 'List files and directories at a given path.',
      humanIntervention: {
        dynamic: { default: 'never', policy: 'required', type: 'pathScopeAudit' },
      },
      name: 'listFiles',
      parameters: {
        properties: {
          path: {
            default: '.',
            description: 'Directory path to list (default: current directory)',
            type: 'string',
          },
          recursive: {
            default: false,
            description: 'Recursively list subdirectories',
            type: 'boolean',
          },
        },
        type: 'object',
      },
    },
    {
      description: 'Delete a file or empty directory.',
      humanIntervention: {
        dynamic: { default: 'never', policy: 'required', type: 'pathScopeAudit' },
      },
      name: 'deleteFile',
      parameters: {
        properties: {
          path: {
            description: 'Absolute path of the file or directory to delete',
            type: 'string',
          },
        },
        required: ['path'],
        type: 'object',
      },
    },

    // ========================================================================
    // Search & Content
    // ========================================================================
    {
      description:
        'Search for files by name pattern or content keywords, similar to find + grep combined.',
      humanIntervention: {
        dynamic: { default: 'never', policy: 'required', type: 'pathScopeAudit' },
      },
      name: 'searchFiles',
      parameters: {
        properties: {
          keywords: {
            description: 'Keywords to search for in file names and content',
            type: 'string',
          },
          path: {
            description: 'Root directory to search in (default: current working directory)',
            type: 'string',
          },
          fileTypes: {
            description: 'File extensions to filter by (e.g. ["ts", "tsx", "md"])',
            items: { type: 'string' },
            type: 'array',
          },
        },
        required: ['keywords'],
        type: 'object',
      },
    },
    {
      description: 'Search for regex patterns inside files. Returns matching lines with context.',
      humanIntervention: {
        dynamic: { default: 'never', policy: 'required', type: 'pathScopeAudit' },
      },
      name: 'grepContent',
      parameters: {
        properties: {
          pattern: {
            description: 'Regular expression pattern to search for',
            type: 'string',
          },
          path: {
            description: 'Directory or file path to search in',
            type: 'string',
          },
          '-i': {
            default: false,
            description: 'Case-insensitive search',
            type: 'boolean',
          },
          '-n': {
            default: true,
            description: 'Include line numbers in output',
            type: 'boolean',
          },
          output_mode: {
            default: 'content',
            description: 'Output format: content (lines), files_with_matches, count',
            enum: ['content', 'files_with_matches', 'count'],
            type: 'string',
          },
        },
        required: ['pattern'],
        type: 'object',
      },
    },

    // ========================================================================
    // Background Processes
    // ========================================================================
    {
      description:
        'Run a shell command in the background. Returns a shell_id for tracking.',
      humanIntervention: 'required',
      name: 'runBackground',
      parameters: {
        properties: {
          command: {
            description: 'The shell command to run in background',
            type: 'string',
          },
          cwd: {
            description: 'Working directory',
            type: 'string',
          },
        },
        required: ['command'],
        type: 'object',
      },
    },
    {
      description: 'Retrieve output from a running or completed background shell command.',
      name: 'getOutput',
      parameters: {
        properties: {
          shell_id: {
            description: 'The ID returned by runBackground',
            type: 'string',
          },
        },
        required: ['shell_id'],
        type: 'object',
      },
    },
    {
      description: 'Kill a running background shell command by its ID.',
      name: 'killProcess',
      parameters: {
        properties: {
          shell_id: {
            description: 'The ID of the background shell to kill',
            type: 'string',
          },
        },
        required: ['shell_id'],
        type: 'object',
      },
    },
  ],

  humanIntervention: 'required',

  identifier: BiochatIdentifier,

  meta: {
    avatar: '🤖',
    description:
      'Nexu/OpenClaw runtime bridge — brings 30+ Nexu skills (weather, calendar, email, github, file ops, scheduling) to LobeChat via local execution engine.',
    readme: `## Biochat: Nexu Runtime Connector

This plugin connects LobeChat to the Nexu/OpenClaw runtime, giving LobeChat access to 30+ skills including:

- **Productivity**: Email (IMAP/SMTP), Calendar management, Health tracking
- **Development**: GitHub issues/PRs, code search, file operations
- **Creative**: Image generation (Seedream, Kling), poster design (Mondo)
- **Research**: Web search, academic paper search (arXiv), deep research
- **Platform**: Feishu, WhatsApp, Discord, Telegram messaging

### Setup

1. Ensure OpenClaw is running on your machine (default: http://localhost:3141)
2. Add this plugin in LobeChat settings: \`http://localhost:18790/manifest.json\`
3. Start using Nexu skills directly in LobeChat conversations!

### Security

- Shell commands always require human confirmation
- File operations are scoped to workspace directories
- All API calls stay on localhost (no external data exfiltration)`,
    tags: ['nexu', 'openclaw', 'agent', 'skills', 'local-execution', 'productivity'],
    title: 'Nexu Connector',
  },

  systemRole: `You are Biochat, an AI assistant with the ability to execute real-world tasks through the Nexu runtime.

When asked to perform an action (check email, create a calendar event, search the web, manage files, run code), use the available tools to execute the request.

Available capabilities:
- Weather, calendar, email management
- GitHub issues and pull requests
- Local file read/write/search
- Shell command execution
- Web search and research
- Image generation and design
- Cross-platform messaging (Feishu, Discord, Telegram)

Always confirm potentially destructive operations before executing.`,

  type: 'builtin',
};
