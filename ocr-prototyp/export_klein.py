"""Fotos so ablegen, wie die App sie bekommt: EXIF-gedreht, lange Seite 1200 px, JPEG."""
import os
from multiprocessing import Pool
from PIL import Image, ImageOps

SRC = "/daten/Quelle/Blutdruck Fotos/"
DST = "/out/klein/"


def export(name):
    if not os.path.exists(DST + name):
        img = ImageOps.exif_transpose(Image.open(SRC + name)).convert("RGB")
        img.thumbnail((1200, 1200))
        img.save(DST + name, quality=92)


if __name__ == "__main__":
    os.makedirs(DST, exist_ok=True)
    with Pool() as p:
        p.map(export, [n for n in os.listdir(SRC) if n.lower().endswith(".jpg")], chunksize=8)
    print(len(os.listdir(DST)))
