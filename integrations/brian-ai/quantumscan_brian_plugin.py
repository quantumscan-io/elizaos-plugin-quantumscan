"""
QuantumScan integration for Brian AI (brianknows.org).

Brian AI is a blockchain-native AI that understands on-chain transactions.
This plugin adds PQC security awareness to Brian-powered agents.

Brian API docs: https://docs.brianknows.org/brian-api/apis
"""

import json
import time
import requests

QUANTUMSCAN_BASE = "https://quantumscan.io"
BRIAN_BASE = "https://api.brianknows.org/api/v0"


class QuantumScanBrianPlugin:
    """Adds QuantumScan PQC scanning to Brian AI agents."""

    TOOLS = [
        {
            "name": "scan_contract_pqc",
            "description": (
                "Scan a smart contract address for post-quantum cryptography (PQC) vulnerabilities. "
                "Use this before any interaction with a DeFi protocol to check if it uses "
                "quantum-vulnerable cryptography like ECDSA or secp256k1."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "address": {
                        "type": "string",
                        "description": "Contract address (0x... for EVM, base58 for Solana)"
                    },
                    "chain": {
                        "type": "string",
                        "enum": ["ethereum", "solana", "arbitrum", "polygon"],
                        "description": "Blockchain network"
                    }
                },
                "required": ["address"]
            }
        },
        {
            "name": "check_algorithm_quantum_safe",
            "description": (
                "Check if a specific cryptographic algorithm is safe against quantum computers. "
                "Essential for evaluating if a protocol's signing scheme survives Q-Day."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "algorithm": {
                        "type": "string",
                        "description": "Algorithm name: ECDSA, RSA-2048, secp256k1, AES-256, ML-KEM-768, etc."
                    }
                },
                "required": ["algorithm"]
            }
        },
        {
            "name": "scan_protocol_repo",
            "description": (
                "Scan a DeFi protocol's GitHub repository for quantum-vulnerable cryptography. "
                "Returns risk score, vulnerable files, and NIST-compliant migration recommendations."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "repo_url": {
                        "type": "string",
                        "description": "GitHub repository URL of the DeFi protocol"
                    }
                },
                "required": ["repo_url"]
            }
        }
    ]

    def execute_tool(self, tool_name: str, params: dict) -> dict:
        if tool_name == "scan_contract_pqc":
            return self._scan_contract(params.get("address", ""), params.get("chain", "ethereum"))
        elif tool_name == "check_algorithm_quantum_safe":
            return self._check_algorithm(params.get("algorithm", ""))
        elif tool_name == "scan_protocol_repo":
            return self._scan_repo(params.get("repo_url", ""))
        else:
            return {"error": f"Unknown tool: {tool_name}"}

    def _check_algorithm(self, algorithm: str) -> dict:
        try:
            resp = requests.post(
                f"{QUANTUMSCAN_BASE}/api/mcp",
                json={
                    "jsonrpc": "2.0", "id": 1,
                    "method": "tools/call",
                    "params": {"name": "check_pqc_risk", "arguments": {"algorithms": [algorithm]}},
                },
                timeout=15,
            )
            resp.raise_for_status()
            content = resp.json().get("result", {}).get("content", [{}])[0].get("text", "{}")
            return json.loads(content)
        except Exception as e:
            return {"error": str(e)}

    def _scan_contract(self, address: str, chain: str = "ethereum") -> dict:
        try:
            resp = requests.post(
                f"{QUANTUMSCAN_BASE}/api/mcp",
                json={
                    "jsonrpc": "2.0", "id": 1,
                    "method": "tools/call",
                    "params": {"name": "scan_contract", "arguments": {"address": address, "chain": chain}},
                },
                timeout=15,
            )
            resp.raise_for_status()
            content = resp.json().get("result", {}).get("content", [{}])[0].get("text", "{}")
            return json.loads(content)
        except Exception as e:
            return {"error": str(e)}

    def _scan_repo(self, repo_url: str) -> dict:
        try:
            resp = requests.post(
                f"{QUANTUMSCAN_BASE}/api/scan",
                json={"repoUrl": repo_url, "email": "brian@quantumscan.io"},
                timeout=15,
            )
            resp.raise_for_status()
            scan_id = resp.json()["scanId"]
        except Exception as e:
            return {"error": f"Failed to start scan: {e}"}

        for _ in range(24):
            time.sleep(5)
            try:
                poll = requests.get(f"{QUANTUMSCAN_BASE}/api/scan/{scan_id}", timeout=10).json()
                if poll.get("status") in ("completed", "failed"):
                    return {
                        "scanId": scan_id,
                        "riskScore": poll.get("riskScore"),
                        "vulnerableFiles": poll.get("vulnerableFiles"),
                        "totalFiles": poll.get("totalFiles"),
                        "summary": poll.get("findings", {}).get("analysis", {}).get("executiveSummary", ""),
                        "viewUrl": f"{QUANTUMSCAN_BASE}/scan/{scan_id}",
                    }
            except Exception:
                continue

        return {"scanId": scan_id, "status": "timeout"}


def get_brian_agent_config() -> dict:
    """Return a Brian AI agent configuration with QuantumScan PQC tools."""
    plugin = QuantumScanBrianPlugin()
    return {
        "agent_description": (
            "Blockchain security agent with post-quantum cryptography (PQC) awareness. "
            "Can execute on-chain transactions via Brian AI and scan protocols for "
            "quantum vulnerabilities via QuantumScan."
        ),
        "tools": plugin.TOOLS,
        "quantumscan_endpoint": f"{QUANTUMSCAN_BASE}/api/mcp",
        "quantumscan_docs": "https://quantumscan.io",
    }


if __name__ == "__main__":
    plugin = QuantumScanBrianPlugin()

    print("Testing Brian AI + QuantumScan plugin...")

    result = plugin.execute_tool("check_algorithm_quantum_safe", {"algorithm": "secp256k1"})
    print(f"\nsecp256k1 check: {json.dumps(result, indent=2)}")

    result2 = plugin.execute_tool("scan_contract_pqc", {
        "address": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        "chain": "ethereum"
    })
    print(f"\nUSDC contract PQC scan: {json.dumps(result2, indent=2)}")
