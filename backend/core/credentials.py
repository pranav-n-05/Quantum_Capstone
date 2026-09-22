"""Supplying IBM credentials at runtime, from the browser.

The documented path is `.env` plus a restart. That is right for a server you
own, and wrong for someone who has just opened the dashboard and wants to see
their own fleet: it means editing a file and restarting a process before the
product does the thing it advertises.

So credentials can also be handed in through the UI. Three rules make that
defensible rather than reckless:

  1. **Memory only.** Nothing is written to disk -- not to `.env`, not to
     SQLite. A restart returns to whatever the environment says. Persisting a
     user's API key on our behalf is not a decision this dashboard should make
     for them.
  2. **Never echoed back.** Reads return a masked fingerprint, enough to
     confirm *which* key is loaded and useless to anyone who intercepts it.
  3. **Verified before accepted.** We exchange the key for an IAM token and
     make one real `/backends` call before storing anything, so a typo is
     reported immediately instead of quietly degrading the dashboard to mock
     mode a poll later.

Threat model, stated plainly: anyone who can reach this dashboard can set or
replace the credentials it uses, and on plain HTTP the key crosses the wire in
clear text. That is acceptable for the single-operator, localhost or
trusted-network tool this is. It is not acceptable on a public URL without
authentication in front of it, and the UI says so.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from ..config import Settings
from ..models import CredentialSource, CredentialStatus
from .ibm_client import IBMAuthError, IBMQuantumClient, IBMQuantumError

logger = logging.getLogger(__name__)


def fingerprint(secret: str) -> str:
    """A short, non-reversible hint at which secret is loaded.

    Shows the last four characters only. Enough to answer "is this the key I
    just pasted?", not enough to reconstruct it.
    """
    cleaned = (secret or "").strip()
    if not cleaned:
        return ""
    if len(cleaned) <= 4:
        return "•" * len(cleaned)
    return f"{'•' * 4}{cleaned[-4:]}"


class CredentialStore:
    """Holds runtime credentials and reports where the live ones came from."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        # Whatever the process started with. Kept so "clear" can restore it
        # rather than leaving the dashboard with no credentials at all.
        self._env_api_key = settings.ibm_quantum_api_key
        self._env_crn = settings.ibm_quantum_crn
        self._runtime_active = False
        self._validated_at: datetime | None = None
        self._last_error: str | None = None

    @property
    def source(self) -> CredentialSource:
        if self._runtime_active:
            return CredentialSource.RUNTIME
        if self._env_api_key.strip() and self._env_crn.strip():
            return CredentialSource.ENVIRONMENT
        return CredentialSource.NONE

    def status(self) -> CredentialStatus:
        return CredentialStatus(
            configured=self._settings.has_credentials,
            source=self.source,
            api_key_hint=fingerprint(self._settings.ibm_quantum_api_key),
            crn_hint=fingerprint(self._settings.ibm_quantum_crn),
            api_url=self._settings.ibm_quantum_api_url,
            validated_at=self._validated_at,
            last_error=self._last_error,
            force_mock_mode=self._settings.force_mock_mode,
        )

    async def verify(self, api_key: str, crn: str, api_url: str | None = None) -> None:
        """Prove the credentials work before we adopt them.

        Raises IBMAuthError or IBMQuantumError, which the endpoint turns into a
        4xx carrying IBM's own words. Checking here rather than letting the
        poller discover it means the user learns about a bad key while they are
        still looking at the form.
        """
        probe = Settings(
            ibm_quantum_api_key=api_key,
            ibm_quantum_crn=crn,
            ibm_quantum_api_url=api_url or self._settings.ibm_quantum_api_url,
            ibm_iam_url=self._settings.ibm_iam_url,
            ibm_api_version=self._settings.ibm_api_version,
            enable_history=False,
        )

        async with IBMQuantumClient(probe) as client:
            # fetch_backends exercises the whole chain: IAM token exchange, all
            # four required headers, the CRN, and the response contract.
            backends = await client.fetch_backends()

        if not backends:
            raise IBMQuantumError(
                "IBM accepted the credentials but returned no devices. "
                "Check that the CRN points at an instance with QPU access."
            )

    def adopt(self, api_key: str, crn: str, api_url: str | None = None) -> None:
        """Apply verified credentials to the running settings object."""
        self._settings.ibm_quantum_api_key = api_key.strip()
        self._settings.ibm_quantum_crn = crn.strip()
        if api_url:
            self._settings.ibm_quantum_api_url = api_url.strip()
        # Supplying credentials is an unambiguous request for live data, so it
        # also lifts a FORCE_MOCK_MODE that would silently ignore them.
        self._settings.force_mock_mode = False
        self._runtime_active = True
        self._validated_at = datetime.now(timezone.utc)
        self._last_error = None
        logger.info("Adopted runtime IBM credentials (%s).", fingerprint(api_key))

    def clear(self) -> None:
        """Forget runtime credentials and fall back to the environment's."""
        self._settings.ibm_quantum_api_key = self._env_api_key
        self._settings.ibm_quantum_crn = self._env_crn
        self._runtime_active = False
        self._validated_at = None
        self._last_error = None
        logger.info("Cleared runtime IBM credentials; reverted to the environment.")

    def record_error(self, message: str) -> None:
        self._last_error = message


__all__ = ["CredentialStore", "IBMAuthError", "IBMQuantumError", "fingerprint"]
