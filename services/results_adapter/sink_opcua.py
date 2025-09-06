import os

async def _write_async(endpoint: str, node_id: str, value) -> bool:
    try:
        from asyncua import Client, ua
    except Exception:
        return False
    try:
        async with Client(url=endpoint) as client:
            node = client.get_node(node_id)
            await node.write_value(ua.DataValue(ua.Variant(value, ua.VariantType.String)))
            return True
    except Exception:
        return False

def write_defect_tag(line_id: str, payload) -> bool:
    # Bridge sync context to async write
    endpoint = os.getenv("OPCUA_ENDPOINT", "opc.tcp://localhost:4840")
    node_id = os.getenv("OPCUA_DEFECT_NODE", f"ns=2;s=Factory.Lines.{line_id}.QA.Alert")
    import asyncio
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(_write_async(endpoint, node_id, str(payload)))
    except Exception:
        return False


