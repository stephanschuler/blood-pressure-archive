FROM python:3.12-slim
RUN pip install --no-cache-dir pillow
# Archivtest braucht nur Pillow. Für Prototypen der Erkennung wieder einkommentieren:
# RUN pip install --no-cache-dir opencv-python-headless==4.10.0.84 numpy
# RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu
WORKDIR /work
