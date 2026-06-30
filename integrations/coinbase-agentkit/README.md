# QuantumScan × Coinbase AgentKit

Post-quantum cryptography (PQC) scanner tools for [Coinbase AgentKit](https://github.com/coinbase/agentkit).

## Tools

| Tool | Description |
|---|---|
| `scan_repository_for_pqc_vulnerabilities` | Scan any GitHub/GitLab repo for quantum-vulnerable algorithms |
| `check_if_algorithm_is_quantum_safe` | Evaluate ECDSA, RSA, secp256k1, AES-256, ML-KEM-768, etc. |
| `scan_smart_contract_for_pqc_risk` | Scan Ethereum/Solana/Arbitrum contract addresses |

## Installation

```bash
pip install cdp-sdk cdp-langchain langchain-core requests
```

## Quick Start

```python
from quantumscan_action import QUANTUMSCAN_TOOLS
from cdp_langchain.agent_toolkits import CdpToolkit
from cdp_langchain.utils import CdpAgentkitWrapper

cdp = CdpAgentkitWrapper()
toolkit = CdpToolkit.from_cdp_agentkit_wrapper(cdp)
tools = toolkit.get_tools() + QUANTUMSCAN_TOOLS  # add QuantumScan
```

## Why PQC Matters for Blockchain

- **secp256k1** (Bitcoin/Ethereum signing) is vulnerable to Shor's algorithm
- **ECDSA** signatures can be forged by a quantum computer that knows the public key
- **"Harvest Now, Decrypt Later"**: encrypted data being collected today for future decryption
- NIST finalized quantum-safe standards in 2024: ML-KEM (FIPS 203), ML-DSA (FIPS 204), SLH-DSA (FIPS 205)

## Links

- API: https://quantumscan.io/api/mcp
- Website: https://quantumscan.io
- GitHub: https://github.com/gaiabio12-design/elizaos-plugin-quantumscan
