import os
import sys
import json
import urllib.request
import urllib.parse

# Figma File and Node IDs
FILE_KEY = "F7Hk0XHlsfDkO3iqJi10sN"
NODE_IDS = ["92:7", "92:10", "92:4", "92:13"]
NODE_IDS_STR = ",".join(NODE_IDS)

def get_figma_token():
    token = os.environ.get("FIGMA_TOKEN") or os.environ.get("FIGMA_ACCESS_TOKEN")
    if not token:
        print("Error: Please set the FIGMA_TOKEN environment variable or run the script with your token.")
        print("Example: FIGMA_TOKEN=your_token_here python fetch_figma_covers.py")
        sys.exit(1)
    return token

def make_request(url, token):
    req = urllib.request.Request(
        url,
        headers={
            "X-Figma-Token": token,
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
        }
    )
    try:
        with urllib.request.urlopen(req) as response:
            return json.loads(response.read().decode())
    except Exception as e:
        print(f"Request failed for {url}: {e}")
        return None

def main():
    token = get_figma_token()
    
    # 1. Fetch Node Metadata to identify book titles and authors
    print("Fetching node metadata from Figma...")
    meta_url = f"https://api.figma.com/v1/files/{FILE_KEY}/nodes?ids={urllib.parse.quote(NODE_IDS_STR)}"
    meta_data = make_request(meta_url, token)
    
    if meta_data:
        print("\n--- Node Metadata ---")
        nodes = meta_data.get("nodes", {})
        for node_id, node_info in nodes.items():
            document = node_info.get("document", {})
            name = document.get("name")
            print(f"Node ID: {node_id} -> Name: {name}")
            # Recursively find text layers to see if we can identify Title/Author
            def print_text_layers(node):
                if node.get("type") == "TEXT":
                    print(f"  [Text Layer] '{node.get('name')}': \"{node.get('characters')}\"")
                for child in node.get("children", []):
                    print_text_layers(child)
            print_text_layers(document)
    
    # 2. Fetch Image Export URLs
    print("\nFetching image export URLs from Figma...")
    image_url = f"https://api.figma.com/v1/images/{FILE_KEY}?ids={urllib.parse.quote(NODE_IDS_STR)}&format=png&scale=2"
    image_data = make_request(image_url, token)
    
    if not image_data or "images" not in image_data:
        print("Error: Failed to retrieve image export URLs from Figma.")
        sys.exit(1)
        
    images = image_data["images"]
    os.makedirs("public/books", exist_ok=True)
    
    print("\nDownloading images...")
    node_file_map = {
        "92:7": "book_18.png",
        "92:10": "book_19.png",
        "92:4": "book_20.png",
        "92:13": "book_21.png"
    }
    
    for node_id, filename in node_file_map.items():
        img_url = images.get(node_id)
        if not img_url:
            print(f"Warning: No image URL found for node {node_id}")
            continue
            
        dest = os.path.join("public/books", filename)
        print(f"Downloading node {node_id} -> {dest}...")
        try:
            urllib.request.urlretrieve(img_url, dest)
            print(f"Successfully saved to {dest}")
        except Exception as e:
            print(f"Failed to download image for node {node_id}: {e}")

if __name__ == "__main__":
    main()
