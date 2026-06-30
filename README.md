# elizaos-plugin-quantumscan

ElizaOS plugin for post-quantum cryptography (PQC) vulnerability scanning. Scans GitHub, GitLab, and Bitbucket repositories for quantum-vulnerable cryptographic algorithms and returns actionable migration guidance aligned to NIST FIPS 203/204/205.

## Installation

```bash
elizaos plugins add elizaos-plugin-quantumscan
```

Or manually:

```bash
npm install elizaos-plugin-quantumscan
```

## Usage

Register the plugin in your agent character file:

```typescript
import { quantumscanPlugin } from "elizaos-plugin-quantumscan";

export const character = {
  name: "MyAgent",
  plugins: [quantumscanPlugin],
  // ...
};
```

Once loaded, the agent understands natural language commands like:

- "Scan https://github.com/owner/repo for quantum vulnerabilities"
- "Is github.com/aave/aave-v3-core quantum-safe?"
- "Get result for scan abc-123"
- "Is ECDSA quantum safe?"
- "Check if RSA-2048 is post-quantum resistant"

## Actions

### SCAN_REPOSITORY

Submits a repository for PQC vulnerability scanning. Returns a scan ID.

**Triggers:** Messages containing GitHub, GitLab, or Bitbucket URLs with scan intent.

**Returns:** Scan ID + status URL. Use GET_SCAN_RESULT to retrieve results (~60 seconds).

### GET_SCAN_RESULT

Retrieves results for a previously submitted scan.

**Triggers:** Messages containing a scan UUID, or phrases like "get scan result", "scan status".

**Returns:** Risk score (0–100), vulnerable algorithm list, CBOM summary, report URL.

### CHECK_PQC_RISK

Instant local check — no scan needed. Assesses whether a named cryptographic algorithm is quantum-vulnerable.

**Triggers:** Messages mentioning algorithm names (ECDSA, RSA, AES, SHA, ML-DSA, etc.) with risk intent.

**Returns:** Vulnerability status + recommended post-quantum migration target.

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `QUANTUMSCAN_API_KEY` | No | API key for authenticated scans (free anonymous scans also available) |
| `QUANTUMSCAN_API_URL` | No | Custom API base URL (default: `https://quantumscan.io`) |

## Vulnerable Algorithms Detected

| Algorithm | Quantum Risk | Migration Target |
|---|---|---|
| ECDSA / ECDH | HIGH (Shor's) | ML-DSA-65 (NIST FIPS 204) |
| RSA (any size) | HIGH (Shor's) | ML-KEM-768 (NIST FIPS 203) |
| Ed25519 / X25519 | HIGH (Shor's) | ML-DSA-44 or ML-KEM-768 |
| DH / DHE | HIGH (Shor's) | ML-KEM-768 |
| AES-128 | MEDIUM (Grover's) | AES-256 |
| SHA-1 / MD5 | CRITICAL (classical) | SHA-256+ |
| BLS12-381 | HIGH (pairing) | SLH-DSA-SHA2-128s |

## Output Format

Results include an EIP-7789 CBOM (Cryptography Bill of Materials) in CycloneDX 1.6 format listing all detected cryptographic components and their post-quantum migration status.

## Links

- [quantumscan.io](https://quantumscan.io) — web scanner
- [GitHub](https://github.com/quantumscan-io/elizaos-plugin-quantumscan) — source code
- [npm](https://www.npmjs.com/package/elizaos-plugin-quantumscan) — package

## License

MIT
