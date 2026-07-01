# QuantumScan × Chainlink Runtime Environment (CRE)

Brings QuantumScan's post-quantum-cryptography risk data on-chain via a CRE workflow.

**Why CRE and not Chainlink Functions:** Functions was sunset 2026-06-30 (testnet: 2026-06-15).
CRE is its replacement — same idea (DON runs your code, fetches external data, writes
on-chain with consensus), new SDK (`@chainlink/cre-sdk`, TypeScript or Go).

## What it does

Every ~30 minutes (configurable), the DON:
1. Independently calls `POST https://quantumscan.io/api/agent/check-pqc-risk` with a
   configured list of algorithms (default: `ECDSA`, `secp256k1`, `RSA-2048`).
2. Aggregates the worst-case severity across all nodes via consensus median — no single
   node can lie about the result.
3. Optionally writes the aggregated severity code (0=safe, 1=partially safe, 2=vulnerable,
   3=unknown) on-chain to any contract implementing the `IReceiver` pattern (see
   `PQCRiskConsumer.sol`).

## Files

- `workflow.ts` — the CRE workflow (cron trigger → HTTP fetch → consensus → onchain write)
- `config.json` — schedule, API URL, algorithm list, target EVM network(s)
- `PQCRiskConsumer.sol` — minimal onchain consumer contract

## Setup

```bash
# 1. Install CRE CLI (see https://docs.chain.link/cre/getting-started/cli-installation)
curl -sSL https://app.chain.link/cre/install.sh | bash

# 2. From this folder, install the SDK
bun add @chainlink/cre-sdk

# 3. Register a free QuantumScan API key (or use a prepaid one)
curl -X POST https://quantumscan.io/api/agent/register

# 4. Store it as a CRE secret — CRE workflows can't sign x402 payments
#    themselves (no wallet/private-key capability in the WASM sandbox), so
#    a prepaid API key is the only way to authenticate on a cron schedule.
cre secrets set QUANTUMSCAN_API_KEY=qs_...

# 5. Simulate locally (reads real APIs, does not broadcast on-chain writes)
cre workflow simulate --target local-simulation --config config.json workflow.ts

# 6. Simulate with a real broadcast (needs a funded private key + RPC in project.yaml)
cre workflow simulate --target local-simulation --config config.json workflow.ts --broadcast
```

## Deploying the consumer contract

1. Deploy `PQCRiskConsumer.sol` with the Chainlink Forwarder address for your target
   network as the constructor argument (get it from the CRE workflow deployment output —
   see `docs.chain.link/cre/guides/workflow/using-evm-client/onchain-write`).
2. Put its address in `config.json` under `evms[].contractAddress`.
3. Any contract can then call `PQCRiskConsumer.isVulnerable()` before trusting a
   transaction that relies on ECDSA/secp256k1/RSA-2048 signatures.

**Not audited, not deployed by QuantumScan.** Verify the `IReceiver` interface and forwarder
address against the current CRE docs before using this on mainnet — CRE is new (launched to
replace Functions in mid-2026) and interfaces may still change.
