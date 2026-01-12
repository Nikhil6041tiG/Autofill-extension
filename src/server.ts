import express from "express";
import cors from "cors";
import multer from "multer";
import path from "path";
import fs from "fs";
import { parseResume } from "./parsers/resumeParser";
import fetch from "node-fetch";

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// File upload configuration
const upload = multer({
    dest: "uploads/",
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB max
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            "application/pdf",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ];

        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error("Invalid file type. Only PDF and DOCX allowed."));
        }
    },
});

// Routes

app.get("/health", (req, res) => {
    res.json({ status: "ok", message: "Resume parsing service running" });
});

// Endpoint to fetch data from external API and map it
app.get("/api/lead-details/:id", async (req, res) => {
    try {
        const leadId = req.params.id;
        const apiUrl = `http://127.0.0.1:8000/api/lead-details/${leadId}`;

        console.log(`Fetching lead data from: ${apiUrl}`);

        // Make request to external API (CRM on port 8000)
        const response = await fetch(apiUrl);

        if (!response.ok) {
            return res.status(response.status).json({
                error: `Failed to fetch data from external API: ${response.statusText}`
            });
        }

        const rawData: any = await response.json();

        // FILTER DATA: Ensure only relevant data is passed to the extension
        // This addresses the user's request to "ignore irrelevant data"
        const filteredData = {
            lead: rawData.lead ? {
                id: rawData.lead.id,
                email: rawData.lead.email,
                phone: rawData.lead.phone,
                location: rawData.lead.location,
                status: rawData.lead.status
            } : {},
            extractedData: Array.isArray(rawData.extractedData) ? rawData.extractedData.map((e: any) => ({
                fullName: e.fullName,
                email: e.email,
                phone: e.phone,
                location: e.location,
                linkedInUrl: e.linkedInUrl,
                education: e.education,
                workExperience: e.workExperience,
                skills: e.skills
            })) : []
        };

        console.log(`Successfully fetched and filtered data for lead: ${leadId}`);
        res.json(filteredData);
    } catch (error: any) {
        console.error("Error fetching external API data:", error);
        res.status(500).json({
            error: "Failed to fetch and map external API data",
            message: error.message
        });
    }
});

app.post("/parse-resume", upload.single("resume"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No file uploaded" });
        }

        console.log(`Parsing resume: ${req.file.originalname}`);

        // Parse the resume
        const parsedData = await parseResume(req.file.path, req.file.mimetype);

        // Clean up uploaded file
        fs.unlinkSync(req.file.path);

        res.json({
            success: true,
            data: parsedData,
        });
    } catch (error: any) {
        console.error("Error parsing resume:", error);

        // Clean up file if it exists
        if (req.file) {
            try {
                fs.unlinkSync(req.file.path);
            } catch (e) { }
        }

        res.status(500).json({
            error: "Failed to parse resume",
            message: error.message,
        });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`✅ Resume parsing server running on http://localhost:${PORT}`);
    console.log(`📄 Endpoint: POST /parse-resume`);
    console.log(`📄 Endpoint: GET /api/lead-details/:id`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
    console.log("SIGTERM received, shutting down gracefully");
    process.exit(0);
});

