import os
import sys
import tempfile
from pathlib import Path

import pytest

# Tests use a throwaway SQLite file and a fake Redis, so they run anywhere (laptop or CI).
_db = Path(tempfile.mkdtemp()) / "test.db"
os.environ["DATABASE_URL"] = f"sqlite:///{_db}"
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "seed"))


class FakeRedis:
    def __init__(self):
        self.lists = {}
        self.up = True

    def ping(self):
        if not self.up:
            raise ConnectionError("redis down")
        return True

    def lpush(self, key, value):
        if not self.up:
            raise ConnectionError("redis down")
        self.lists.setdefault(key, []).insert(0, value)

    def llen(self, key):
        return len(self.lists.get(key, []))

    def get(self, key):
        return None


@pytest.fixture(scope="session")
def fake_redis():
    return FakeRedis()


@pytest.fixture(scope="session")
def client(fake_redis):
    from fastapi.testclient import TestClient

    import seed as seed_module
    from app import main

    main.get_redis = lambda: fake_redis
    seed_module.main(force=True)
    with TestClient(main.app) as c:
        yield c
