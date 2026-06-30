"""
Register QuantumScan as an A2A agent on Agentverse (Fetch.ai).

1. Get your AGENTVERSE_KEY from the Agentverse wizard (Copy button)
2. Run:
   pip install uagents-core
   set AGENTVERSE_KEY=<paste key here>
   set AGENT_SEED_PHRASE=quantumscan-pqc-security-agent-2026
   python agentverse/register_a2a.py
"""
import os
from uagents_core.utils.registration import (
    register_chat_agent,
    RegistrationRequestCredentials,
)

register_chat_agent(
    "QuantumScan PQC",
    "https://quantumscan.io/api/a2a",
    active=True,
    credentials=RegistrationRequestCredentials(
        agentverse_api_key=os.environ["AGENTVERSE_KEY"],
        agent_seed_phrase=os.environ.get(
            "AGENT_SEED_PHRASE", "quantumscan-pqc-security-agent-2026"
        ),
    ),
)

print("QuantumScan PQC registered on Agentverse!")
print("Discoverable at: https://agentverse.ai (search: @quantumscan-pqc)")
print("ASI:One search: quantumscan OR blockchain security")
