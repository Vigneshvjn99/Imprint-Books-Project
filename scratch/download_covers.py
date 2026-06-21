import urllib.request
import urllib.parse
import json
import threading
import time
import base64
import os

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

def fetch_node_screenshot(node_id, output_path, req_id):
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
        return False
        
    # Send tools/call POST request
    payload = {
        "jsonrpc": "2.0",
        "id": req_id,
        "method": "tools/call",
        "params": {
            "name": "get_screenshot",
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
        return False
        
    # Wait for SSE reader to get the response
    done_event.wait(timeout=20)
    response.close()
    
    if response_holder[0]:
        res_json = response_holder[0]
        if "error" in res_json:
            print(f"Error for {node_id}: {res_json['error']}")
            return False
            
        result = res_json.get("result", {})
        content_list = result.get("content", [])
        for item in content_list:
            if item.get("type") == "image":
                img_base64 = item.get("data")
                img_data = base64.b64decode(img_base64)
                os.makedirs(os.path.dirname(output_path), exist_ok=True)
                with open(output_path, "wb") as f:
                    f.write(img_data)
                print(f"Successfully saved {node_id} to {output_path}")
                return True
        print(f"No image in response for {node_id}")
        return False
    else:
        print(f"Timeout for {node_id}")
        return False

if __name__ == "__main__":
    node_mapping = {
        "128:6": "public/books/book_22.png",
        "127:3": "public/books/book_23.png",
        "128:15": "public/books/book_24.png",
        "128:12": "public/books/book_25.png",
        "128:9": "public/books/book_26.png",
        "128:18": "public/books/book_27.png",
        "128:21": "public/books/book_28.png",
        "128:24": "public/books/book_29.png"
    }
    
    req_id = 1000
    for node_id, output_path in node_mapping.items():
        print(f"Downloading {node_id} to {output_path}...")
        success = fetch_node_screenshot(node_id, output_path, req_id)
        req_id += 1
        time.sleep(0.5)
    print("Done downloading all covers.")
