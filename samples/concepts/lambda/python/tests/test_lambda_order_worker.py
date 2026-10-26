import json

import boto3


def sqs_event(*bodies):
    return {"Records": [{"messageId": f"msg-{i}", "body": body} for i, body in enumerate(bodies)]}


def order(order_id, total=10):
    return json.dumps({"orderId": order_id, "total": total})


def stored(order_id):
    return boto3.resource("dynamodb").Table("orders").get_item(Key={"pk": f"ORDER#{order_id}"}).get("Item")


def test_records_every_order_in_the_batch(worker):
    result = worker.handler(sqs_event(order("a"), order("b", 12.5)), None)

    assert result == {"batchItemFailures": []}
    assert stored("a")["status"] == "RECEIVED"
    assert str(stored("b")["total"]) == "12.5"


def test_reports_only_the_bad_message_as_failed(worker):
    result = worker.handler(sqs_event(order("a"), "not json", '{"orderId": "c"}', order("d")), None)

    assert result == {"batchItemFailures": [{"itemIdentifier": "msg-1"}, {"itemIdentifier": "msg-2"}]}
    assert stored("a") and stored("d")


def test_duplicate_delivery_is_a_no_op(worker):
    worker.handler(sqs_event(order("a", 10)), None)
    boto3.resource("dynamodb").Table("orders").update_item(
        Key={"pk": "ORDER#a"},
        UpdateExpression="SET #s = :s",
        ExpressionAttributeNames={"#s": "status"},
        ExpressionAttributeValues={":s": "SHIPPED"},
    )

    result = worker.handler(sqs_event(order("a", 10)), None)

    assert result == {"batchItemFailures": []}
    assert stored("a")["status"] == "SHIPPED"


def test_dynamodb_errors_are_reported_per_message(worker):
    boto3.client("dynamodb").delete_table(TableName="orders")

    result = worker.handler(sqs_event(order("a"), order("b")), None)

    assert result == {"batchItemFailures": [{"itemIdentifier": "msg-0"}, {"itemIdentifier": "msg-1"}]}
