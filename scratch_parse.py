import json

log_path = "/Users/vigneshvijayan/.gemini/antigravity/brain/f645e5ae-a855-4cbb-a063-aeeb895bc18e/.system_generated/logs/transcript.jsonl"

with open(log_path, 'r') as f:
    for line in f:
        step = json.loads(line)
        if step.get("step_index") == 247:
            print(json.dumps(step, indent=2))
            break
