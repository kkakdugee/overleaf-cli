import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { execFile } from "node:child_process";
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, readFileSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = join(__dirname, ".cache");
const CONFIG_PATH = join(__dirname, "projects.json");

// --- Config ---

function loadConfig() {
  if (!existsSync(CONFIG_PATH)) {
    throw new Error(
      "projects.json not found. Copy projects.json.example to projects.json and fill in your Overleaf project details."
    );
  }
  return JSON.parse(readFileSync(CONFIG_PATH, "utf-8")).projects;
}

// --- Git helpers ---

function git(args, cwd) {
  return new Promise((resolve, reject) => {
    execFile("git", args, { cwd, timeout: 60_000 }, (err, stdout, stderr) => {
      if (err) {
        reject(new Error(`git ${args[0]} failed: ${stderr || err.message}`));
      } else {
        resolve(stdout.trim());
      }
    });
  });
}

function projectDir(name) {
  return join(CACHE_DIR, name);
}

// --- File walking ---

async function walk(dir, base = dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === ".git") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(full, base)));
    } else {
      files.push(relative(base, full).replaceAll("\\", "/"));
    }
  }
  return files;
}

// --- Load config ---

let projects;
try {
  projects = loadConfig();
} catch (e) {
  console.error(e.message);
  process.exit(1);
}

function findProject(name) {
  const p = projects.find(
    (p) => p.name.toLowerCase() === name.toLowerCase()
  );
  if (!p) {
    const names = projects.map((p) => p.name).join(", ");
    throw new Error(`Project "${name}" not found. Available: ${names}`);
  }
  return p;
}

// --- MCP Server ---

const server = new McpServer({
  name: "overleaf",
  version: "1.0.0",
});

// Tool: sync
server.tool(
  "sync",
  "Pull the latest version of an Overleaf project. Clones on first use, pulls after. Always call this before reading to ensure you have the latest.",
  { project: z.string().describe("Project name from projects.json") },
  async ({ project }) => {
    const p = findProject(project);
    const dir = projectDir(p.name);

    await mkdir(CACHE_DIR, { recursive: true });

    if (existsSync(join(dir, ".git"))) {
      const output = await git(["pull"], dir);
      return { content: [{ type: "text", text: `Pulled latest:\n${output}` }] };
    } else {
      await git(["clone", p.git_url, dir]);
      return { content: [{ type: "text", text: `Cloned project "${p.name}" successfully.` }] };
    }
  }
);

// Tool: list_files
server.tool(
  "list_files",
  "List all files in an Overleaf project.",
  { project: z.string().describe("Project name from projects.json") },
  async ({ project }) => {
    const p = findProject(project);
    const dir = projectDir(p.name);

    if (!existsSync(dir)) {
      return {
        content: [{ type: "text", text: `Project not synced yet. Run sync first.` }],
        isError: true,
      };
    }

    const files = await walk(dir);
    return { content: [{ type: "text", text: files.join("\n") }] };
  }
);

// Tool: read_file
server.tool(
  "read_file",
  "Read a file from an Overleaf project.",
  {
    project: z.string().describe("Project name from projects.json"),
    path: z.string().describe("File path relative to project root (e.g. main.tex)"),
  },
  async ({ project, path }) => {
    const p = findProject(project);
    const dir = projectDir(p.name);

    if (!existsSync(dir)) {
      return {
        content: [{ type: "text", text: `Project not synced yet. Run sync first.` }],
        isError: true,
      };
    }

    const fullPath = join(dir, path);
    if (!fullPath.startsWith(dir)) {
      return {
        content: [{ type: "text", text: `Invalid path.` }],
        isError: true,
      };
    }

    try {
      const content = await readFile(fullPath, "utf-8");
      return { content: [{ type: "text", text: content }] };
    } catch {
      return {
        content: [{ type: "text", text: `File not found: ${path}` }],
        isError: true,
      };
    }
  }
);

// Tool: write_file
server.tool(
  "write_file",
  "Write a file to an Overleaf project and push the change. Commits and pushes automatically.",
  {
    project: z.string().describe("Project name from projects.json"),
    path: z.string().describe("File path relative to project root (e.g. main.tex)"),
    content: z.string().describe("The full file content to write"),
    message: z
      .string()
      .default("Update from Claude")
      .describe("Commit message"),
  },
  async ({ project, path, content, message }) => {
    const p = findProject(project);
    const dir = projectDir(p.name);

    if (!existsSync(dir)) {
      return {
        content: [{ type: "text", text: `Project not synced yet. Run sync first.` }],
        isError: true,
      };
    }

    const fullPath = join(dir, path);
    if (!fullPath.startsWith(dir)) {
      return {
        content: [{ type: "text", text: `Invalid path.` }],
        isError: true,
      };
    }

    // Ensure parent directory exists
    await mkdir(dirname(fullPath), { recursive: true });

    // Write, stage, commit, push
    await writeFile(fullPath, content, "utf-8");
    await git(["add", path], dir);
    await git(["commit", "-m", message], dir);
    await git(["push"], dir);

    return {
      content: [
        { type: "text", text: `Wrote ${path}, committed ("${message}"), and pushed to Overleaf.` },
      ],
    };
  }
);

// --- Start ---

const transport = new StdioServerTransport();
await server.connect(transport);
