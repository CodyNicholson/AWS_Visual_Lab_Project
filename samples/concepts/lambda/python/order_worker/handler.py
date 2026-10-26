"""Order worker: an SQS-triggered Lambda function that records orders in DynamoDB.

Shows three patterns from the Lambda concept page:
- the SDK resource is created at module scope (Init phase) and reused by warm invocations
- partial batch responses, so one bad message doesn't send the whole batch back to the queue
- idempotent writes, because SQS and Lambda deliver each message at least once
"""

import json
import logging
import os
from decimal import Decimal

import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Runs once per execution environment, not once per invocation. Credentials come from the
# function's execution role; there are no access keys anywhere in this code.
TABLE = boto3.resource("dynamodb").Table(os.environ["TABLE_NAME"])


class InvalidOrder(ValueError):
    pass


def parse_order(body: str) -> dict:
    order = json.loads(body, parse_float=Decimal)
    if not isinstance(order, dict) or not order.get("orderId") or "total" not in order:
        raise InvalidOrder("order needs orderId and total")
    return order


def record_order(order: dict) -> bool:
    """Write the order once. Returns False if it was already recorded (a duplicate delivery)."""
    try:
        TABLE.put_item(
            Item={"pk": f"ORDER#{order['orderId']}", "total": order["total"], "status": "RECEIVED"},
            ConditionExpression="attribute_not_exists(pk)",
        )
        return True
    except TABLE.meta.client.exceptions.ConditionalCheckFailedException:
        return False


def handler(event, context):
    failures = []
    for record in event["Records"]:
        message_id = record["messageId"]
        try:
            if not record_order(parse_order(record["body"])):
                logger.info("duplicate delivery skipped: %s", message_id)
        except Exception:
            # Log the ID, not the body: message bodies can hold customer data.
            logger.exception("failed to process message %s", message_id)
            failures.append({"itemIdentifier": message_id})
    # Only the failed messages become visible on the queue again. Raising here instead
    # would make Lambda treat the whole batch as failed.
    return {"batchItemFailures": failures}
