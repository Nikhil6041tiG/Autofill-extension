"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const multer_1 = __importDefault(require("multer"));
const fs_1 = __importDefault(require("fs"));
const resumeParser_1 = require("./parsers/resumeParser");
const node_fetch_1 = __importDefault(require("node-fetch"));
const app = (0, express_1.default)();
const PORT = 5000;
// Middleware
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// File upload configuration
const upload = (0, multer_1.default)({
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
        }
        else {
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
        // Make request to external API
        const response = await (0, node_fetch_1.default)(apiUrl);
        if (!response.ok) {
            return res.status(response.status).json({
                error: `Failed to fetch data from external API: ${response.statusText}`
            });
        }
        const data = await response.json();
        // Map the external API data to the format expected by the autofill system
        // This mapping will depend on the structure of your API response
        const mappedData = {
            success: true,
            data: {
                personal: {
                    firstName: data.firstName || data.first_name || data.name || "",
                    lastName: data.lastName || data.last_name || "",
                    email: data.email || "",
                    phone: data.phone || data.phoneNumber || "",
                    address: data.address || {},
                },
                professional: {
                    currentJobTitle: data.currentJobTitle || data.job_title || "",
                    currentCompany: data.currentCompany || data.company || "",
                    experience: data.experience || data.years_experience || 0,
                    skills: data.skills || [],
                },
                education: {
                    degree: data.degree || "",
                    school: data.school || data.university || "",
                    graduationYear: data.graduationYear || data.graduation_year || null,
                }
            }
        };
        console.log(`Successfully fetched and mapped data for lead: ${leadId}`);
        res.json(mappedData);
    }
    catch (error) {
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
        const parsedData = await (0, resumeParser_1.parseResume)(req.file.path, req.file.mimetype);
        // Clean up uploaded file
        fs_1.default.unlinkSync(req.file.path);
        res.json({
            success: true,
            data: parsedData,
        });
    }
    catch (error) {
        console.error("Error parsing resume:", error);
        // Clean up file if it exists
        if (req.file) {
            try {
                fs_1.default.unlinkSync(req.file.path);
            }
            catch (e) { }
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
});
// Graceful shutdown
process.on("SIGTERM", () => {
    console.log("SIGTERM received, shutting down gracefully");
    process.exit(0);
});
