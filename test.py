import os
import cv2
import numpy as np

# المسارات
images_dir = r""
labels_dir = r""

for file in os.listdir(labels_dir):
    if not file.endswith(".txt"):
        continue

    label_path = os.path.join(labels_dir, file)
    image_path_jpg = os.path.join(images_dir, file.replace(".txt", ".jpg"))
    image_path_png = os.path.join(images_dir, file.replace(".txt", ".png"))
    image_path = image_path_jpg if os.path.exists(image_path_jpg) else image_path_png

    if not os.path.exists(image_path):
        print("❌ لم يتم العثور على الصورة:", file)
        continue

    # قراءة الصورة (يدعم العربية)
    with open(image_path, "rb") as f:
        img_bytes = np.frombuffer(f.read(), np.uint8)
    img = cv2.imdecode(img_bytes, cv2.IMREAD_COLOR)
    if img is None:
        print("⚠️ خطأ في تحميل الصورة:", file)
        continue

    h, w = img.shape[:2]
    with open(label_path, "r", encoding="utf-8") as f:
        for line in f:
            parts = line.strip().split()
            if len(parts) != 5:
                continue
            cls, x, y, bw, bh = map(float, parts)
            x1 = int((x - bw / 2) * w)
            y1 = int((y - bh / 2) * h)
            x2 = int((x + bw / 2) * w)
            y2 = int((y + bh / 2) * h)
            cv2.rectangle(img, (x1, y1), (x2, y2), (0, 255, 0), 2)
            cv2.putText(img, str(int(cls)), (x1, y1 - 5),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 255), 1)

    cv2.imshow("YOLO Label Check", img)
    key = cv2.waitKey(0)
    if key == 27:  # اضغطي Esc للخروج
        break

cv2.destroyAllWindows()
