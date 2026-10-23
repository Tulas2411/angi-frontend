import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  symlink,
  writeFile,
} from "node:fs/promises";
import { execFileSync, spawn } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Each test server owns its source/output snapshot. A user's running preview is untouched.
const workspace = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cache = join(workspace, ".cache");
await mkdir(cache, { recursive: true });
const preview = await mkdtemp(join(cache, "owner-test-"));
const sourceRef = process.env.ANGI_TEST_SOURCE_REF;
if (sourceRef && sourceRef !== "dev")
  throw new Error(
    "Only the local dev ref is supported for read-only source checks.",
  );
if (sourceRef) {
  const head = execFileSync("git", ["rev-parse", sourceRef], {
    cwd: workspace,
    encoding: "utf8",
    windowsHide: true,
  }).trim();
  const archive = join(preview, "source.tar");
  execFileSync(
    "git",
    ["archive", "--format=tar", `--output=${archive}`, head],
    {
      cwd: workspace,
      windowsHide: true,
    },
  );
  execFileSync("tar", ["-xf", archive, "-C", preview], { windowsHide: true });
  console.log(`Testing read-only ${sourceRef} source snapshot ${head}`);
} else
  await Promise.all([
    ...["src", "public"].map((name) =>
      cp(join(workspace, name), join(preview, name), { recursive: true }),
    ),
    ...[
      "package.json",
      "package-lock.json",
      "tsconfig.json",
      "next-env.d.ts",
    ].map(async (name) => {
      try {
        await cp(join(workspace, name), join(preview, name));
      } catch (error) {
        if (name !== "next-env.d.ts" || error.code !== "ENOENT") throw error;
      }
    }),
  ]);
await symlink(
  join(workspace, "node_modules"),
  join(preview, "node_modules"),
  process.platform === "win32" ? "junction" : "dir",
);
const config = await readFile(
  join(sourceRef ? preview : workspace, "next.config.ts"),
  "utf8",
);
if (!config.includes("turbopack: {"))
  throw new Error("Expected the repository's Turbopack configuration.");
await writeFile(
  join(preview, "next.config.ts"),
  config.replace(
    "turbopack: {",
    `turbopack: { root: ${JSON.stringify(workspace)},`,
  ),
);
const production = process.argv.includes("--production");
let child;
let stopping = false;
function launch(args) {
  child = spawn(
    process.execPath,
    [join(workspace, "node_modules/next/dist/bin/next"), ...args],
    { cwd: preview, env: process.env, stdio: "inherit", windowsHide: true },
  );
  child.on("error", (error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
  child.on("exit", (code) => {
    if (!stopping && production && args[0] === "build" && code === 0)
      launch(["start", "--port", "3001"]);
    else process.exitCode = code ?? 1;
  });
}
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    stopping = true;
    child.kill(signal);
  });
launch(
  production || process.argv.includes("--build")
    ? ["build"]
    : ["dev", "--port", "3001"],
);
