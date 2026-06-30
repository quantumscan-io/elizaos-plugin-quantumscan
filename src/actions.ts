import type {
  Action,
  IAgentRuntime,
  Memory,
  State,
  HandlerCallback,
  HandlerOptions,
} from "@elizaos/core";

const CONTRACT_RE = /\b(0x[0-9a-fA-F]{40})\b/;
const NETWORK_RE = /\b(?:network|chain)[:\s]+(\d+)/i;

const API_BASE = process.env.QUANTUMSCAN_API_URL ?? "https://quantumscan.io";
const API_KEY = process.env.QUANTUMSCAN_API_KEY ?? "";

const REPO_URL_RE = /(https?:\/\/)?(?:github|gitlab|bitbucket)\.(?:com|org)\/[^\s\n"']+/i;

function apiHeaders(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (API_KEY) h["X-API-Key"] = API_KEY;
  return h;
}

// ── SCAN_REPOSITORY ──────────────────────────────────────────────────────────

export const scanRepositoryAction: Action = {
  name: "SCAN_REPOSITORY",
  description:
    "Scan a GitHub, GitLab, or Bitbucket repository for post-quantum cryptography (PQC) vulnerabilities. " +
    "Returns a scan ID. Use GET_SCAN_RESULT to retrieve the result.",
  similes: [
    "CHECK_PQC",
    "AUDIT_CRYPTO",
    "QUANTUM_SCAN",
    "SCAN_REPO",
    "CHECK_QUANTUM_SAFETY",
    "ANALYZE_CRYPTOGRAPHY",
    "PQC_AUDIT",
  ],
  validate: async (_runtime: IAgentRuntime, message: Memory) => {
    const text = (message.content.text as string | undefined) ?? "";
    return REPO_URL_RE.test(text);
  },
  handler: async (
    _runtime: IAgentRuntime,
    message: Memory,
    _state: State | undefined,
    _options: HandlerOptions | undefined,
    callback: HandlerCallback | undefined,
  ) => {
    const text = (message.content.text as string | undefined) ?? "";
    const match = text.match(REPO_URL_RE);
    if (!match) {
      await callback?.({ text: "Could not find a valid repository URL in the message." });
      return;
    }

    const repoUrl = match[0].startsWith("http") ? match[0] : `https://${match[0]}`;

    try {
      const res = await fetch(`${API_BASE}/api/a2a`, {
        method: "POST",
        headers: apiHeaders(),
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tasks/send",
          params: {
            message: {
              parts: [{ type: "text", text: `Scan ${repoUrl} for quantum vulnerabilities` }],
            },
          },
        }),
      });

      const data = (await res.json()) as {
        result?: { id: string; metadata?: { scanUrl?: string } };
        error?: { message: string };
      };

      if (data.error) {
        await callback?.({ text: `Scan error: ${data.error.message}` });
        return;
      }

      const scanId = data.result?.id ?? "";
      const scanUrl = data.result?.metadata?.scanUrl ?? `${API_BASE}/scan/${scanId}`;

      await callback?.({
        text:
          `PQC scan submitted for ${repoUrl}.\n` +
          `Scan ID: \`${scanId}\`\n` +
          `Results in ~60 seconds. Use GET_SCAN_RESULT with this ID, or view: ${scanUrl}`,
        actions: ["SCAN_REPOSITORY"],
      });

      message.content.scanId = scanId;
    } catch (e) {
      await callback?.({ text: `Failed to submit scan: ${e instanceof Error ? e.message : String(e)}` });
    }
  },
  examples: [
    [
      {
        name: "user",
        content: { text: "Can you scan https://github.com/uniswap/v3-core for quantum vulnerabilities?" },
      },
      {
        name: "agent",
        content: {
          text: "PQC scan submitted for https://github.com/uniswap/v3-core.\nScan ID: `abc-123`\nResults in ~60 seconds.",
          actions: ["SCAN_REPOSITORY"],
        },
      },
    ],
    [
      {
        name: "user",
        content: { text: "Is github.com/aave/aave-v3-core quantum-safe?" },
      },
      {
        name: "agent",
        content: {
          text: "PQC scan submitted for https://github.com/aave/aave-v3-core.\nScan ID: `def-456`\nResults in ~60 seconds.",
          actions: ["SCAN_REPOSITORY"],
        },
      },
    ],
  ],
};

// ── GET_SCAN_RESULT ──────────────────────────────────────────────────────────

export const getScanResultAction: Action = {
  name: "GET_SCAN_RESULT",
  description:
    "Retrieve the result of a previously submitted QuantumScan. " +
    "Provide the scan ID returned by SCAN_REPOSITORY. " +
    "Returns quantum risk score (0-100), list of vulnerable primitives, and CBOM manifest.",
  similes: [
    "GET_SCAN",
    "CHECK_SCAN",
    "SCAN_STATUS",
    "PQC_RESULT",
    "GET_PQC_REPORT",
  ],
  validate: async (_runtime: IAgentRuntime, message: Memory) => {
    const text = (message.content.text as string | undefined) ?? "";
    return /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(text) ||
      /scan.?result|scan.?status|get.?scan/i.test(text);
  },
  handler: async (
    _runtime: IAgentRuntime,
    message: Memory,
    _state: State | undefined,
    _options: HandlerOptions | undefined,
    callback: HandlerCallback | undefined,
  ) => {
    const text = (message.content.text as string | undefined) ?? "";
    const uuidMatch = text.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    const scanId = uuidMatch?.[0] ?? (message.content.scanId as string | undefined);

    if (!scanId) {
      await callback?.({ text: "Please provide a scan ID (UUID format) to retrieve the result." });
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/a2a`, {
        method: "POST",
        headers: apiHeaders(),
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 2,
          method: "tasks/get",
          params: { id: scanId },
        }),
      });

      const data = (await res.json()) as {
        result?: {
          id: string;
          status: { state: string };
          metadata?: { quantumRiskScore?: number; repoUrl?: string; scanUrl?: string };
          artifacts?: { name: string; parts: { type: string; text?: string; data?: unknown }[] }[];
          error?: string;
        };
        error?: { message: string };
      };

      if (data.error) {
        await callback?.({ text: `Error: ${data.error.message}` });
        return;
      }

      const task = data.result!;
      const scanState = task.status.state;

      if (scanState !== "completed") {
        await callback?.({
          text: `Scan status: **${scanState}**\nScan ID: \`${scanId}\`\n${scanState === "failed" ? `Error: ${task.error}` : "Check back in 30-60 seconds."}`,
        });
        return;
      }

      const meta = task.metadata ?? {};
      const summary = task.artifacts?.find((a) => a.name === "scan-summary");
      const summaryText = summary?.parts?.find((p) => p.type === "text")?.text ?? "";

      await callback?.({
        text: `**PQC Scan Complete**\n\n${summaryText}\n\nFull report: ${meta.scanUrl ?? `${API_BASE}/scan/${scanId}`}`,
        actions: ["GET_SCAN_RESULT"],
      });
    } catch (e) {
      await callback?.({ text: `Failed to get scan result: ${e instanceof Error ? e.message : String(e)}` });
    }
  },
  examples: [
    [
      {
        name: "user",
        content: { text: "Get result for scan 421842e1-e9ec-431f-91e7-569deeb2e224" },
      },
      {
        name: "agent",
        content: {
          text: "**PQC Scan Complete**\n\nRepository: ...\nRisk Score: 72/100\nVulnerable primitives: 3/4",
          actions: ["GET_SCAN_RESULT"],
        },
      },
    ],
  ],
};

// ── SCAN_CONTRACT ────────────────────────────────────────────────────────────

export const scanContractAction: Action = {
  name: "SCAN_CONTRACT",
  description:
    "Scan a verified on-chain smart contract for quantum-vulnerable cryptography AND today's fraud patterns " +
    "(rug pulls, honeypots, uncapped mints, reentrancy) BEFORE signing or interacting. " +
    "Accepts any Ethereum-format contract address (0x...). " +
    "Returns risk score 0-100 and a clear SAFE / CAUTION / BLOCK recommendation. Synchronous.",
  similes: [
    "CHECK_CONTRACT",
    "AUDIT_CONTRACT",
    "SCAN_SMART_CONTRACT",
    "PRE_TRANSACTION_CHECK",
    "CONTRACT_RISK",
    "CHECK_BEFORE_SIGN",
    "VERIFY_CONTRACT",
    "PQC_CONTRACT",
  ],
  validate: async (_runtime: IAgentRuntime, message: Memory) => {
    const text = (message.content.text as string | undefined) ?? "";
    return CONTRACT_RE.test(text);
  },
  handler: async (
    _runtime: IAgentRuntime,
    message: Memory,
    _state: State | undefined,
    _options: HandlerOptions | undefined,
    callback: HandlerCallback | undefined,
  ) => {
    const text = (message.content.text as string | undefined) ?? "";
    const addressMatch = text.match(CONTRACT_RE);
    if (!addressMatch) {
      await callback?.({ text: "No valid contract address (0x...) found in the message." });
      return;
    }
    const address = addressMatch[1];
    const networkMatch = text.match(NETWORK_RE);
    const network = networkMatch ? parseInt(networkMatch[1], 10) : 1;

    try {
      const res = await fetch(`${API_BASE}/api/mcp`, {
        method: "POST",
        headers: apiHeaders(),
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 4,
          method: "tools/call",
          params: { name: "scan_contract", arguments: { contract_address: address, network } },
        }),
      });

      const data = (await res.json()) as {
        result?: { content: { type: string; text?: string }[] };
        error?: { message: string };
      };

      if (data.error) {
        await callback?.({ text: `Scan error: ${data.error.message}` });
        return;
      }

      const resultText = data.result?.content?.find((c) => c.type === "text")?.text ?? "No result.";
      await callback?.({
        text: `**Pre-Transaction Security Scan**\n\n${resultText}`,
        actions: ["SCAN_CONTRACT"],
      });
    } catch (e) {
      await callback?.({ text: `Contract scan failed: ${e instanceof Error ? e.message : String(e)}` });
    }
  },
  examples: [
    [
      {
        name: "user",
        content: { text: "Before I interact with 0xdAC17F958D2ee523a2206206994597C13D831ec7, is it quantum-safe?" },
      },
      {
        name: "agent",
        content: {
          text: "**Pre-Transaction Security Scan**\n\nContract: 0xdAC17F958D2ee523a2206206994597C13D831ec7\nNetwork: Ethereum Mainnet\nRisk Score: 45/100\n→ PROCEED WITH CAUTION",
          actions: ["SCAN_CONTRACT"],
        },
      },
    ],
    [
      {
        name: "user",
        content: { text: "Scan 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 for fraud patterns before I sign" },
      },
      {
        name: "agent",
        content: {
          text: "**Pre-Transaction Security Scan**\n\nContract: 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48\nRisk Score: 12/100\n→ SAFE TO INTERACT",
          actions: ["SCAN_CONTRACT"],
        },
      },
    ],
  ],
};

// ── CHECK_PQC_RISK ───────────────────────────────────────────────────────────

export const checkPqcRiskAction: Action = {
  name: "CHECK_PQC_RISK",
  description:
    "Instant check: is a specific cryptographic algorithm quantum-vulnerable? " +
    "No scan needed, responds immediately. " +
    "Useful to quickly assess risk before interacting with a protocol.",
  similes: [
    "IS_QUANTUM_SAFE",
    "PQC_CHECK",
    "ALGO_RISK",
    "CHECK_ALGORITHM",
    "QUANTUM_RISK",
  ],
  validate: async (_runtime: IAgentRuntime, message: Memory) => {
    const text = (message.content.text as string | undefined) ?? "";
    return /ecdsa|rsa|aes|sha|elliptic|quantum.?safe|pqc.?check|ml-dsa|ml-kem/i.test(text);
  },
  handler: async (
    _runtime: IAgentRuntime,
    message: Memory,
    _state: State | undefined,
    _options: HandlerOptions | undefined,
    callback: HandlerCallback | undefined,
  ) => {
    const text = (message.content.text as string | undefined) ?? "";
    const algoMatches = text.match(
      /(?:ECDSA|RSA(?:-\d+)?|AES(?:-\d+)?|SHA(?:-\d+)?|Ed25519|X25519|DH|ECDH|ML-DSA|ML-KEM|SLH-DSA|BLS12-381|DSA)/gi,
    ) ?? [];

    const algorithms = [...new Set(algoMatches)];

    if (algorithms.length === 0) {
      await callback?.({ text: "No recognized algorithm names found. Try mentioning ECDSA, RSA, AES-128, etc." });
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/mcp`, {
        method: "POST",
        headers: apiHeaders(),
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 3,
          method: "tools/call",
          params: { name: "check_pqc_risk", arguments: { algorithms } },
        }),
      });

      const data = (await res.json()) as {
        result?: { content: { type: string; text?: string }[] };
        error?: { message: string };
      };

      const resultText = data.result?.content?.find((c) => c.type === "text")?.text ?? "No data.";
      await callback?.({ text: `**PQC Risk Assessment**\n\n${resultText}`, actions: ["CHECK_PQC_RISK"] });
    } catch (e) {
      await callback?.({ text: `Check failed: ${e instanceof Error ? e.message : String(e)}` });
    }
  },
  examples: [
    [
      {
        name: "user",
        content: { text: "Is ECDSA quantum safe?" },
      },
      {
        name: "agent",
        content: {
          text: "**PQC Risk Assessment**\n\nECDSA: VULNERABLE to Shor's algorithm. Migration target: ML-DSA-65 (NIST FIPS 204)",
          actions: ["CHECK_PQC_RISK"],
        },
      },
    ],
  ],
};
