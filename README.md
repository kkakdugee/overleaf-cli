# overleaf-cli

MCP server for reading and writing Overleaf projects from Claude Code, through Overleaf's Git integration.

## Requirements

- Node.js 18+
- Overleaf premium (for Git integration)
- Claude Code

## Setup

Install dependencies:

```
npm install
```

Create a `projects.json` (can be empty to start, projects can be added through Claude):

```
cp projects.json.example projects.json
```

Add your Overleaf token to `.env`:

```
cp .env.example .env
```

Then edit `.env` with your token (from Overleaf Account Settings > Git Integration).

Add it to Claude Code MCP config:

```json
{
  "mcpServers": {
    "overleaf": {
      "command": "node",
      "args": ["/absolute/path/to/overleaf-cli/server.js"]
    }
  }
}
```

Or run one of these:

```
# available everywhere
claude mcp add --scope user overleaf -- node /absolute/path/to/overleaf-cli/server.js

# available in current folder only
claude mcp add overleaf -- node /absolute/path/to/overleaf-cli/server.js
```

Restart Claude Code and you're good.

## Usage

Examples:

- "sync my math-homework project" - pulls latest from Overleaf (clones on first run)
- "list the files in math-homework"
- "read main.tex from math-homework"
- "add a new section about integrals to main.tex and push it"
- "add my project https://www.overleaf.com/project/abc123 as phys-225"

## Tools

| Tool | Description |
|------|-------------|
| `sync` | Clone or pull latest from Overleaf |
| `list_files` | List all files in a project |
| `read_file` | Read a file's contents |
| `write_file` | Write a file, commit, and push to Overleaf |
| `add_project` | Add a new project by name and Overleaf URL |

## How it works

Projects get cloned into `.cache/` on first sync, then `git pull` after that. Writes go through `git add > commit > push`. Overleaf picks up changes within a few seconds.
