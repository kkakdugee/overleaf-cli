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

Copy the example config and add your project:

```
cp projects.json.example projects.json
```

Edit `projects.json` with your Overleaf Git URL (find it in Overleaf under Menu > Git):

```json
{
  "projects": [
    {
      "name": "math-homework",
      "git_url": "https://git.overleaf.com/YOUR_PROJECT_ID"
    }
  ]
}
```

Then add it to your Claude Code MCP config:

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

Restart Claude Code and you're good.

## Usage

Examples:

- "sync my math-homework project" - pulls latest from Overleaf (clones on first run)
- "list the files in math-homework"
- "read main.tex from math-homework"
- "add a new section about integrals to main.tex and push it"

The first time you sync, git will ask for credentials. Username can be anything, password is your Overleaf token (Account Settings > Git Integration). You can store it with `git credential` so it doesn't keep asking.

## Tools

| Tool | Description |
|------|-------------|
| `sync` | Clone or pull latest from Overleaf |
| `list_files` | List all files in a project |
| `read_file` | Read a file's contents |
| `write_file` | Write a file, commit, and push to Overleaf |

## How it works

Projects get cloned into `.cache/` on first sync, then `git pull` after that. Writes go through `git add > commit > push`. Overleaf picks up changes within a few seconds.
