import pytest
from fastapi.testclient import TestClient

from app import main
from app.llm import factory
from tests.fakes import FakeProvider


@pytest.fixture
def provider():
    return FakeProvider()


@pytest.fixture
def client(provider, monkeypatch):
    monkeypatch.setattr(factory, "build_provider", lambda cfg: provider)
    return TestClient(main.app, raise_server_exceptions=False)
