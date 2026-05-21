export const defaultCropSettings = {
  zoom: 1,
  offsetX: 0,
  offsetY: 0
};

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to load this photo."));
    image.src = dataUrl;
  });
}

export async function createCroppedImageDataUrl(
  dataUrl,
  cropSettings,
  options = {}
) {
  const image = await loadImage(dataUrl);
  const outputWidth = options.outputWidth ?? 640;
  const outputHeight = options.outputHeight ?? 640;
  const quality = options.quality ?? 0.9;
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context || !image.naturalWidth || !image.naturalHeight) {
    throw new Error("Unable to crop this photo.");
  }

  canvas.width = outputWidth;
  canvas.height = outputHeight;

  const scale =
    Math.max(outputWidth / image.naturalWidth, outputHeight / image.naturalHeight) *
    cropSettings.zoom;
  const scaledWidth = image.naturalWidth * scale;
  const scaledHeight = image.naturalHeight * scale;
  const maxOffsetX = Math.max(0, (scaledWidth - outputWidth) / 2);
  const maxOffsetY = Math.max(0, (scaledHeight - outputHeight) / 2);
  const drawX =
    (outputWidth - scaledWidth) / 2 + (cropSettings.offsetX / 100) * maxOffsetX;
  const drawY =
    (outputHeight - scaledHeight) / 2 + (cropSettings.offsetY / 100) * maxOffsetY;

  context.fillStyle = "#0f172a";
  context.fillRect(0, 0, outputWidth, outputHeight);
  context.drawImage(image, drawX, drawY, scaledWidth, scaledHeight);

  return canvas.toDataURL("image/jpeg", quality);
}
