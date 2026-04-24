/**
 * Ubuntu terminal simulator: commands are resolved from REGISTRO_COMANDOS.
 * sudo is handled in runCommand() and runs the rest of the line as root (elevated).
 */

const logs = [];
let sessionReady = true;
let lastPromptPath = "~";

/** @type {{ cwd: string }} */
const estado = {
    cwd: "~"
};

/** Virtual folders for ls / cd */
const VFS = {
    "~": ["Documents", "Downloads", "simulator.txt"],
    "~/Documents": ["notes.txt", "project/"],
    "~/Downloads": ["file.iso"],
    "/tmp": ["session.tmp"]
};

/**
 * @typedef {{ elevated?: boolean }} Ctx
 * @type {{ nome: string, descricao: string, aliases?: string[], exec: (args: string[], linha: string, ctx: Ctx) => string | { stdout: string, clear?: boolean, promptPath?: string } }[]}
 */
const REGISTRO_COMANDOS = [
    {
        nome: "help",
        descricao: "Lista todos os comandos registrados (sudo é tratado à parte; veja o texto de boas-vindas).",
        exec() {
            const sudoLine =
                "sudo <comando> — no Ubuntu executa como root (aqui é obrigatório para apt install/update/remove, chmod e chown).";
            const body = REGISTRO_COMANDOS.map((c) => {
                const extra = c.aliases?.length ? ` (${c.aliases.join(", ")})` : "";
                return `${c.nome}${extra} — ${c.descricao}`;
            }).join("\n");
            return `${sudoLine}\n${body}`;
        }
    },
    {
        nome: "clear",
        aliases: ["cls"],
        descricao: "Limpa a saída do terminal na tela.",
        exec() {
            return { stdout: "", clear: true, promptPath: lastPromptPath };
        }
    },
    {
        nome: "ls",
        descricao: "Lista arquivos do diretório virtual atual.",
        exec() {
            const key = estado.cwd === "~" ? "~" : estado.cwd;
            const list = VFS[key];
            if (!list) return "(empty or unknown directory)";
            return list.join("  ");
        }
    },
    {
        nome: "pwd",
        descricao: "Mostra o diretório de trabalho atual (simulado).",
        exec() {
            return estado.cwd.replace("~", "/home/rafael");
        }
    },
    {
        nome: "cd",
        descricao: "Muda de diretório (~, ~/Documents, ~/Downloads, /tmp).",
        exec(args) {
            const raw = args[1] || "~";
            const dest = raw.replace(/^\/home\/rafael(?=\/|$)/, "~").replace(/^\/home\/rafael$/, "~");
            const parent = () => {
                if (estado.cwd === "~" || estado.cwd === "/tmp") return "~";
                if (estado.cwd === "~/Documents" || estado.cwd === "~/Downloads") return "~";
                return "~";
            };
            const mapa = {
                "~": "~",
                ".": estado.cwd,
                "..": parent(),
                "~/Documents": "~/Documents",
                Documents: "~/Documents",
                "~/Downloads": "~/Downloads",
                Downloads: "~/Downloads",
                "/tmp": "/tmp",
                tmp: "/tmp"
            };
            let novo = mapa[dest];
            if (novo === undefined) {
                if (Object.prototype.hasOwnProperty.call(VFS, dest)) novo = dest;
                else return `bash: cd: ${raw}: No such file or directory (simulated)`;
            }
            estado.cwd = novo;
            return { stdout: "", promptPath: novo };
        }
    },
    {
        nome: "mkdir",
        descricao: "Cria diretório (simulado).",
        exec(args) {
            const n = args[1];
            if (!n) return "mkdir: missing operand";
            return `directory '${n}' created (simulation)`;
        }
    },
    {
        nome: "rmdir",
        descricao: "Remove diretório vazio (simulado).",
        exec(args) {
            if (!args[1]) return "rmdir: missing operand";
            return `directory removed (simulation)`;
        }
    },
    {
        nome: "touch",
        descricao: "Cria arquivo vazio ou atualiza data de modificação (simulado).",
        exec(args) {
            if (!args[1]) return "touch: missing file operand";
            return `timestamp updated for '${args[1]}' (simulation)`;
        }
    },
    {
        nome: "cat",
        descricao: "Exibe o conteúdo do arquivo (simulado).",
        exec(args) {
            if (!args[1]) return "cat: missing file operand";
            if (args[1].includes("simulator")) return "Ubuntu Terminal Simulator v1";
            return `contents of ${args[1]} (simulation)\nline1\nline2`;
        }
    },
    {
        nome: "echo",
        descricao: "Imprime os argumentos na saída padrão.",
        exec(args, linha) {
            const m = linha.match(/^\s*echo\s+(.*)$/i);
            return m ? m[1].replace(/^["']|["']$/g, "") : args.slice(1).join(" ");
        }
    },
    {
        nome: "rm",
        descricao: "Remove arquivos (simulado).",
        exec(args) {
            if (!args[1]) return "rm: missing operand";
            return `removed '${args[1]}' (simulation)`;
        }
    },
    {
        nome: "cp",
        descricao: "Copia arquivos (simulado).",
        exec(args) {
            if (args.length < 3) return "cp: missing file operand";
            return `copied ${args[1]} -> ${args[2]} (simulation)`;
        }
    },
    {
        nome: "mv",
        descricao: "Move ou renomeia arquivos (simulado).",
        exec(args) {
            if (args.length < 3) return "mv: missing file operand";
            return `moved ${args[1]} -> ${args[2]} (simulation)`;
        }
    },
    {
        nome: "head",
        descricao: "Mostra as primeiras linhas do arquivo (simulado).",
        exec() {
            return "first lines...\nalpha\nbeta";
        }
    },
    {
        nome: "tail",
        descricao: "Mostra as últimas linhas do arquivo (simulado).",
        exec() {
            return "gamma\ndelta\nlast lines...";
        }
    },
    {
        nome: "wc",
        descricao: "Conta linhas, palavras e bytes (simulado).",
        exec() {
            return "  12   48  512 file.txt (simulation)";
        }
    },
    {
        nome: "grep",
        descricao: "Busca ou filtra linhas por padrão (simulado).",
        exec() {
            return "match: line with pattern (simulation)";
        }
    },
    {
        nome: "find",
        descricao: "Busca arquivos na árvore de diretórios (simulado).",
        exec() {
            return "./src\n./src/main.js\n./public (simulation)";
        }
    },
    {
        nome: "chmod",
        descricao: "Altera permissões do arquivo — neste simulador exige sudo.",
        exec(args, _linha, ctx) {
            if (!ctx.elevated) {
                return (
                    `chmod: changing permissions of '${args[args.length - 1] || "file"}': Operation not permitted\n` +
                    `Try: sudo chmod ${args.slice(1).join(" ")}`
                );
            }
            if (args.length < 3) return "chmod: usage: chmod mode file";
            return `chmod: permissions updated on ${args[args.length - 1]} (simulation, as root)`;
        }
    },
    {
        nome: "chown",
        descricao: "Altera o dono do arquivo — neste simulador exige sudo.",
        exec(args, _linha, ctx) {
            if (!ctx.elevated) {
                return `chown: changing ownership of '${args[args.length - 1] || "file"}': Operation not permitted\nTry: sudo chown ${args.slice(1).join(" ")}`;
            }
            if (args.length < 3) return "chown: missing operand after 'chown'";
            return `chown: ownership updated (simulation, as root)`;
        }
    },
    {
        nome: "ps",
        descricao: "Lista processos em execução (simulado).",
        exec(_a, _l, ctx) {
            const user = ctx.elevated ? "root" : "rafael";
            return `  PID TTY      USER     CMD\n 1001 pts/0    ${user}    bash\n 1002 pts/0    ${user}    simulator`;
        }
    },
    {
        nome: "kill",
        descricao: "Envia sinal a um processo (simulado).",
        exec(args) {
            if (!args[1]) return "kill: usage: kill pid";
            return `signal sent to ${args[1]} (simulation)`;
        }
    },
    {
        nome: "top",
        descricao: "Monitor de processos em tempo real (simulado).",
        exec() {
            return "%CPU %MEM COMMAND\n 2.0  0.5 bash\n 1.0  0.3 simulator (simulation)";
        }
    },
    {
        nome: "df",
        descricao: "Espaço livre em disco (simulado).",
        exec() {
            return "Filesystem     1K-blocks\n/dev/sda1      102400000\n 5% used (simulation)";
        }
    },
    {
        nome: "du",
        descricao: "Uso de disco por diretório (simulado).",
        exec() {
            return "128K\t./src\n512K\t. (simulation)";
        }
    },
    {
        nome: "whoami",
        descricao: "Mostra o nome do usuário efetivo.",
        exec(_a, _l, ctx) {
            return ctx.elevated ? "root" : "rafael";
        }
    },
    {
        nome: "date",
        descricao: "Data e hora do sistema.",
        exec() {
            return new Date().toString();
        }
    },
    {
        nome: "uname",
        descricao: "Nome do kernel e informações do sistema (simulado).",
        exec(args) {
            if (args[1] === "-a") return "Linux ubuntu 5.15.0-generic x86_64 GNU/Linux (simulation)";
            return "Linux";
        }
    },
    {
        nome: "history",
        descricao: "Histórico de comandos desta sessão.",
        exec() {
            if (!logs.length) return "(empty)";
            return logs.map((l, i) => `${i + 1}  ${l}`).join("\n");
        }
    },
    {
        nome: "man",
        descricao: "Páginas de manual (simulado — use help).",
        exec(args) {
            const p = args[1] || "command";
            return `No local manual for '${p}'. Type help.`;
        }
    },
    {
        nome: "exit",
        descricao: "Encerra o shell (simulado).",
        exec() {
            return "logout (simulation — reload the page to reset)";
        }
    },
    {
        nome: "wget",
        descricao: "Download via HTTP (simulado).",
        exec(args) {
            if (!args[1]) return "wget: missing URL";
            return `downloading ${args[1]} -> file (simulation)`;
        }
    },
    {
        nome: "curl",
        descricao: "Cliente HTTP (simulado).",
        exec(args) {
            if (!args[1]) return "curl: try 'curl <URL>'";
            return `GET ${args[1]} -> 200 OK (body omitted, simulation)`;
        }
    },
    {
        nome: "ping",
        descricao: "Teste ICMP / conectividade (simulado).",
        exec(args) {
            const host = args[1] || "localhost";
            return `PING ${host}: 64 bytes (simulation)\n3 packets transmitted, 3 received`;
        }
    },
    {
        nome: "ifconfig",
        aliases: ["ip"],
        descricao: "Interfaces de rede (simulado).",
        exec() {
            return "eth0: inet 192.168.1.10  netmask 255.255.255.0 (simulation)\nlo: inet 127.0.0.1";
        }
    },
    {
        nome: "netstat",
        descricao: "Conexões de rede (simulado).",
        exec() {
            return "tcp  0  0 0.0.0.0:22  0.0.0.0:* LISTEN (simulation)";
        }
    },
    {
        nome: "ssh",
        descricao: "Shell remoto por SSH (simulado).",
        exec(args) {
            if (!args[1]) return "ssh: missing host";
            return `simulated connection to ${args[1]}`;
        }
    },
    {
        nome: "scp",
        descricao: "Cópia segura por SSH (simulado).",
        exec() {
            return "file copied via scp (simulation)";
        }
    },
    {
        nome: "nslookup",
        descricao: "Consulta DNS (simulado).",
        exec(args) {
            const h = args[1] || "example.com";
            return `Server: 8.8.8.8\nName: ${h}\nAddress: 93.184.216.34 (simulation)`;
        }
    },
    {
        nome: "traceroute",
        descricao: "Rota até o host na rede (simulado).",
        exec(args) {
            const h = args[1] || "example.com";
            return `traceroute to ${h} (3 hops, simulation)`;
        }
    },
    {
        nome: "route",
        descricao: "Tabela de rotas de rede (simulado).",
        exec() {
            return "Destination Gateway Genmask Flags\n0.0.0.0 192.168.1.1 0.0.0.0 UG (simulation)";
        }
    },
    {
        nome: "host",
        descricao: "Consulta DNS simples por nome (simulado).",
        exec(args) {
            return `${args[1] || "localhost"} has address 127.0.0.1 (simulation)`;
        }
    },
    {
        nome: "dig",
        descricao: "Consulta DNS detalhada (simulado).",
        exec() {
            return ";; ANSWER SECTION:\nexample.com. 300 IN A 93.184.216.34 (simulation)";
        }
    },
    {
        nome: "tree",
        descricao: "Mostra árvore de diretórios (simulado).",
        exec() {
            return ".\n├── Documents\n├── Downloads\n└── simulator.txt (simulation)";
        }
    },
    {
        nome: "nano",
        aliases: ["vi", "vim"],
        descricao: "Editor de texto no terminal (simulado, não interativo).",
        exec(args) {
            return `opening editor on ${args[1] || "file"} (simulation)`;
        }
    },
    {
        nome: "apt",
        descricao: "Gerenciador de pacotes — ações privilegiadas exigem sudo.",
        exec(args, _linha, ctx) {
            const sub = (args[1] || "").toLowerCase();
            const needsSudo = ["update", "upgrade", "install", "remove", "purge", "autoremove", "full-upgrade"].includes(sub);
            if (needsSudo && !ctx.elevated) {
                return (
                    `E: Could not open lock file /var/lib/dpkg/lock-frontend - open (13: Permission denied)\n` +
                    `E: Unable to acquire the dpkg frontend lock; are you root?\n` +
                    `Try: sudo apt ${args[1] || "update"} ...`
                );
            }
            if (needsSudo && ctx.elevated) {
                return `[sudo] apt ${args[1]}: OK (simulation). Package index / changes applied as root.`;
            }
            return `apt ${args[1] || ""}: no changes (simulation)`;
        }
    }
];

function construirIndice() {
    /** @type {Map<string, (typeof REGISTRO_COMANDOS)[0]>} */
    const mapa = new Map();
    for (const cmd of REGISTRO_COMANDOS) {
        mapa.set(cmd.nome.toLowerCase(), cmd);
        for (const a of cmd.aliases || []) {
            mapa.set(a.toLowerCase(), cmd);
        }
    }
    return mapa;
}

let INDICE_COMANDOS = construirIndice();

const SUDO_HELP =
    `[sudo] Ubuntu: sudo runs a single command with root privileges (essential for package and permission changes).\n` +
    `usage: sudo <command> [arguments]\n` +
    `Examples: sudo apt update | sudo apt install curl | sudo chmod 644 /etc/hosts\n` +
    `In this simulator, apt install/update/remove/…, chmod, and chown require sudo.`;

/** @type {(trimmed: string, ctx: Ctx) => { stdout: string, clear?: boolean, promptPath?: string }} */
function runCommand(trimmed, ctx) {
    if (!trimmed) return { stdout: "" };

    const partes = trimmed.split(/\s+/);
    const name = partes[0].toLowerCase();

    if (name === "sudo") {
        if (ctx.elevated) {
            return { stdout: "sudo: you are already root (simulation)" };
        }
        const inner = partes.slice(1).join(" ");
        if (!inner) {
            return { stdout: SUDO_HELP };
        }
        return runCommand(inner, { elevated: true });
    }

    const def = INDICE_COMANDOS.get(name);
    if (!def) {
        return {
            stdout: `bash: ${partes[0]}: command not found\nType help for the command list.`
        };
    }

    const raw = def.exec(partes, trimmed, ctx);
    if (typeof raw === "string") {
        return { stdout: raw };
    }
    return {
        stdout: raw.stdout ?? "",
        clear: raw.clear,
        promptPath: raw.promptPath
    };
}

function executarLocal(linha) {
    return runCommand(linha.trim(), { elevated: false });
}

/** TAB: registered names + sudo */
let availableCommands = [...new Set([...REGISTRO_COMANDOS.flatMap((c) => [c.nome, ...(c.aliases || [])]), "sudo"])].sort();

const commandList = {
    sudo: "Executa um comando como root — obrigatório para apt (install/update/…), chmod e chown neste simulador.",
    ...Object.fromEntries(REGISTRO_COMANDOS.map((c) => [c.nome, c.descricao]))
};

/** Ordem no menu lateral: 30 gerais + 10 rede (+ sudo + outros). */
const SIDEBAR_GERAL_30 = [
    "help",
    "clear",
    "ls",
    "pwd",
    "cd",
    "mkdir",
    "rmdir",
    "touch",
    "cat",
    "echo",
    "rm",
    "cp",
    "mv",
    "head",
    "tail",
    "wc",
    "grep",
    "find",
    "chmod",
    "chown",
    "ps",
    "kill",
    "top",
    "df",
    "du",
    "whoami",
    "date",
    "uname",
    "history",
    "exit"
];

const SIDEBAR_REDE_10 = [
    "ping",
    "ifconfig",
    "netstat",
    "wget",
    "curl",
    "ssh",
    "scp",
    "nslookup",
    "traceroute",
    "route"
];

const SIDEBAR_OUTROS_6 = ["man", "tree", "nano", "apt", "host", "dig"];

const input = document.getElementById("commandInput");
const output = document.getElementById("terminalOutput");
const sidebar = document.getElementById("sidebarCommands");

function escapeHtml(s) {
    return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

/** Bash-style colored prompt (path is escaped). */
function formatPromptHtml(promptPath) {
    const p = escapeHtml(promptPath || "~");
    return (
        `<span class="prompt-user">rafael</span><span class="prompt-at">@</span>` +
        `<span class="prompt-host">ubuntu</span><span class="prompt-colon">:</span>` +
        `<span class="prompt-path">${p}</span><span class="prompt-dollar">$</span>`
    );
}

function appendOutput(html) {
    output.innerHTML += html;
    output.scrollTop = output.scrollHeight;
}

function updatePromptDisplay(promptPath) {
    const html = formatPromptHtml(promptPath);
    document.querySelectorAll(".input-line .prompt").forEach((el) => {
        el.innerHTML = html;
    });
}

function fillSidebar() {
    sidebar.innerHTML = "";
    nomesSidebar.forEach((cmd) => {
        const div = document.createElement("div");
        div.className = "command-item";
        div.innerHTML = `<span class='cmd-name'>${escapeHtml(cmd)}</span>: ${escapeHtml(commandList[cmd] || "")}`;
        sidebar.appendChild(div);
    });
}

function initTerminal() {
    fillSidebar();
    lastPromptPath = "~";
    estado.cwd = "~";
    updatePromptDisplay(lastPromptPath);
    sessionReady = true;
}

input.addEventListener("keydown", (e) => {
    if (e.key === "Tab") {
        e.preventDefault();
        const val = input.value.trim().split(/\s+/)[0] || "";
        if (!val) return;
        const matches = availableCommands.filter((c) => c.startsWith(val));
        if (matches.length === 1) {
            const rest = input.value.trim().slice(val.length).trim();
            input.value = rest ? `${matches[0]} ${rest}` : matches[0];
        }
    }

    if (e.key === "Enter") {
        void handleEnter();
    }
});

function handleEnter() {
    const fullCmd = input.value.trim();
    input.value = "";
    if (!fullCmd) return;

    if (!sessionReady) {
        appendOutput(
            `<div class="cmd-line"><span class="prompt">${formatPromptHtml(lastPromptPath)}</span> ${escapeHtml(fullCmd)}</div>` +
                `<div class="cmd-output cmd-output--error">Terminal not ready.</div>`
        );
        return;
    }

    appendOutput(`<div class="cmd-line"><span class="prompt">${formatPromptHtml(lastPromptPath)}</span> ${escapeHtml(fullCmd)}</div>`);

    try {
        logs.push(`[${new Date().toLocaleTimeString()}] ${fullCmd}`);

        const { stdout, clear, promptPath } = executarLocal(fullCmd);

        if (promptPath !== undefined) {
            lastPromptPath = promptPath;
        }

        if (clear) {
            output.innerHTML = "";
            updatePromptDisplay(lastPromptPath);
            return;
        }

        if (stdout !== "") {
            appendOutput(`<div class="cmd-output">${escapeHtml(stdout)}</div>`);
        }
        updatePromptDisplay(lastPromptPath);
    } catch (err) {
        appendOutput(
            `<div class="cmd-output cmd-output--error">${escapeHtml(String(err.message || err))}</div>`
        );
    }
}

function openModal(id) {
    document.getElementById(id).classList.add("is-open");
    if (id === "modalLog") {
        document.getElementById("logContent").innerHTML =
            logs.map((l) => `<div>${escapeHtml(l)}</div>`).join("") || "No commands yet.";
    }
}

function closeModal(id) {
    document.getElementById(id).classList.remove("is-open");
}

/** Telão / apresentação: escala `rem` via `font-size` no elemento `html`. */
const FONT_SCALE_STEPS = [
    { classes: [], label: "Padrão", hint: "Tamanho normal da interface." },
    { classes: ["fs-telao-1"], label: "Grande", hint: "Melhor leitura em telão ou projetor." },
    { classes: ["fs-telao-2"], label: "Extra", hint: "Fonte ainda maior para longa distância." }
];

let fontScaleIndex = 0;

function syncFontScaleButton() {
    const step = FONT_SCALE_STEPS[fontScaleIndex];
    const stepEl = document.getElementById("btnFontSizeStep");
    const btn = document.getElementById("btnFontSize");
    if (stepEl) {
        stepEl.textContent = `${fontScaleIndex + 1}/${FONT_SCALE_STEPS.length}`;
    }
    if (btn) {
        btn.title = `${step.label} — ${step.hint} Clique para alternar.`;
        btn.setAttribute(
            "aria-label",
            `Tamanho da fonte: ${step.label}. ${step.hint} Clique para o próximo nível.`
        );
    }
}

function cyclePresentationFont() {
    const html = document.documentElement;
    html.classList.remove("fs-telao-1", "fs-telao-2");
    fontScaleIndex = (fontScaleIndex + 1) % FONT_SCALE_STEPS.length;
    for (const c of FONT_SCALE_STEPS[fontScaleIndex].classes) {
        html.classList.add(c);
    }
    syncFontScaleButton();
    try {
        sessionStorage.setItem("linuxSimFontScale", String(fontScaleIndex));
    } catch {
        /* ignore */
    }
}

function applySavedFontScale() {
    let idx = 0;
    try {
        const s = sessionStorage.getItem("linuxSimFontScale");
        if (s != null) {
            const n = parseInt(s, 10);
            if (Number.isFinite(n) && n >= 0 && n < FONT_SCALE_STEPS.length) idx = n;
        }
    } catch {
        /* ignore */
    }
    const html = document.documentElement;
    html.classList.remove("fs-telao-1", "fs-telao-2");
    fontScaleIndex = idx;
    for (const c of FONT_SCALE_STEPS[fontScaleIndex].classes) {
        html.classList.add(c);
    }
    syncFontScaleButton();
}

applySavedFontScale();
initTerminal();
