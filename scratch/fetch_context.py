import urllib.request
import urllib.parse
import json
import threading
import time
import sys

def read_sse(response, post_url_holder, response_holder, done_event, req_id):
    current_event = None
    try:
        while not done_event.is_set():
            line = response.readline().decode('utf-8').strip()
            if not line:
                continue
            if line.startswith("event:"):
                current_event = line[len("event:"):].strip()
            elif line.startswith("data:"):
                data_val = line[len("data:"):].strip()
                if current_event == "endpoint":
                    if data_val.startswith("http"):
                        post_url_holder[0] = data_val
                    else:
                        post_url_holder[0] = urllib.parse.urljoin("http://127.0.0.1:3845/", data_val)
                elif current_event == "message":
                    msg = json.loads(data_val)
                    if msg.get("id") == req_id:
                        response_holder[0] = msg
                        done_event.set()
    except Exception as e:
        pass

def fetch_context(node_id, req_id):
    post_url_holder = [None]
    response_holder = [None]
    done_event = threading.Event()
    
    req = urllib.request.Request("http://127.0.0.1:3845/sse")
    response = urllib.request.urlopen(req)
    
    # Start reader thread
    t = threading.Thread(target=read_sse, args=(response, post_url_holder, response_holder, done_event, req_id))
    t.daemon = True
    t.start()
    
    # Wait for endpoint to be populated
    for _ in range(50):
        if post_url_holder[0]:
            break
        time.sleep(0.1)
        
    if not post_url_holder[0]:
        response.close()
        return None
        
    # Send tools/call POST request for get_design_context
    payload = {
        "jsonrpc": "2.0",
        "id": req_id,
        "method": "tools/call",
        "params": {
            "name": "get_design_context",
            "arguments": {
                "nodeId": node_id
            }
        }
    }
    
    post_data = json.dumps(payload).encode('utf-8')
    post_req = urllib.request.Request(
        post_url_holder[0],
        data=post_data,
        headers={"Content-Type": "application/json"}
    )
    
    try:
        with urllib.request.urlopen(post_req) as post_res:
            post_res.read()
    except Exception as e:
        response.close()
        return None
        
    # Wait for SSE reader to get the response
    done_event.wait(timeout=20)
    response.close()
    
    if response_holder[0]:
        return response_holder[0]
    return None

if __name__ == "__main__":
    nodes = ["128:6", "127:3", "128:15", "128:12", "128:9", "128:18", "128:21", "128:24"]
    req_id = 5000
    for node in nodes:
        print(f"\n=== Context for node {node} ===")
        res = fetch_context(node, req_id)
        req_id += 1
        if res:
            result = res.get("result", {})
            content = result.get("content", [])
            # Search for text content to identify book title/author
            for item in content:
                if item.get("type") == "text":
                    text_val = item.get("text", "")
                    # Print lines of the text if they contain clues
                    lines = text_val.split("\n")
                    for line in lines:
                        # Print only key lines
                        if "title" in line.lower() or "author" in line.lower() or "name" in line.lower() or "heading" in line.lower() or any(term in line.lower() for term in ["book", "cover", "by", "design"]):
                            print(f"  [Info] {line[:120]}")
                        # Print design context metadata if present
                        if "metadata" in line.lower() or "context" in line.lower():
                            print(f"  [Meta] {line[:120]}")
        else:
            print(f"Failed to fetch context for node {node}")
        time.sleep(0.5)
