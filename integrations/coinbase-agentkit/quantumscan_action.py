"""
QuantumScan action for Coinbase AgentKit.

Usage with CDP AgentKit:
    from cdp_langchain.agent_toolkits import CdpToolkit
    from cdp_langchain.utils import CdpAgentkitWrapper
    from quantumscan_action import QuantumScanAction, QuantumScanCheckAlgorithmAction

    cdp = CdpAgentkitWrapper()
    toolkit = CdpToolkit.from_cdp_agentkit_wrapper(cdp)

    # Add QuantumScan tools to the toolkit
    extra_tools = [QuantumScanAction(), QuantumScanCheckAlgorithmAction()]
    tools = toolkit.get_tools() + extra_tools

Install:
    pip install cdp-sdk cdp-langchain langchain-core requests
"""

import json
import time
from typing import Optional, Type
import requests
from langchain_core.tools import BaseTool
from pydantic import BaseModel, Field

QUANTUMSCAN_BASE = "https://quantumscan.io"


class ScanRepositoryInput(BaseModel):
    repo_url: str = Field(
        description="Full URL of the GitHub/GitLab/Bitbucket repository to scan. "
                    "Example: https://github.com/owner/repo"
    )
    email: Optional[str] = Field(
        default=None,
        description="Optional email to receive the PDF security report."
    )


class CheckAlgorithmInput(BaseModel):
    algorithm: str = Field(
        description="Cryptographic algorithm name to evaluate for quantum safety. "
                    "Examples: ECDSA, RSA-2048, AES-256, ML-KEM-768, secp256k1"
    )


class ScanContractInput(BaseModel):
    address: str = Field(
        description="Ethereum or Solana smart contract address to scan for PQC risk. "
                    "Example: 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
    )
    chain: str = Field(
        default="ethereum",
        description="Blockchain network: ethereum, solana, arbitrum, polygon"
    )


class QuantumScanAction(BaseTool):
    """Scan a blockchain repository or smart contract for post-quantum cryptography (PQC) vulnerabilities.

    QuantumScan identifies cryptographic algorithms that are vulnerable to quantum computers
    (ECDSA, RSA, AES-128, secp256k1 used in most blockchains) and recommends NIST-approved
    post-quantum alternatives (ML-KEM, ML-DSA, SLH-DSA).

    Use this when:
    - A user asks if their smart contract uses quantum-vulnerable crypto
    - A user wants to check PQC compliance of a DeFi protocol's codebase
    - You need to audit a blockchain project's cryptographic security posture
    """

    name: str = "scan_repository_for_pqc_vulnerabilities"
    description: str = (
        "Scan a GitHub/GitLab/Bitbucket repository for post-quantum cryptography (PQC) "
        "vulnerabilities. Returns a risk score (0-100), list of vulnerable cryptographic "
        "algorithms found, affected files, and migration recommendations to NIST FIPS 203/204/205 "
        "standards. Higher score = more vulnerable."
    )
    args_schema: Type[BaseModel] = ScanRepositoryInput

    def _run(self, repo_url: str, email: Optional[str] = None) -> str:
        try:
            resp = requests.post(
                f"{QUANTUMSCAN_BASE}/api/scan",
                json={"repoUrl": repo_url, "email": email or "agentkit@quantumscan.io"},
                timeout=15,
            )
            resp.raise_for_status()
            scan_id = resp.json()["scanId"]
        except Exception as e:
            return json.dumps({"error": f"Failed to start scan: {e}"})

        # Poll up to 2 minutes
        for _ in range(24):
            time.sleep(5)
            try:
                poll = requests.get(f"{QUANTUMSCAN_BASE}/api/scan/{scan_id}", timeout=10)
                data = poll.json()
                if data.get("status") in ("completed", "failed"):
                    return json.dumps({
                        "scanId": scan_id,
                        "status": data.get("status"),
                        "riskScore": data.get("riskScore"),
                        "totalFiles": data.get("totalFiles"),
                        "vulnerableFiles": data.get("vulnerableFiles"),
                        "language": data.get("language"),
                        "summary": data.get("findings", {}).get("analysis", {}).get("executiveSummary", ""),
                        "topRisks": data.get("findings", {}).get("analysis", {}).get("topRisks", []),
                        "recommendations": data.get("findings", {}).get("analysis", {}).get("recommendations", []),
                        "reportUrl": data.get("reportUrl"),
                        "viewUrl": f"{QUANTUMSCAN_BASE}/scan/{scan_id}",
                    })
            except Exception:
                continue

        return json.dumps({"scanId": scan_id, "status": "timeout", "message": "Scan still in progress. Call get_pqc_scan_result with scanId to check later."})


class QuantumScanCheckAlgorithmAction(BaseTool):
    """Check if a specific cryptographic algorithm is quantum-safe.

    Essential for blockchain agents evaluating which signing schemes survive a quantum attack.
    secp256k1 (used by Bitcoin/Ethereum) is VULNERABLE. ML-DSA-65 is quantum-safe.
    """

    name: str = "check_if_algorithm_is_quantum_safe"
    description: str = (
        "Check if a cryptographic algorithm (e.g. ECDSA, RSA-2048, secp256k1, AES-256, ML-KEM-768) "
        "is quantum-safe according to NIST post-quantum cryptography standards. "
        "Returns risk level (safe/at_risk/vulnerable), the NIST standard it maps to if safe, "
        "and the recommended post-quantum alternative."
    )
    args_schema: Type[BaseModel] = CheckAlgorithmInput

    def _run(self, algorithm: str) -> str:
        try:
            resp = requests.post(
                f"{QUANTUMSCAN_BASE}/api/mcp",
                json={
                    "jsonrpc": "2.0",
                    "id": 1,
                    "method": "tools/call",
                    "params": {
                        "name": "check_pqc_risk",
                        "arguments": {"algorithms": [algorithm]},
                    },
                },
                timeout=15,
            )
            resp.raise_for_status()
            data = resp.json()
            content = data.get("result", {}).get("content", [{}])[0].get("text", "{}")
            return content
        except Exception as e:
            return json.dumps({"error": str(e)})


class QuantumScanContractAction(BaseTool):
    """Scan a smart contract address for PQC risk.

    Use when a user wants to know if a specific deployed contract on Ethereum, Solana,
    Arbitrum, or Polygon uses quantum-vulnerable cryptography.
    """

    name: str = "scan_smart_contract_for_pqc_risk"
    description: str = (
        "Scan an Ethereum/Solana/Arbitrum/Polygon smart contract address for "
        "post-quantum cryptography (PQC) risk. Returns whether ECDSA recovery "
        "(ecrecover), secp256k1 operations, or other quantum-vulnerable patterns "
        "are present in the contract bytecode or source."
    )
    args_schema: Type[BaseModel] = ScanContractInput

    def _run(self, address: str, chain: str = "ethereum") -> str:
        try:
            resp = requests.post(
                f"{QUANTUMSCAN_BASE}/api/mcp",
                json={
                    "jsonrpc": "2.0",
                    "id": 1,
                    "method": "tools/call",
                    "params": {
                        "name": "scan_contract",
                        "arguments": {"address": address, "chain": chain},
                    },
                },
                timeout=15,
            )
            resp.raise_for_status()
            data = resp.json()
            content = data.get("result", {}).get("content", [{}])[0].get("text", "{}")
            return content
        except Exception as e:
            return json.dumps({"error": str(e)})


# List of all QuantumScan tools for easy import
QUANTUMSCAN_TOOLS = [
    QuantumScanAction(),
    QuantumScanCheckAlgorithmAction(),
    QuantumScanContractAction(),
]
