import type { Plugin } from "@elizaos/core";
import { scanRepositoryAction, getScanResultAction, checkPqcRiskAction } from "./actions";

export const quantumscanPlugin: Plugin = {
  name: "quantumscan",
  description:
    "Post-quantum cryptography (PQC) vulnerability scanner for GitHub, GitLab, and Bitbucket repositories. " +
    "Detects quantum-vulnerable algorithms (ECDSA, RSA, DH, AES-128, etc.), returns EIP-7789 CBOM manifests " +
    "aligned to NIST FIPS 203/204/205 migration targets.",
  actions: [scanRepositoryAction, getScanResultAction, checkPqcRiskAction],
};

export default quantumscanPlugin;
export * from "./actions";
