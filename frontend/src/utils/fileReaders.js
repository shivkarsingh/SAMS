const MAX_IMAGE_DIMENSION = 1280;
const JPEG_QUALITY = 0.82;

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to prepare this image."));
    image.src = dataUrl;
  });
}

function canvasToDataUrl(canvas) {
  return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
}

async function resizeImageDataUrl(dataUrl) {
  const image = await loadImage(dataUrl);
  const scale = Math.min(
    1,
    MAX_IMAGE_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight)
  );
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    return dataUrl;
  }

  canvas.width = width;
  canvas.height = height;
  context.drawImage(image, 0, 0, width, height);

  return canvasToDataUrl(canvas);
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : "";

      if (!dataUrl.startsWith("data:image/")) {
        reject(new Error(`${file.name} is not a readable image.`));
        return;
      }

      try {
        const resizedDataUrl = await resizeImageDataUrl(dataUrl);

        resolve({
          fileName: file.name,
          dataUrl: resizedDataUrl
        });
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error(`Unable to read ${file.name}.`));
    };

    reader.readAsDataURL(file);
  });
}

export async function convertFilesToImagesPayload(fileList) {
  const files = Array.from(fileList ?? []);

  return Promise.all(files.map((file) => readFileAsDataUrl(file)));
}
