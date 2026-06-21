import json

log_path = "/Users/vigneshvijayan/.gemini/antigravity/brain/f645e5ae-a855-4cbb-a063-aeeb895bc18e/.system_generated/logs/transcript.jsonl"

with open(log_path, 'r') as f:
    for line in f:
        step = json.loads(line)
        step_idx = step.get("step_index")
        step_type = step.get("type")
        
        # Check if the step is from MODEL or contains any image reference
        step_str = json.dumps(step)
        if "data:image" in step_str or "base64" in step_str or ".png" in step_str or ".jpg" in step_str:
            print(f"Step {step_idx}: type={step_type}, keys={list(step.keys())}")
            # Print first 100 chars of matches
            for key, val in step.items():
                val_str = str(val)
                if "data:image" in val_str or "base64" in val_str or ".png" in val_str or ".jpg" in val_str:
                    print(f"  Key '{key}' contains match: {val_str[:150]}...")
            print("-" * 50)
