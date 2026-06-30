import type { Plugin } from "@elizaos/core";
import { scanRepositoryAction, getScanResultAction, checkPqcRiskAction, scanContractAction } from "./actions";

export const quantumscanPlugin: Plugin = {
  name: "quantumscan",
  description:
    "Post-quantum cryptography (PQC) vulnerability scanner for GitHub, GitLab, Bitbucket repositories " +
    "and on-chain smart contracts. Detects quantum-vulnerable algorithms (ECDSA, RSA, DH, AES-128, etc.) " +
    "and fraud patterns, returns EIP-7789 CBOM manifests aligned to NIST FIPS 203/204/205 migration targets.",
  actions: [scanRepositoryAction, getScanResultAction, checkPqcRiskAction, scanContractAction],
};

export default quantumscanPlugin;
export * from "./actions";
