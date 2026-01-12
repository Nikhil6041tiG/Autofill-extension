import fs from "fs";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import { ParsedResume } from "../types/resume";
import { extractDataFromText } from "../extractors/dataExtractor";

/**
 * Parse resume from file path
 */
export async function parseResume(
    filePath: string,
    mimeType: string
): Promise<ParsedResume> {
    let text: string;

    if (mimeType === "application/pdf") {
        text = await parsePDF(filePath);
    } else if (
        mimeType ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
        text = await parseDOCX(filePath);
    } else {
        throw new Error("Unsupported file type");
    }

    // Extract structured data from text
    const extracted = extractDataFromText(text);
    extracted.rawText = text;

    return extracted;
}

/**
 * Parse PDF file
 */
async function parsePDF(filePath: string): Promise<string> {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);
    return data.text;
}

/**
 * Parse DOCX file
 */
async function parseDOCX(filePath: string): Promise<string> {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
}
