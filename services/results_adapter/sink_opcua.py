def write_defect_tag(line_id: str, payload) -> bool:
    # Stub: in production, connect to OPC UA and write a tag value
    # Return True on successful write, False otherwise
    try:
        _ = line_id, payload
        return True
    except Exception:
        return False


