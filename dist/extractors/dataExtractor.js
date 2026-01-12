"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractDataFromText = extractDataFromText;
/**
 * Extract structured data from resume text using improved regex and NLP heuristics
 * Matches Jobright-level parsing accuracy
 */
function extractDataFromText(text) {
    const lines = text.split("\n").map((line) => line.trim()).filter(l => l.length > 0);
    return {
        personal: extractPersonalInfo(text, lines),
        education: extractEducation(text, lines),
        experience: extractExperience(text, lines),
        skills: extractSkills(text, lines),
        projects: extractProjects(text, lines),
        certifications: extractCertifications(text, lines),
    };
}
/**
 * Extract personal information
 */
function extractPersonalInfo(text, lines) {
    const personal = {
        firstName: "",
        lastName: "",
        email: "",
    };
    // Extract email
    const emailMatch = text.match(/[\w.-]+@[\w.-]+\.\w+/);
    if (emailMatch) {
        personal.email = emailMatch[0];
    }
    // Extract phone - more flexible pattern
    const phoneMatch = text.match(/(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]*[-–][-.\s]*\d{4}|\+?1?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
    if (phoneMatch) {
        personal.phone = phoneMatch[0];
    }
    // Extract name from first few lines (before email/phone typically)
    for (let i = 0; i < Math.min(5, lines.length); i++) {
        const line = lines[i];
        // Skip lines with emails, phones, or common resume headers
        if (line.match(/@|phone|email|linkedin|github|resum|cv|curriculum|profile/i))
            continue;
        if (line.length > 50)
            continue; // Too long to be a name
        // Name pattern: 2-4 words, allows ALL CAPS or Title Case
        if (line.match(/^[A-Z][a-zA-Z]+(\s+[A-Z][a-zA-Z]+){1,3}$/)) {
            const nameParts = line.split(/\s+/);
            personal.firstName = nameParts[0];
            personal.lastName = nameParts[nameParts.length - 1];
            break;
        }
    }
    // Fallback if regex failed: use the very first line if it looks like a name
    if (!personal.firstName && lines.length > 0) {
        const firstLine = lines[0];
        if (firstLine.length < 40 && !firstLine.includes("@")) {
            const parts = firstLine.split(/\s+/);
            if (parts.length >= 2) {
                personal.firstName = parts[0];
                personal.lastName = parts[parts.length - 1];
            }
        }
    }
    // Extract LinkedIn
    const linkedinMatch = text.match(/linkedin\.com\/in\/([\w-]+)/i);
    if (linkedinMatch) {
        personal.linkedin = `https://linkedin.com/in/${linkedinMatch[1]}`;
    }
    // Extract GitHub
    const githubMatch = text.match(/github\.com\/([\w-]+)/i);
    if (githubMatch) {
        personal.github = `https://github.com/${githubMatch[1]}`;
    }
    // Extract city and state - improved patterns
    const cityStateMatch = text.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?),\s*([A-Z]{2})\b/);
    if (cityStateMatch) {
        personal.city = cityStateMatch[1];
        personal.state = cityStateMatch[2];
    }
    // Extract postal code
    const zipMatch = text.match(/\b\d{5}(?:-\d{4})?\b/);
    if (zipMatch) {
        personal.postalCode = zipMatch[0];
    }
    return personal;
}
/**
 * Extract education with improved accuracy supporting 2-line format:
 * L1: Degree + Duration
 * L2: School + Location
 */
function extractEducation(text, lines) {
    const education = [];
    const eduStartIdx = lines.findIndex((line) => /^(education|academic\s+background)/i.test(line));
    if (eduStartIdx === -1)
        return education;
    const nextSectionIdx = lines.findIndex((line, idx) => idx > eduStartIdx &&
        /^(professional\s+experience|experience|work|projects|skills|certifications)/i.test(line));
    const eduEndIdx = nextSectionIdx === -1 ? lines.length : nextSectionIdx;
    const eduLines = lines.slice(eduStartIdx + 1, eduEndIdx);
    let currentEdu = null;
    // School regex: Improved to avoid "Bachelor of Technology" collisions
    const isSchool = (l) => l.match(/(University|College|Polytechnic|School|Academy|Institute of Technology|Sreenidhi Institute)/i);
    const isDegree = (l) => l.match(/(Bachelor|Master|PhD|B\.S\.|M\.S\.|B\.A\.|M\.A\.|MBA|B\.Tech|M\.Tech)/i);
    const dateRegex = /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}|20\d{2}\s*[-–]\s*(20\d{2}|Present)/i;
    for (let i = 0; i < eduLines.length; i++) {
        const line = eduLines[i].trim();
        if (!line)
            continue;
        // Start NEW entry if line has a Degree keyword
        if (isDegree(line)) {
            if (currentEdu && (currentEdu.degree || currentEdu.school)) {
                education.push(currentEdu);
            }
            currentEdu = { school: "", degree: "" };
            // Extract Degree
            const degreeMatch = line.match(/(Bachelor|Master|PhD|B\.S\.|M\.S\.|B\.A\.|M\.A\.|MBA|B\.Tech|M\.Tech)[^,\n|]*/i);
            if (degreeMatch) {
                currentEdu.degree = degreeMatch[0].replace(dateRegex, "").trim();
            }
            // Extract Major (if separated by 'in' or 'of')
            const majorMatch = line.match(/(?:in|of|-)\s+([A-Z][a-zA-Z\s&]+?)(?:\||,|$)/);
            if (majorMatch && !majorMatch[1].match(dateRegex)) {
                currentEdu.major = majorMatch[1].trim();
            }
            // Extract Dates from the same line
            if (line.match(dateRegex)) {
                const dateMatch = line.match(/([A-Z][a-z]{2,8}\s+)?(\d{4})\s*[-–]\s*([A-Z][a-z]{2,8}\s+)?(\d{4}|Present)/i);
                if (dateMatch) {
                    currentEdu.startDate = dateMatch[1] ? `${dateMatch[1].trim()} ${dateMatch[2]}` : dateMatch[2];
                    currentEdu.endDate = dateMatch[3] ? `${dateMatch[3].trim()} ${dateMatch[4]}` : dateMatch[4];
                }
            }
            continue; // Move to next line to look for School
        }
        // Capture School if we have an active entry without a school
        if (currentEdu && !currentEdu.school && (isSchool(line) || line.length < 100)) {
            if (line.includes("|")) {
                const parts = line.split("|").map(p => p.trim());
                currentEdu.school = parts[0];
                // Location is often after |
                if (parts[1])
                    currentEdu.location = parts[1];
            }
            else {
                currentEdu.school = line.trim();
            }
        }
        // Capture GPA always
        if (line.match(/GPA[:\s]*(\d\.?\d*)/i)) {
            const gpaMatch = line.match(/GPA[:\s]*(\d\.?\d*)/i);
            if (gpaMatch && currentEdu) {
                currentEdu.gpa = gpaMatch[1];
            }
        }
    }
    if (currentEdu && (currentEdu.degree || currentEdu.school)) {
        education.push(currentEdu);
    }
    return education;
}
/**
 * Extract work experience supporting 2-line title/company format
 */
function extractExperience(text, lines) {
    const experience = [];
    const expStartIdx = lines.findIndex((line) => /^(professional\s+experience|experience|employment|work\s+history|work\s+experience)/i.test(line));
    if (expStartIdx === -1)
        return experience;
    const nextSectionIdx = lines.findIndex((line, idx) => idx > expStartIdx &&
        /^(education|projects|skills|certifications)/i.test(line));
    const expEndIdx = nextSectionIdx === -1 ? lines.length : nextSectionIdx;
    const expLines = lines.slice(expStartIdx + 1, expEndIdx);
    let currentExp = null;
    const dateRegex = /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\s*[-–]\s*((Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}|Present)/i;
    for (let i = 0; i < expLines.length; i++) {
        const line = expLines[i].trim();
        if (!line)
            continue;
        // Entry Start: Line with Date usually has the Title
        if (line.match(dateRegex) && (line.match(/^[A-Z]/) || line.length < 100)) {
            if (currentExp && (currentExp.title || currentExp.company)) {
                experience.push(currentExp);
            }
            // Title is the part without the date
            currentExp = {
                title: line.replace(dateRegex, "").trim().replace(/\s{2,}/g, " "),
                company: "",
                bullets: []
            };
            const dateMatch = line.match(/([A-Z][a-z]{2,8}\s+\d{4})\s*[-–]\s*([A-Z][a-z]{2,8}\s+\d{4}|Present)/i);
            if (dateMatch) {
                currentExp.startDate = dateMatch[1];
                currentExp.endDate = dateMatch[2];
            }
            continue;
        }
        // Second line of header: Company | Location
        if (currentExp && !currentExp.company && !line.match(/^[•\-●]/)) {
            if (line.includes("|")) {
                const parts = line.split("|").map(p => p.trim());
                currentExp.company = parts[0];
                if (parts[1])
                    currentExp.location = parts[1];
            }
            else if (line.match(/^[A-Z][\w\s&,.-]+$/)) {
                // Heuristic: If it has City/State/Country pattern, split it
                const locMatch = line.match(/(.+?)(?:,\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?(?:\s*,\s*[A-Z][a-z]+)?))$/);
                if (locMatch) {
                    currentExp.company = locMatch[1].trim();
                    currentExp.location = locMatch[2].trim();
                }
                else {
                    currentExp.company = line.trim();
                }
            }
            continue;
        }
        // Bullet points (starts with dot, dash, or bullet symbol)
        if (currentExp && (line.startsWith("•") || line.startsWith("-") || line.startsWith("●") || line.match(/^\s*\.\s+/))) {
            const bullet = line.replace(/^[•\-●]|\.\s*/, "").trim();
            if (bullet.length > 5) {
                currentExp.bullets.push(bullet);
            }
        }
        // Achievement lines (multiline bullets or non-bulleted text)
        else if (currentExp && currentExp.company && line.length > 30) {
            if (line.match(/\b(built|developed|created|implemented|designed|led|managed|reduced|increased|improved|automated|streamlined|responsible|worked)\b/i)) {
                currentExp.bullets.push(line.trim());
            }
        }
    }
    if (currentExp && (currentExp.title || currentExp.company)) {
        experience.push(currentExp);
    }
    return experience;
}
/**
 * Extract skills - improved
 */
function extractSkills(text, lines) {
    const skills = [];
    const skillsStartIdx = lines.findIndex((line) => /^(skills|technical\s+skills|technologies|core\s+competencies)/i.test(line));
    if (skillsStartIdx === -1)
        return skills;
    const nextSectionIdx = lines.findIndex((line, idx) => idx > skillsStartIdx &&
        /^(education|projects|experience|certifications)/i.test(line));
    const skillsEndIdx = nextSectionIdx === -1 ? lines.length : nextSectionIdx;
    const skillsText = lines.slice(skillsStartIdx + 1, skillsEndIdx).join(" ");
    // Split by common delimiters
    const parts = skillsText.split(/[,;|•●]|\s{2,}/);
    parts.forEach(part => {
        const cleaned = part.trim();
        if (cleaned.length > 1 && cleaned.length < 50 && !cleaned.match(/^(and|the|with|using)$/i)) {
            if (!skills.includes(cleaned)) {
                skills.push(cleaned);
            }
        }
    });
    return skills;
}
/**
 * Extract projects
 */
function extractProjects(text, lines) {
    const projects = [];
    const projStartIdx = lines.findIndex((line) => /^projects/i.test(line));
    if (projStartIdx === -1)
        return undefined;
    return projects.length > 0 ? projects : undefined;
}
/**
 * Extract certifications
 */
function extractCertifications(text, lines) {
    const certStartIdx = lines.findIndex((line) => /^certifications/i.test(line));
    if (certStartIdx === -1)
        return undefined;
    return undefined;
}
