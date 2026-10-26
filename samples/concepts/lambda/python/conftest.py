import importlib

import boto3
import pytest
from moto import mock_aws


@pytest.fixture
def worker(monkeypatch):
    """The handler module, imported inside a moto mock with an empty orders table."""
    monkeypatch.setenv("AWS_DEFAULT_REGION", "us-east-1")
    # moto's placeholder credentials, so boto3 never looks for real ones.
    monkeypatch.setenv("AWS_ACCESS_KEY_ID", "testing")
    monkeypatch.setenv("AWS_SECRET_ACCESS_KEY", "testing")
    monkeypatch.setenv("TABLE_NAME", "orders")
    with mock_aws():
        boto3.client("dynamodb").create_table(
            TableName="orders",
            KeySchema=[{"AttributeName": "pk", "KeyType": "HASH"}],
            AttributeDefinitions=[{"AttributeName": "pk", "AttributeType": "S"}],
            BillingMode="PAY_PER_REQUEST",
        )
        import order_worker.handler as module

        yield importlib.reload(module)
