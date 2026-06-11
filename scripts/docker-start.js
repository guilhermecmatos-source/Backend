const { spawn } = require("child_process");

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: "inherit", shell: true });
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exit ${code}`))));
  });
}

(async () => {
  console.log("[backend] Aguardando MySQL e aplicando migrações...");
  await run("npm", ["run", "db:migrate"]);
  console.log("[backend] Iniciando API...");
  const dev = spawn("npm", ["run", "dev"], { stdio: "inherit", shell: true });
  dev.on("close", (code) => process.exit(code ?? 0));
})().catch((err) => {
  console.error("[backend] Falha ao iniciar:", err.message);
  process.exit(1);
});
