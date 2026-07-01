/**
 * QuantumScan PQC Risk Feed — Chainlink Runtime Environment (CRE) workflow.
 *
 * Chainlink Functions was sunset 2026-06-30; this targets its replacement, CRE
 * (https://docs.chain.link/cre). Every ~30 minutes, the DON independently calls
 * QuantumScan's check-pqc-risk endpoint, aggregates the result via consensus
 * (so no single node can lie about the risk score), and the aggregated value
 * can be written on-chain to any contract that implements the CRE `IReceiver`
 * pattern (see PQCRiskConsumer.sol in this folder).
 *
 * Auth: QuantumScan's /api/agent/check-pqc-risk is a paid "guard" tier endpoint
 * (see quantumscan-web/src/lib/payments/pricing.ts). A cron job hitting it every
 * 30 min needs a prepaid API key, not x402 (CRE workflows can't sign x402
 * payments — no private-key/wallet capability is exposed to the WASM sandbox).
 * Set the key as a CRE secret: `cre secrets set QUANTUMSCAN_API_KEY=qs_...`
 * (register a free key: POST https://quantumscan.io/api/agent/register).
 *
 * Setup:
 *   1. bun add @chainlink/cre-sdk
 *   2. cre secrets set QUANTUMSCAN_API_KEY=qs_...
 *   3. cre workflow simulate --target local-simulation --config config.json workflow.ts
 *   4. cre workflow simulate ... --broadcast   (to actually write on-chain)
 */

import {
  cre,
  consensusMedianAggregation,
  getNetwork,
  prepareReportRequest,
  type HTTPSendRequester,
  type Runtime,
  ok,
  json,
} from "@chainlink/cre-sdk";
import { encodeFunctionData } from "viem";

type Config = {
  schedule: string;
  apiUrl: string;
  algorithms: string[];
  evms: { chainSelectorName: string; contractAddress: string }[];
};

// Maps QuantumScan's PQC_STATUS string to a single on-chain-friendly uint8.
// 0 = SAFE, 1 = PARTIALLY_SAFE, 2 = VULNERABLE, 3 = UNKNOWN.
function statusToCode(status: string): number {
  switch (status) {
    case "SAFE":
      return 0;
    case "PARTIALLY_SAFE":
      return 1;
    case "VULNERABLE":
      return 2;
    default:
      return 3;
  }
}

// Plain data passed into the per-node function below — NodeRuntime (unlike the
// outer DON-mode Runtime) has no getSecret(), so the key must be resolved once
// at the DON level and threaded through as an argument, not fetched per-node.
type NodeCallArgs = { apiUrl: string; algorithms: string[]; apiKey: string };

// Runs once per DON node — fetch + parse. Consensus aggregation below takes
// the median of the numeric worst-case-severity code across all nodes, so a
// single compromised/misbehaving node can't skew the on-chain result.
const fetchWorstCaseSeverity = (
  sendRequester: HTTPSendRequester,
  args: NodeCallArgs,
) => {
  const response = sendRequester
    .sendRequest({
      url: args.apiUrl,
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": args.apiKey },
      body: JSON.stringify({ algorithms: args.algorithms }),
    })
    .result();

  if (!ok(response)) {
    throw new Error(`QuantumScan API request failed with status: ${response.statusCode}`);
  }

  const data = json(response) as { results: { status: string }[] };
  const worst = Math.max(...data.results.map((r) => statusToCode(r.status)));
  return worst;
};

const onCronTrigger = (runtime: Runtime<Config>) => {
  const httpCapability = new cre.capabilities.HTTPClient();
  const apiKey = runtime.getSecret({ id: "QUANTUMSCAN_API_KEY" }).result();

  const nodeArgs: NodeCallArgs = {
    apiUrl: runtime.config.apiUrl,
    algorithms: runtime.config.algorithms,
    apiKey: apiKey.value,
  };

  const worstCaseSeverity = httpCapability
    .sendRequest(runtime, fetchWorstCaseSeverity, consensusMedianAggregation())(nodeArgs)
    .result();

  runtime.log(`QuantumScan worst-case PQC severity code: ${worstCaseSeverity}`);

  // Optional: write the aggregated severity code on-chain. Requires a deployed
  // PQCRiskConsumer (see PQCRiskConsumer.sol) and its address in config.json.
  for (const evm of runtime.config.evms) {
    const network = getNetwork({
      chainFamily: "evm",
      chainSelectorName: evm.chainSelectorName,
      isTestnet: true,
    });
    if (!network) {
      runtime.log(`Skipping unknown network: ${evm.chainSelectorName}`);
      continue;
    }

    const writeData = encodeFunctionData({
      abi: PQC_RISK_CONSUMER_ABI,
      functionName: "updatePQCRiskScore",
      args: [worstCaseSeverity],
    });

    const report = runtime.report(prepareReportRequest(writeData)).result();
    runtime.log(`Prepared CRE report for ${evm.contractAddress}: ${report ? "ok" : "empty"}`);
    // Broadcasting the report to the forwarder happens via `cre workflow
    // simulate --broadcast` (locally) or automatically once deployed to a DON.
  }

  return worstCaseSeverity;
};

const PQC_RISK_CONSUMER_ABI = [
  {
    type: "function",
    name: "updatePQCRiskScore",
    stateMutability: "nonpayable",
    inputs: [{ name: "severityCode", type: "uint8" }],
    outputs: [],
  },
] as const;

export const initWorkflow = (config: Config) => {
  const cron = new cre.capabilities.CronCapability();
  const trigger = cron.trigger({ schedule: config.schedule });
  return [cre.handler(trigger, onCronTrigger)];
};
