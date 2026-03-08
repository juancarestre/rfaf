import { readPlaintextFile } from "./plaintext";
import type { Document } from "./types";

interface ReadFileSourceOptions {
  loadPdfFileReader?: () => Promise<(path: string) => Promise<Document>>;
  readPdfFile?: (path: string) => Promise<Document>;
  readPlaintextFile?: (path: string) => Promise<Document>;
}

function isPdfPath(path: string): boolean {
  return path.toLowerCase().endsWith(".pdf");
}

export async function readFileSource(
  path: string,
  options: ReadFileSourceOptions = {}
): Promise<Document> {
  const readPlaintext = options.readPlaintextFile ?? readPlaintextFile;

  if (isPdfPath(path)) {
    const readPdf =
      options.readPdfFile ??
      (await (options.loadPdfFileReader ?? loadPdfFileReader)());

    return readPdf(path);
  }

  return readPlaintext(path);
}

async function loadPdfFileReader(): Promise<(path: string) => Promise<Document>> {
  const module = await import("./pdf");
  return module.readPdfFile;
}
