import { readPlaintextFile } from "./plaintext";
import type { Document } from "./types";

interface ReadFileSourceOptions {
  loadEpubFileReader?: () => Promise<(path: string) => Promise<Document>>;
  loadPdfFileReader?: () => Promise<(path: string) => Promise<Document>>;
  readEpubFile?: (path: string) => Promise<Document>;
  readPdfFile?: (path: string) => Promise<Document>;
  readPlaintextFile?: (path: string) => Promise<Document>;
}

function isEpubPath(path: string): boolean {
  return path.toLowerCase().endsWith(".epub");
}

function isPdfPath(path: string): boolean {
  return path.toLowerCase().endsWith(".pdf");
}

export async function readFileSource(
  path: string,
  options: ReadFileSourceOptions = {}
): Promise<Document> {
  const readPlaintext = options.readPlaintextFile ?? readPlaintextFile;

  if (isEpubPath(path)) {
    const readEpub =
      options.readEpubFile ??
      (await (options.loadEpubFileReader ?? loadEpubFileReader)());

    return readEpub(path);
  }

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

async function loadEpubFileReader(): Promise<(path: string) => Promise<Document>> {
  const module = await import("./epub");
  return module.readEpubFile;
}
