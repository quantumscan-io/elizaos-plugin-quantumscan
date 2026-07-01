// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/// @notice Minimal consumer contract for the QuantumScan PQC Risk Feed CRE workflow.
/// @dev Implements the standard CRE receiver pattern: the Chainlink Forwarder for your
/// network calls `onReport`, decodes the workflow's report, and forwards the ABI-encoded
/// call it contains. Verify the exact `IReceiver` interface and forwarder address for your
/// target network against https://docs.chain.link/cre/guides before mainnet use — this
/// reference implementation has not been audited or deployed by QuantumScan.
interface IReceiver {
    function onReport(bytes calldata metadata, bytes calldata report) external;
}

contract PQCRiskConsumer is IReceiver {
    /// @notice 0 = SAFE, 1 = PARTIALLY_SAFE, 2 = VULNERABLE, 3 = UNKNOWN
    uint8 public latestSeverityCode;
    uint256 public lastUpdatedAt;

    address public immutable forwarder;

    event PQCRiskUpdated(uint8 severityCode, uint256 timestamp);

    error UnauthorizedForwarder(address caller);

    constructor(address _forwarder) {
        forwarder = _forwarder;
    }

    modifier onlyForwarder() {
        if (msg.sender != forwarder) revert UnauthorizedForwarder(msg.sender);
        _;
    }

    /// @dev `report` is the ABI-encoded calldata this contract itself would receive —
    /// i.e. the output of `encodeFunctionData({ functionName: "updatePQCRiskScore", ... })`
    /// in workflow.ts. `metadata` (workflow ID, execution ID, etc.) is unused here.
    function onReport(bytes calldata metadata, bytes calldata report) external override onlyForwarder {
        metadata;
        (bool success, ) = address(this).delegatecall(report);
        require(success, "onReport: inner call failed");
    }

    function updatePQCRiskScore(uint8 severityCode) external {
        require(msg.sender == address(this), "only via onReport");
        latestSeverityCode = severityCode;
        lastUpdatedAt = block.timestamp;
        emit PQCRiskUpdated(severityCode, block.timestamp);
    }

    /// @return true if the last reported severity means an agent should not sign
    /// transactions relying on the monitored algorithm(s) without manual review.
    function isVulnerable() external view returns (bool) {
        return latestSeverityCode >= 2;
    }
}
