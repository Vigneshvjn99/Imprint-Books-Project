from PIL import Image
import os

img_path = 'public/books/book_12.png'
img = Image.open(img_path)
print(f"Original size: {img.size}, Mode: {img.mode}")

# Convert to RGBA to ensure alpha channel exists
img = img.convert("RGBA")

# Create a white background image
white_bg = Image.new("RGBA", img.size, (255, 255, 255, 255))
# Paste the image on top using the alpha channel as mask
white_bg.paste(img, (0, 0), img)

# Convert back to RGB to remove alpha
final_img = white_bg.convert("RGB")
final_img.save('public/books/book_12.png')
print("Saved with white background")
