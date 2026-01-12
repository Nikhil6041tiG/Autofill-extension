// extension/src/content/fieldMatching.ts
/**
 * Field detection and matching by questionText similarity
 */

const LOG_PREFIX = "[FieldMatching]";

export type Detected = {
    questionText: string;
    element: HTMLElement;
    kind: "TEXT" | "TEXTAREA" | "SELECT_NATIVE" | "DROPDOWN_CUSTOM" | "RADIO" | "CHECKBOX" | "DATE" | "FILE";
    name?: string;
    id?: string;
};

/**
 * Detect all fillable fields in current DOM
 */
export function detectFieldsInCurrentDOM(): Detected[] {
    const out: Detected[] = [];

    // 1) Native inputs/textareas/selects
    const inputs = Array.from(document.querySelectorAll<HTMLElement>('input, textarea, select'));

    for (const el of inputs) {
        if (!isVisible(el)) continue;

        const tag = el.tagName.toLowerCase();
        const type = (el as HTMLInputElement).type?.toLowerCase?.() ?? "";

        // File
        if (tag === "input" && type === "file") {
            out.push({
                questionText: getQuestionTextFor(el) ?? "",
                element: el,
                kind: "FILE",
                id: el.id,
                name: (el as HTMLInputElement).name
            });
            continue;
        }

        // Checkbox
        if (tag === "input" && type === "checkbox") {
            out.push({
                questionText: getQuestionTextFor(el) ?? "",
                element: el,
                kind: "CHECKBOX",
                id: el.id,
                name: (el as HTMLInputElement).name
            });
            continue;
        }

        // Radio
        if (tag === "input" && type === "radio") {
            out.push({
                questionText: getQuestionTextFor(el) ?? "",
                element: el,
                kind: "RADIO",
                id: el.id,
                name: (el as HTMLInputElement).name
            });
            continue;
        }

        // Date
        if (tag === "input" && type === "date") {
            out.push({
                questionText: getQuestionTextFor(el) ?? "",
                element: el,
                kind: "DATE",
                id: (el as HTMLInputElement).id,
                name: (el as HTMLInputElement).name
            });
            continue;
        }

        // Select native
        if (tag === "select") {
            out.push({
                questionText: getQuestionTextFor(el) ?? "",
                element: el,
                kind: "SELECT_NATIVE",
                id: (el as HTMLSelectElement).id,
                name: (el as HTMLSelectElement).name
            });
            continue;
        }

        // Textarea
        if (tag === "textarea") {
            out.push({
                questionText: getQuestionTextFor(el) ?? "",
                element: el,
                kind: "TEXTAREA",
                id: (el as HTMLTextAreaElement).id,
                name: (el as HTMLTextAreaElement).name
            });
            continue;
        }

        // Text-like input
        if (tag === "input") {
            out.push({
                questionText: getQuestionTextFor(el) ?? "",
                element: el,
                kind: "TEXT",
                id: (el as HTMLInputElement).id,
                name: (el as HTMLInputElement).name
            });
            continue;
        }
    }

    // 2) ARIA combobox/listbox (custom dropdowns)
    const comboCandidates = Array.from(document.querySelectorAll<HTMLElement>(
        '[role="combobox"], [aria-haspopup="listbox"], input[role="combobox"]'
    ));

    for (const el of comboCandidates) {
        if (!isVisible(el)) continue;
        // Avoid duplicating native inputs already captured
        const alreadyAdded = out.some(d => d.element === el);
        if (alreadyAdded) continue;

        out.push({
            questionText: getQuestionTextFor(el) ?? "",
            element: el,
            kind: "DROPDOWN_CUSTOM",
            id: (el as any).id,
            name: (el as any).name
        });
    }

    // Filter: keep only entries with question text
    const filtered = out.filter(x => (x.questionText ?? "").trim().length > 0);

    console.log(`${LOG_PREFIX} Detected ${filtered.length} fields:`, filtered.map(f => ({ text: f.questionText.substring(0, 30), kind: f.kind })));

    return filtered;
}

/**
 * Find best matching field by questionText similarity
 */
export function bestMatchField(fields: Detected[], qText: string, canonicalKey?: string): Detected | null {
    const qn = normalize(qText);

    let best: { f: Detected; score: number } | null = null;

    for (const f of fields) {
        const ft = normalize(f.questionText);
        const score = similarity(qn, ft);

        // Boost score if canonicalKey matches (future enhancement)
        // const keyBoost = canonicalKey && f.canonicalKey === canonicalKey ? 0.2 : 0;

        if (!best || score > best.score) {
            best = { f, score };
        }
    }

    // Threshold for match
    if (!best || best.score < 0.55) {
        console.warn(`${LOG_PREFIX} No match above threshold for: ${qText} (best score: ${best?.score})`);
        return null;
    }

    console.log(`${LOG_PREFIX} Matched "${qText}" → "${best.f.questionText}" (score: ${best.score.toFixed(2)})`);
    return best.f;
}

/**
 * Get question text for an element
 */
function getQuestionTextFor(el: HTMLElement): string | null {
    // 1. Label element
    const lbl = getLabelFor(el);
    if (lbl?.textContent?.trim()) return lbl.textContent.trim();

    // 2. aria-label
    const aria = el.getAttribute("aria-label");
    if (aria?.trim()) return aria.trim();

    // 3. Closest field container
    const container = el.closest('[role="group"], .field, .form-field, .question, .input-group') as HTMLElement | null;
    if (container) {
        const t = container.innerText?.trim();
        if (t) return t.split("\n")[0].trim();
    }

    // 4. Placeholder
    const placeholder = (el as HTMLInputElement).placeholder;
    if (placeholder?.trim()) return placeholder.trim();

    return null;
}

function getLabelFor(el: HTMLElement): HTMLLabelElement | null {
    const id = (el as any).id;
    if (id) {
        const l = document.querySelector<HTMLLabelElement>(`label[for="${CSS.escape(id)}"]`);
        if (l) return l;
    }
    return el.closest("label");
}

function isVisible(el: HTMLElement): boolean {
    const r = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    return r.width > 0 && r.height > 0 && style.visibility !== "hidden" && style.display !== "none";
}

/**
 * Normalize text for comparison
 */
function normalize(s: string): string {
    return (s || "").toLowerCase().trim().replace(/\s+/g, " ").replace(/[*:?]/g, "");
}

/**
 * Calculate similarity between two strings
 * Uses Jaccard similarity on tokens + substring boost
 */
function similarity(a: string, b: string): number {
    if (!a || !b) return 0;
    if (a === b) return 1;
    if (a.includes(b) || b.includes(a)) return 0.9;

    const A = new Set(a.split(" ").filter(Boolean));
    const B = new Set(b.split(" ").filter(Boolean));
    const inter = new Set([...A].filter(x => B.has(x)));
    const union = new Set([...A, ...B]);

    return union.size ? inter.size / union.size : 0;
}
