function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      resolve({
        fileName: file.name,
        dataUrl: typeof reader.result === "string" ? reader.result : ""
      });
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
