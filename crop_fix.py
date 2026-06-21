from PIL import Image

img_path = 'public/books/book_12.png'
img = Image.open(img_path)

# Crop out the bottom black bar and adjust width to keep 2:3 aspect ratio
# Original is 1444 x 2166
# Mask cut off ~91 pixels from the bottom -> New height 2075
# To maintain 2:3, new width is 2075 * (2/3) = 1383
# Crop from center horizontally
new_h = 2075
new_w = 1383

left = (1444 - 1383) // 2
top = 0
right = left + 1383
bottom = new_h

img_cropped = img.crop((left, top, right, bottom))
img_cropped = img_cropped.resize((1444, 2166), Image.Resampling.LANCZOS)
img_cropped.save('public/books/book_12.png')
print("Cropped out the bottom shade and resized to perfectly fill 2:3 aspect ratio")
