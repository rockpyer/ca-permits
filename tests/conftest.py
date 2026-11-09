import pytest
import requests


@pytest.fixture(autouse=True)
def no_network(monkeypatch):
    """Tests never reach the state agencies' sites: any real HTTP request fails the test."""

    def blocked(*args, **kwargs):
        raise RuntimeError("tests must not make network requests; mock the fetch")

    monkeypatch.setattr(requests.Session, "request", blocked)
