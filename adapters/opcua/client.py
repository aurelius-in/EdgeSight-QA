import os
from opcua import Client, ua

OPCUA_ENDPOINT = os.getenv('OPCUA_ENDPOINT', 'opc.tcp://localhost:4840')
NODE_FPY = os.getenv('OPCUA_NODE_FPY', 'ns=2;s=Metrics.FPY')
NODE_SCRAP = os.getenv('OPCUA_NODE_SCRAP', 'ns=2;s=Metrics.ScrapEstimate')
NODE_ALARM = os.getenv('OPCUA_NODE_ALARM', 'ns=2;s=Metrics.AlarmFlag')


def write_metrics(first_pass_yield: float, scrap_estimate: float, alarm: bool) -> None:
    client = Client(OPCUA_ENDPOINT)
    try:
        client.connect()
        fpy_node = client.get_node(NODE_FPY)
        scrap_node = client.get_node(NODE_SCRAP)
        alarm_node = client.get_node(NODE_ALARM)
        fpy_node.set_value(ua.Variant(first_pass_yield, ua.VariantType.Double))
        scrap_node.set_value(ua.Variant(scrap_estimate, ua.VariantType.Double))
        alarm_node.set_value(ua.Variant(alarm, ua.VariantType.Boolean))
    finally:
        try:
            client.disconnect()
        except Exception:
            pass


if __name__ == '__main__':
    write_metrics(0.975, 0.012, False)