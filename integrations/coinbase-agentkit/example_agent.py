"""
Example: Coinbase AgentKit + QuantumScan PQC Security Agent

This creates a blockchain AI agent that can:
- Scan DeFi protocol repos for quantum vulnerabilities
- Check if algorithms like secp256k1 (Bitcoin/Ethereum) are quantum-safe
- Scan smart contract addresses for PQC risk
- Execute CDP wallet operations (transfer, trade, deploy NFT, etc.)

Setup:
    pip install cdp-sdk cdp-langchain langchain-openai langchain-core requests python-dotenv
    export CDP_API_KEY_NAME=your_cdp_key_name
    export CDP_API_KEY_PRIVATE_KEY=your_cdp_private_key
    export OPENAI_API_KEY=your_openai_key
"""

import os
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langgraph.prebuilt import create_react_agent
from cdp_langchain.agent_toolkits import CdpToolkit
from cdp_langchain.utils import CdpAgentkitWrapper
from quantumscan_action import QUANTUMSCAN_TOOLS

load_dotenv()

AGENT_SYSTEM_PROMPT = """You are a blockchain security agent with post-quantum cryptography (PQC) expertise.

You have access to:
- CDP wallet tools: transfer crypto, deploy NFTs, interact with DeFi protocols
- QuantumScan tools: scan repositories and smart contracts for PQC vulnerabilities

Your mission: help users understand which blockchain projects and smart contracts are
vulnerable to quantum computers, and guide them toward quantum-safe alternatives.

Key facts you know:
- secp256k1 (Bitcoin/Ethereum signing) is VULNERABLE to quantum computers
- ECDSA and RSA are quantum-vulnerable — "Harvest Now, Decrypt Later" attacks are real
- NIST FIPS 203 (ML-KEM), 204 (ML-DSA), 205 (SLH-DSA) are the quantum-safe standards
- Most DeFi protocols today use quantum-vulnerable cryptography
- Q-Day (when quantum computers break current crypto) is estimated 5-15 years away

When a user asks about a DeFi protocol's security, ALWAYS scan it with QuantumScan.
"""


def create_pqc_security_agent():
    """Create the PQC security agent with CDP + QuantumScan tools."""

    cdp = CdpAgentkitWrapper()
    cdp_toolkit = CdpToolkit.from_cdp_agentkit_wrapper(cdp)
    cdp_tools = cdp_toolkit.get_tools()

    all_tools = cdp_tools + QUANTUMSCAN_TOOLS

    llm = ChatOpenAI(model="gpt-4o", temperature=0)

    agent = create_react_agent(
        llm,
        tools=all_tools,
        state_modifier=AGENT_SYSTEM_PROMPT,
    )

    return agent


def run_interactive():
    agent = create_pqc_security_agent()

    print("QuantumScan + Coinbase AgentKit — PQC Security Agent")
    print("Type 'exit' to quit.\n")

    while True:
        user_input = input("You: ").strip()
        if user_input.lower() in ("exit", "quit"):
            break

        result = agent.invoke({"messages": [("user", user_input)]})
        final_message = result["messages"][-1].content
        print(f"\nAgent: {final_message}\n")


if __name__ == "__main__":
    run_interactive()
