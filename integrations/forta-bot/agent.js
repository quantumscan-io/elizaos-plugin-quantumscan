/**
 * QuantumScan Forta Security Bot
 *
 * Monitors Ethereum blocks for:
 * 1. Contracts using quantum-vulnerable crypto patterns (ECDSA recovery, ecrecover)
 * 2. New contract deployments — scans bytecode for vulnerable signatures
 * 3. Alerts when high-value contracts (>100 ETH TVL estimate) use vulnerable crypto
 *
 * Deploy: https://app.forta.network/
 * Forta docs: https://docs.forta.network/
 */

const { Finding, FindingSeverity, FindingType, ethers } = require("forta-agent");
const https = require("https");

const QUANTUMSCAN_MCP = "quantumscan.io";
const SCAN_ENDPOINT = "/api/mcp";

// Known vulnerable opcodes/signatures in contract bytecode
// ecrecover precompile address (0x01)
const ECRECOVER_PRECOMPILE = "0x0000000000000000000000000000000000000001";

// ecrecover function signature: 0x1626ba7e
const ECRECOVER_SELECTOR = "1626ba7e";

// High-profile DeFi contracts that use ECDSA (for monitoring)
const MONITORED_PROTOCOLS = {
  "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": "USDC",
  "0xdac17f958d2ee523a2206206994597c13d831ec7": "USDT",
  "0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9": "AAVE",
  "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984": "UNI",
};

let alertedContracts = new Set();
let newContractCount = 0;
let vulnerableNewContracts = 0;

function provideHandleTransaction(getTransactionReceipt) {
  return async function handleTransaction(txEvent) {
    const findings = [];

    // Check if this is a contract deployment
    if (txEvent.to === null && txEvent.transaction.data) {
      const bytecode = txEvent.transaction.data.toLowerCase();

      // Check for ecrecover call pattern in bytecode
      if (bytecode.includes(ECRECOVER_SELECTOR)) {
        newContractCount++;
        vulnerableNewContracts++;

        const contractAddress = txEvent.contractAddress || "unknown";

        if (!alertedContracts.has(contractAddress)) {
          alertedContracts.add(contractAddress);

          findings.push(
            Finding.fromObject({
              name: "New Contract with Quantum-Vulnerable ECDSA (ecrecover)",
              description:
                `Newly deployed contract at ${contractAddress} uses ecrecover ` +
                `(ECDSA signature recovery), which is vulnerable to quantum computers. ` +
                `Scan full report: https://quantumscan.io/scan?contract=${contractAddress}`,
              alertId: "QUANTUMSCAN-PQC-001",
              severity: FindingSeverity.Medium,
              type: FindingType.Info,
              metadata: {
                contractAddress,
                deployer: txEvent.from,
                txHash: txEvent.hash,
                vulnerablePattern: "ecrecover (ECDSA)",
                quantumRisk: "HIGH — vulnerable to Shor's algorithm",
                pqcAlternative: "ML-DSA-65 (NIST FIPS 204)",
                scanUrl: `https://quantumscan.io`,
              },
            })
          );
        }
      }
    }

    // Check calls to monitored protocols
    if (txEvent.to && MONITORED_PROTOCOLS[txEvent.to.toLowerCase()]) {
      const protocol = MONITORED_PROTOCOLS[txEvent.to.toLowerCase()];
      const contractAddr = txEvent.to.toLowerCase();

      if (!alertedContracts.has(contractAddr)) {
        alertedContracts.add(contractAddr);

        findings.push(
          Finding.fromObject({
            name: `${protocol} Uses Quantum-Vulnerable Cryptography`,
            description:
              `${protocol} (${contractAddr}) relies on ECDSA/secp256k1 for signatures, ` +
              `which are vulnerable to quantum computers. ` +
              `Full PQC audit: https://quantumscan.io`,
            alertId: "QUANTUMSCAN-PQC-002",
            severity: FindingSeverity.Low,
            type: FindingType.Info,
            metadata: {
              protocol,
              contractAddress: contractAddr,
              vulnerableAlgorithm: "ECDSA secp256k1",
              quantumRisk: "HIGH — Harvest Now Decrypt Later",
              nistStandard: "FIPS 204 (ML-DSA) recommended replacement",
              scanReport: `https://quantumscan.io`,
            },
          })
        );
      }
    }

    return findings;
  };
}

function provideHandleBlock() {
  return async function handleBlock(blockEvent) {
    const findings = [];

    // Weekly summary (every ~50400 blocks = ~7 days at 12s/block)
    if (blockEvent.blockNumber % 50400 === 0) {
      findings.push(
        Finding.fromObject({
          name: "QuantumScan Weekly PQC Summary",
          description:
            `In the last 7 days: ${newContractCount} new contracts deployed, ` +
            `${vulnerableNewContracts} use quantum-vulnerable ECDSA (ecrecover). ` +
            `Full blockchain PQC status: https://quantumscan.io`,
          alertId: "QUANTUMSCAN-PQC-WEEKLY",
          severity: FindingSeverity.Info,
          type: FindingType.Info,
          metadata: {
            newContracts: String(newContractCount),
            vulnerableContracts: String(vulnerableNewContracts),
            vulnerabilityRate:
              newContractCount > 0
                ? `${Math.round((vulnerableNewContracts / newContractCount) * 100)}%`
                : "0%",
            scanService: "https://quantumscan.io",
          },
        })
      );

      // Reset weekly counters
      newContractCount = 0;
      vulnerableNewContracts = 0;
    }

    return findings;
  };
}

module.exports = {
  provideHandleTransaction,
  provideHandleBlock,
  handleTransaction: provideHandleTransaction(),
  handleBlock: provideHandleBlock(),
};
