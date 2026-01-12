"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseResume = parseResume;
const fs_1 = __importDefault(require("fs"));
const pdf_parse_1 = __importDefault(require("pdf-parse"));
const mammoth_1 = __importDefault(require("mammoth"));
const dataExtractor_1 = require("../extractors/dataExtractor");
/**
 * Parse resume from file path
 */
async function parseResume(filePath, mimeType) {
    let text;
    if (mimeType === "application/pdf") {
        text = await parsePDF(filePath);
    }
    else if (mimeType ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
        text = await parseDOCX(filePath);
    }
    else {
        throw new Error("Unsupported file type");
    }
    // Extract structured data from text
    const extracted = (0, dataExtractor_1.extractDataFromText)(text);
    extracted.rawText = text;
    return extracted;
}
/**
 * Parse PDF file
 */
async function parsePDF(filePath) {
    const dataBuffer = fs_1.default.readFileSync(filePath);
    const data = await (0, pdf_parse_1.default)(dataBuffer);
    return data.text;
}
/**
 * Parse DOCX file
 */
async function parseDOCX(filePath) {
    const result = await mammoth_1.default.extractRawText({ path: filePath });
    return result.value;
}
