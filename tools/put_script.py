#!/usr/bin/env python3

import json
import sys
import urllib.request
import urllib.error
from argparse import ArgumentParser

parser = ArgumentParser(description="Upload a script to a Shelly device (stop, upload, start)")
parser.add_argument("host", help="IP address or hostname of the Shelly device")
parser.add_argument("id", type=int, help="ID of the script slot on the device")
parser.add_argument("file", help="Local file containing the script code to upload")

CHUNK_SIZE = 1024


def call_rpc(host, method, params):
    """Call a Shelly RPC method and return the result."""
    url = f"http://{host}/rpc/{method}"
    req_data = json.dumps(params, ensure_ascii=False).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=req_data,
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(request, timeout=5) as response:
            result = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        print(f"HTTP error {e.code} calling {method}: {body}")
        sys.exit(1)
    except urllib.error.URLError as e:
        print(f"Connection error calling {method}: {e.reason}")
        sys.exit(1)

    if isinstance(result, dict) and result.get("code", 0) < 0:
        print(f"RPC error [{result['code']}]: {result.get('message', 'unknown')}")
        sys.exit(1)

    return result


def stop_script(host, script_id):
    """Stop a running script."""
    print(f"Stopping script {script_id}...")
    call_rpc(host, "Script.Stop", {"id": script_id})


def start_script(host, script_id):
    """Start a script."""
    print(f"Starting script {script_id}...")
    call_rpc(host, "Script.Start", {"id": script_id})


def upload_script(host, script_id, code):
    """Upload script code in chunks."""
    total = len(code)
    print(f"Uploading {total} bytes in {CHUNK_SIZE}-byte chunks", end="", flush=True)

    pos = 0
    append = False
    while pos < total:
        chunk = code[pos : pos + CHUNK_SIZE]
        call_rpc(host, "Script.PutCode", {
            "id": script_id,
            "code": chunk,
            "append": append,
        })
        pos += len(chunk)
        append = True
        print(".", end="", flush=True)

    print(f" done ({total} bytes)")


def main():
    args = parser.parse_args()

    with open(args.file, mode="r", encoding="utf-8") as f:
        code = f.read()

    stop_script(args.host, args.id)
    upload_script(args.host, args.id, code)
    start_script(args.host, args.id)

    print("Done")


if __name__ == "__main__":
    main()
