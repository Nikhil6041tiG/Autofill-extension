import React, { useState, useEffect } from "react";
import { createRoot, Root } from "react-dom/client";
import { DetectedField, QuestionSection, FieldType } from "../../types/fieldDetection";
import { updateProfileField, loadProfile } from "../../core/storage/profileStorage";
import { fillField } from "../actions/fieldFiller";
import { FormScanner } from "../scanner/formScanner";

// CSS Styles specifically for the Shadow DOM injection
const STYLES = `
.autofill-floating-container {
  position: fixed;
  z-index: 2147483647;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  user-select: none;
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1), height 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Floating Icon State */
.autofill-floating-container.icon {
  width: 60px;
  height: 60px;
}

.floating-icon {
  width: 60px;
  height: 60px;
  background: white;
  border-radius: 50% 50% 0 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  cursor: grab;
  position: relative;
  border: 4px solid #00d084;
  /* JobRight green */
  transition: transform 0.2s;
}

.floating-icon:hover {
  transform: scale(1.05);
}

.floating-icon:active {
  cursor: grabbing;
}

.close-x {
  position: absolute;
  top: -10px;
  left: -10px;
  width: 24px;
  height: 24px;
  background: white;
  border: 1px solid #ddd;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  color: #666;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transition: all 0.2s;
}

.close-x:hover {
  background: #f8f9fa;
  color: #dc3545;
  border-color: #dc3545;
}

/* Action Menu State */
.autofill-floating-container.menu {
  width: 220px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  overflow: hidden;
  border: 1px solid #eee;
}

.menu-header {
  padding: 8px 12px;
  background: #f8f9fa;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #eee;
}

.drag-handle {
  color: #ccc;
  cursor: grab;
  font-size: 18px;
}

.menu-content {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.run-autofill-btn {
  background: #00d084;
  color: white;
  border: none;
  padding: 12px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: background 0.2s;
}

.run-autofill-btn:hover {
  background: #00b371;
}

.view-details-btn {
  background: #f1f3f5;
  color: #495057;
  border: none;
  padding: 8px;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.2s;
}

.view-details-btn:hover {
  background: #e9ecef;
}

/* Details Panel State */
.details-panel {
  width: 400px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  max-height: 80vh;
}

.autofill-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: linear-gradient(135deg, #00d084 0%, #00b371 100%);
  color: white;
}

.autofill-header h3 {
  margin: 0;
  font-size: 16px;
}

.header-actions .action-btn {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: white;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  cursor: pointer;
}

.view-tabs {
  display: flex;
  background: #f1f3f5;
  padding: 4px;
}

.view-tabs button {
  flex: 1;
  padding: 8px;
  border: none;
  background: none;
  cursor: pointer;
  border-radius: 4px;
}

.view-tabs button.active {
  background: white;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  color: #00b371;
}

.autofill-content {
  overflow-y: auto;
  padding: 12px;
  flex: 1;
}

.panel-footer {
  padding: 12px;
  border-top: 1px solid #eee;
  background: #f8f9fa;
}

.run-autofill-btn.mini {
  width: 100%;
  padding: 8px;
}

/* Reuse existing FieldItem styles from previous CSS */
.autofill-stats {
  padding: 12px;
  background: #f8f9fa;
  border-radius: 8px;
  margin-bottom: 12px;
}

.stat {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  margin-bottom: 4px;
}

.section-filter {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.section-filter button {
  font-size: 10px;
  padding: 4px 8px;
  border: 1px solid #ddd;
  border-radius: 12px;
  background: white;
  cursor: pointer;
}

.section-filter button.active {
  background: #00d084;
  color: white;
  border-color: #00d084;
}

.fields-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field-item {
  padding: 10px;
  border: 1px solid #eee;
  border-radius: 8px;
  font-size: 12px;
  cursor: pointer;
}

.field-item:hover {
  border-color: #00d084;
}

.field-item.filled {
  border-left: 4px solid #28a745;
}

.field-item.suggested {
  border-left: 4px solid #007bff;
}

.field-item.skipped {
  border-left: 4px solid #fab005;
}

.field-status.suggested {
  color: #007bff;
  font-style: italic;
}

.field-header {
  display: flex;
  justify-content: space-between;
  font-weight: 500;
  margin-bottom: 4px;
}

.field-details {
  display: flex;
  gap: 8px;
  color: #868e96;
  font-size: 10px;
}

.confidence.high {
  color: #28a745;
}

.edit-btn {
  margin-left: auto;
  color: #00d084;
  background: none;
  border: 1px solid #00d084;
  border-radius: 4px;
  padding: 2px 6px;
  cursor: pointer;
}

.edit-field-ui {
  margin-top: 8px;
  padding: 8px;
  background: #f8f9fa;
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.edit-field-ui input,
.edit-field-ui select {
  padding: 6px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.edit-actions {
  display: flex;
  gap: 4px;
  justify-content: flex-end;
}

.save-btn {
  background: #28a745;
  color: white;
  border: none;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
}

.cancel-btn {
  background: #ced4da;
  border: none;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
}

/* Performance Tracker Styles */
.performance-tracker {
  padding: 12px;
  background: #f8f9fa;
  border-radius: 8px;
  margin-bottom: 12px;
  font-size: 11px;
}

.performance-tracker-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
  margin-bottom: 8px;
  color: #495057;
}

.performance-timeline {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.perf-item {
  display: flex;
  justify-content: space-between;
  padding: 4px 0;
  color: #6c757d;
}

.perf-label {
  font-weight: 500;
}

.perf-value {
  color: #00b371;
  font-family: monospace;
}

.perf-duration {
  color: #868e96;
  font-size: 10px;
  margin-left: 6px;
}

.perf-total {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #dee2e6;
  display: flex;
  justify-content: space-between;
  font-weight: 600;
  color: #212529;
}

.perf-total-value {
  color: #00d084;
  font-size: 13px;
}
`;

interface OverlayPanelProps {
    fields: DetectedField[];
    onAutoFill: () => Promise<void>;
    onFieldUpdate: (index: number, field: DetectedField) => void;
}

interface PerformanceMetrics {
    scanStarted?: Date;
    scanCompleted?: Date;
    mappingCompleted?: Date;
    fillStarted?: Date;
    fillCompleted?: Date;
}

type ViewState = "ICON" | "MENU" | "DETAILS";

// Helper functions for performance tracking
const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    });
};

const calculateDuration = (start: Date, end: Date): string => {
    const diffMs = end.getTime() - start.getTime();
    const minutes = Math.floor(diffMs / 60000);
    const seconds = Math.floor((diffMs % 60000) / 1000);

    if (minutes > 0) {
        return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
};

const OverlayPanel: React.FC<OverlayPanelProps> = ({ fields: initialFields, onAutoFill, onFieldUpdate }) => {
    const [viewState, setViewState] = useState<ViewState>("ICON");
    const [position, setPosition] = useState({ x: window.innerWidth - 80, y: 100 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const [selectedSection, setSelectedSection] = useState<QuestionSection | "all">("all");
    const [viewMode, setViewMode] = useState<"fields" | "resume">("fields");
    const [resumeText, setResumeText] = useState<string>("");
    const [fields, setFields] = useState<DetectedField[]>(initialFields);
    const [isFilling, setIsFilling] = useState(false);
    const [isMapping, setIsMapping] = useState(false);
    const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics>({});

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (isDragging) {
                setPosition({
                    x: e.clientX - dragOffset.x,
                    y: e.clientY - dragOffset.y
                });
            }
        };

        const handleMouseUp = () => {
            setIsDragging(false);
        };

        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, dragOffset]);

    useEffect(() => {
        const fetchResume = async () => {
            const profile = await loadProfile();
            if (profile?.metadata?.resumeRawText) {
                setResumeText(profile.metadata.resumeRawText);
            }
        };
        fetchResume();
    }, []);

    // Adjust position when view state changes to keep panel within viewport
    useEffect(() => {
        const adjustPositionForViewport = () => {
            let panelWidth = 60; // ICON state default
            let panelHeight = 60;

            if (viewState === "MENU") {
                panelWidth = 220;
                panelHeight = 200; // Approximate height
            } else if (viewState === "DETAILS") {
                panelWidth = 400;
                panelHeight = Math.min(window.innerHeight * 0.8, 600); // 80vh max
            }

            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            const padding = 20; // Keep some padding from edges

            let newX = position.x;
            let newY = position.y;

            // Adjust X position if panel would overflow right edge
            if (position.x + panelWidth > viewportWidth - padding) {
                newX = viewportWidth - panelWidth - padding;
            }

            // Adjust X position if panel would overflow left edge
            if (newX < padding) {
                newX = padding;
            }

            // Adjust Y position if panel would overflow bottom edge
            if (position.y + panelHeight > viewportHeight - padding) {
                newY = viewportHeight - panelHeight - padding;
            }

            // Adjust Y position if panel would overflow top edge
            if (newY < padding) {
                newY = padding;
            }

            // Only update if position changed
            if (newX !== position.x || newY !== position.y) {
                setPosition({ x: newX, y: newY });
            }
        };

        adjustPositionForViewport();
    }, [viewState]); // Run when viewState changes

    const handleFieldUpdate = (index: number, newValue: string) => {
        const updatedFields = [...fields];
        const field = { ...updatedFields[index] };
        field.filled = true;
        field.filledValue = newValue;
        field.skipped = false;
        field.confidence = 1.0;

        updatedFields[index] = field;
        setFields(updatedFields);
        onFieldUpdate(index, field);
    };

    // Calculate stats
    const stats = calculateStats(fields);

    // Group fields by section
    const fieldsBySection = groupBySection(fields);

    // Filter fields
    const filteredFields =
        selectedSection === "all"
            ? fields
            : fields.filter((f) => f.section === selectedSection);

    const handleDragStart = (e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest('.close-x')) return;
        setIsDragging(true);
        setDragOffset({
            x: e.clientX - position.x,
            y: e.clientY - position.y
        });
    };

    const handleIconClick = (e: React.MouseEvent) => {
        if (!isDragging) {
            setViewState(viewState === "ICON" ? "MENU" : "ICON");
        }
    };

    const handleRunAutofill = async () => {
        await onAutoFill();
        // Refresh local fields state if needed, though they might update via props if orchestrator rescans
        setViewState("DETAILS");
    };

    const handleClose = (e: React.MouseEvent) => {
        e.stopPropagation();
        unmountOverlay();
    };

    /**
     * Execute the autofill action
     * This function can be called automatically after scan or manually via button
     */
    const executeFill = async (): Promise<boolean> => {
        const stored = (window as any).__AWL_MAPPED__;
        if (!stored) {
            alert('⚠️ Run "Scan Application" first!');
            return false;
        }

        if (isFilling) {
            console.log('[Ext] Fill already in progress, skipping...');
            return false;
        }

        // Record fill start time
        const fillStart = new Date();
        setPerformanceMetrics(prev => ({ ...prev, fillStarted: fillStart }));

        setIsFilling(true);
        console.log('[Ext] 🚀 Starting autofill execution...');

        try {
            // Load profile to get file names
            const profile = await loadProfile();

            // Helper function to map field types to Selenium types
            const mapToSeleniumType = (fieldType: string): string => {
                if (fieldType.includes('dropdown_custom')) return 'dropdown_custom';
                if (fieldType.includes('select') || fieldType.includes('dropdown')) return 'dropdown_native';
                if (fieldType === 'radio') return 'radio';
                if (fieldType === 'checkbox') return 'checkbox';
                if (fieldType === 'textarea') return 'textarea';
                if (fieldType === 'file') return 'input_file';
                return 'input_text'; // Default for text, email, tel, number, etc.
            };

            const fillPlan = {
                jobUrl: stored.jobUrl,
                actions: stored.answers
                    .filter((a: any) => a.answer) // Only include fields with answers
                    .map((a: any) => {
                        const action: any = {
                            id: a.selector.replace(/[^a-zA-Z0-9_-]/g, '_'), // Sanitize ID
                            type: mapToSeleniumType(a.fieldType),
                            selector: a.selector,
                            value: a.answer,
                            required: a.required || false
                        };

                        // Add fileName for file uploads
                        if (a.fieldType === 'file' && profile) {
                            if (a.selector.includes('resume') && profile.documents?.resume?.fileName) {
                                action.fileName = profile.documents.resume.fileName;
                            } else if (a.selector.includes('cover') && profile.documents?.coverLetter?.fileName) {
                                action.fileName = profile.documents.coverLetter.fileName;
                            }
                        }

                        return action;
                    })
            };

            console.log('[Ext] 🚀 Sending fill plan to Selenium:', fillPlan);
            const fill = await chrome.runtime.sendMessage({ action: 'runSelenium', plan: fillPlan });

            if (fill.success) {
                console.log('[Ext] ✅ Fill complete:', fill.data);

                // Issue #6: Verify filled fields
                console.log('[Ext] 🔍 Verifying filled fields...');
                await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s for fields to settle

                // Count successes and failures
                const results = fill.data.results || {};
                const failures = Object.entries(results).filter(([id, status]) => status === 'failed');
                const successes = Object.entries(results).filter(([id, status]) => status === 'success');

                console.log(`[Ext] ✅ Verification: ${successes.length} succeeded, ${failures.length} failed`);

                if (failures.length > 0) {
                    const failedItems = failures.map(([id]) => id).join(', ');
                    console.warn(`[Ext] ⚠️ Failed fields: ${failedItems}`);

                    const retry = confirm(
                        `✅ Filled ${successes.length}/${successes.length + failures.length} fields\n\n` +
                        `⚠️ ${failures.length} fields failed:\n${failedItems}\n\n` +
                        `Would you like to retry failed fields?`
                    );

                    if (retry) {
                        console.log('[Ext] 🔄 Retrying failed fields...');
                        // Create retry plan with only failed actions
                        const retryPlan = {
                            jobUrl: stored.jobUrl,
                            actions: fillPlan.actions.filter((action: any) =>
                                failures.some(([id]) => id === action.id)
                            )
                        };

                        const retryFill = await chrome.runtime.sendMessage({
                            action: 'runSelenium',
                            plan: retryPlan
                        });

                        if (retryFill.success) {
                            const retryResults = retryFill.data.results || {};
                            const retrySuccesses = Object.entries(retryResults).filter(([, status]) => status === 'success').length;
                            alert(`✅ Retry complete: ${retrySuccesses}/${failures.length} fields fixed!`);
                        }
                    } else {
                        alert(`✅ Filled ${successes.length}/${successes.length + failures.length} fields.\n\n⚠️ ${failures.length} fields need manual review.`);
                    }
                } else {
                    alert('✅ All fields filled successfully!');
                }

                // Record fill complete time
                const fillComplete = new Date();
                setPerformanceMetrics(prev => ({ ...prev, fillCompleted: fillComplete }));

                delete (window as any).__AWL_MAPPED__;
                setIsFilling(false);
                return true;
            } else {
                console.error('[Ext] ❌ Fill failed:', fill.error);
                alert('❌ Fill failed: ' + fill.error);
                setIsFilling(false);
                return false;
            }
        } catch (e) {
            console.error('[Ext] Fill error:', e);
            alert('❌ Error: ' + e);
            setIsFilling(false);
            return false;
        }
    };


    return (
        <div
            className={`autofill-floating-container ${viewState.toLowerCase()}`}
            style={{ left: `${position.x}px`, top: `${position.y}px` }}
            onMouseDown={handleDragStart}
        >
            {viewState === "ICON" && (
                <div className="floating-icon" onClick={handleIconClick}>
                    <div className="icon-bird">🤖</div>
                    <div className="close-x" onClick={handleClose}>×</div>
                </div>
            )}

            {viewState === "MENU" && (
                <div className="action-menu">
                    <div className="menu-header">
                        <div className="drag-handle">⠿</div>
                        <div className="close-x" onClick={() => setViewState("ICON")}>×</div>
                    </div>
                    <div className="menu-content">
                        <button
                            className="run-autofill-btn"
                            onClick={async () => {
                                const jobUrl = window.location.href;
                                try {
                                    // Record scan start time
                                    const scanStart = new Date();
                                    setPerformanceMetrics({ scanStarted: scanStart });

                                    console.log('[Ext] 🔍 Scanning current page...');

                                    // Use FormScanner (statically imported at top)
                                    const scanner = new FormScanner();
                                    const questions = await scanner.scan();

                                    console.log(`[Ext] ✓ Found ${questions.length} questions`);

                                    // Record scan complete time
                                    const scanComplete = new Date();
                                    setPerformanceMetrics(prev => ({ ...prev, scanCompleted: scanComplete }));

                                    // Send to QuestionMapper (via background script)
                                    console.log('[Ext] 🧠 Mapping...');
                                    setIsMapping(true);
                                    const map = await chrome.runtime.sendMessage({ action: 'mapAnswers', questions: questions });
                                    setIsMapping(false);
                                    if (!map.success) { alert('❌ Mapping failed: ' + map.error); return; }

                                    // Record mapping complete time
                                    const mappingComplete = new Date();
                                    setPerformanceMetrics(prev => ({ ...prev, mappingCompleted: mappingComplete }));

                                    const c = map.data.filter((a: any) => a.source === 'canonical').length;
                                    const f = map.data.filter((a: any) => a.source === 'fuzzy').length;
                                    const ai = map.data.filter((a: any) => a.source === 'AI').length;

                                    // Store for fill execution
                                    (window as any).__AWL_MAPPED__ = { jobUrl, answers: map.data };

                                    //Convert to DetectedField format for UI display
                                    const { classifySection } = await import('../index');
                                    const detectedFields: DetectedField[] = map.data.map((answer: any) => ({
                                        element: null as any, // Not needed for display-only
                                        questionText: answer.questionText,
                                        fieldType: answer.fieldType as any,
                                        isRequired: answer.required || false,
                                        options: answer.options || undefined,
                                        section: classifySection(answer.canonicalKey),
                                        canonicalKey: answer.canonicalKey,
                                        confidence: answer.confidence || 0.5,
                                        filled: false,
                                        skipped: !answer.answer,
                                        skipReason: !answer.answer ? 'No answer found' : undefined,
                                        filledValue: answer.answer,
                                        fileName: undefined
                                    }));

                                    // Update fields state
                                    setFields(detectedFields);

                                    // Show success message
                                    console.log(`[Ext] ✅ Scan complete: ${questions.length} questions, ${c} canonical, ${f} fuzzy, ${ai} AI`);

                                    // Switch to DETAILS view to show results
                                    setViewState('DETAILS');

                                    // ✅ User can now manually click "Autofill Run" to fill fields

                                    // AUTOMATION: Automatically trigger autofill run
                                    console.log('[Ext] ⚡ Automatically starting autofill run...');

                                    // Record fill start time
                                    const fillStart = new Date();
                                    setPerformanceMetrics(prev => ({ ...prev, fillStarted: fillStart }));
                                    setIsFilling(true);

                                    try {
                                        console.log('[Ext] 🚀 Starting PRODUCTION fill via autofillRunner...');

                                        // Build payload for autofillRunner
                                        const payload = {
                                            runId: `run_${Date.now()}`,
                                            url: window.location.href,
                                            jobId: jobUrl,
                                            fields: map.data.filter((a: any) => a.answer).map((answer: any) => ({
                                                questionText: answer.questionText,
                                                fieldType: answer.fieldType,
                                                value: answer.answer,
                                                canonicalKey: answer.canonicalKey,
                                                confidence: answer.confidence || 1.0,
                                                selector: answer.selector,
                                                options: answer.options,
                                                fileName: answer.fileName // Include fileName!
                                            }))
                                        };

                                        console.log(`[Ext] 📊 Sending ${payload.fields.length} fields to autofillRunner...`);

                                        // Send START_AUTOFILL_EVENT to autofillRunner (it will re-detect and match fields)
                                        const event = new CustomEvent('START_AUTOFILL_EVENT', { detail: payload });
                                        window.dispatchEvent(event);

                                        // Wait for autofillRunner to signal completion
                                        const result = await new Promise<{ successes: number; failures: number }>(resolve => {
                                            const completionHandler = (e: any) => {
                                                window.removeEventListener('AUTOFILL_COMPLETE_EVENT', completionHandler);
                                                resolve(e.detail);
                                            };
                                            window.addEventListener('AUTOFILL_COMPLETE_EVENT', completionHandler);
                                        });

                                        // Record fill complete time
                                        const fillComplete = new Date();
                                        setPerformanceMetrics(prev => ({ ...prev, fillCompleted: fillComplete }));

                                        console.log('[Ext] ✅ Autofill complete - check console for detailed results');
                                        setIsFilling(false);

                                        // Allow UI to render timestamp before showing alert
                                        setTimeout(() => {
                                            const total = payload.fields.length;
                                            const message = `✅ Filled ${result.successes}/${total} fields!\n\n${result.failures > 0 ? `⚠️ ${result.failures} field(s) failed` : ''}`;
                                            alert(message);
                                        }, 100);
                                    } catch (e) {
                                        console.error('[Ext] Autofill execution error:', e);
                                        setIsFilling(false);
                                    }

                                } catch (e) {
                                    console.error('[Ext] Scan error:', e);
                                    alert('❌ Error: ' + e);
                                }
                            }}
                        >
                            <span className="btn-icon">🔍</span> Scan Application
                        </button>
                        <button className="run-autofill-btn" onClick={async () => {
                            const stored = (window as any).__AWL_MAPPED__;
                            if (!stored) {
                                alert('⚠️ Run "Scan Application" first!');
                                return;
                            }

                            // Record fill start time
                            const fillStart = new Date();
                            setPerformanceMetrics(prev => ({ ...prev, fillStarted: fillStart }));
                            setIsFilling(true);

                            try {
                                console.log('[Ext] 🚀 Starting PRODUCTION fill via autofillRunner...');

                                // Build payload for autofillRunner
                                const payload = {
                                    runId: `run_${Date.now()}`,
                                    url: window.location.href,
                                    jobId: stored.jobUrl,
                                    fields: stored.answers.filter((a: any) => a.answer).map((answer: any) => ({
                                        questionText: answer.questionText,
                                        fieldType: answer.fieldType,
                                        value: answer.answer,
                                        canonicalKey: answer.canonicalKey,
                                        confidence: answer.confidence || 1.0,
                                        selector: answer.selector,
                                        options: answer.options,
                                        fileName: answer.fileName // Include fileName!
                                    }))
                                };

                                console.log(`[Ext] 📊 Sending ${payload.fields.length} fields to autofillRunner...`);

                                // Send START_AUTOFILL_EVENT to autofillRunner (it will re-detect and match fields)
                                const event = new CustomEvent('START_AUTOFILL_EVENT', { detail: payload });
                                window.dispatchEvent(event);

                                // Wait for autofillRunner to signal completion
                                const result = await new Promise<{ successes: number; failures: number }>(resolve => {
                                    const completionHandler = (e: any) => {
                                        window.removeEventListener('AUTOFILL_COMPLETE_EVENT', completionHandler);
                                        resolve(e.detail);
                                    };
                                    window.addEventListener('AUTOFILL_COMPLETE_EVENT', completionHandler);
                                });

                                // Record fill complete time
                                const fillComplete = new Date();
                                setPerformanceMetrics(prev => ({ ...prev, fillCompleted: fillComplete }));

                                console.log('[Ext] ✅ Autofill complete - check console for detailed results');
                                setIsFilling(false);

                                // Allow UI to render timestamp before showing alert
                                setTimeout(() => {
                                    const total = payload.fields.length;
                                    const message = `✅ Filled ${result.successes}/${total} fields!\n\n${result.failures > 0 ? `⚠️ ${result.failures} field(s) failed` : ''}`;
                                    alert(message);
                                }, 100);

                            } catch (error) {
                                console.error('[Ext] Fill error:', error);
                                alert('❌ Error: ' + error);
                                setIsFilling(false);
                            }
                        }} disabled={isFilling || isMapping}>
                            {isMapping ? '🧠 Mapping answers...' : (isFilling ? '⚡ Autofill Started...' : '⚡ Run Autofill Manually')}
                        </button>
                        <button className="view-details-btn" onClick={() => setViewState("DETAILS")}>
                            View Detection Details
                        </button>
                    </div>
                </div>
            )}

            {viewState === "DETAILS" && (
                <div className="details-panel">
                    <div className="autofill-header">
                        <div className="drag-handle">⠿</div>
                        <h3>🤖 Autofill Assistant</h3>
                        <div className="header-actions">
                            <button onClick={() => setViewState("ICON")} className="action-btn">
                                −
                            </button>
                        </div>
                    </div>

                    <div className="view-tabs">
                        <button
                            className={viewMode === "fields" ? "active" : ""}
                            onClick={() => setViewMode("fields")}
                        >
                            Detection List
                        </button>
                        <button
                            className={viewMode === "resume" ? "active" : ""}
                            onClick={() => setViewMode("resume")}
                        >
                            View Resume
                        </button>
                    </div>

                    <div className="autofill-content">
                        {viewMode === "fields" ? (
                            <>
                                {/* Stats Section */}
                                <div className="autofill-stats">
                                    <div className="stat">
                                        <span className="stat-label">Required:</span>
                                        <span className="stat-value">
                                            {stats.requiredFilled}/{stats.requiredTotal}
                                        </span>
                                        <span className="stat-percent">
                                            {stats.requiredPercent}%
                                        </span>
                                    </div>
                                    <div className="stat">
                                        <span className="stat-label">Optional:</span>
                                        <span className="stat-value">
                                            {stats.optionalFilled}/{stats.optionalTotal}
                                        </span>
                                        <span className="stat-percent">
                                            {stats.optionalPercent}%
                                        </span>
                                    </div>
                                </div>

                                {/* Performance Tracker */}
                                {performanceMetrics.scanStarted && (
                                    <div className="performance-tracker">
                                        <div className="performance-tracker-header">
                                            <span>⏱️</span>
                                            <span>Performance Tracker</span>
                                        </div>
                                        <div className="performance-timeline">
                                            {performanceMetrics.scanStarted && (
                                                <div className="perf-item">
                                                    <span className="perf-label">├─ Scan Started:</span>
                                                    <span className="perf-value">{formatTime(performanceMetrics.scanStarted)}</span>
                                                </div>
                                            )}
                                            {performanceMetrics.scanCompleted && (
                                                <div className="perf-item">
                                                    <span className="perf-label">├─ Scan Complete:</span>
                                                    <span className="perf-value">
                                                        {formatTime(performanceMetrics.scanCompleted)}
                                                        {performanceMetrics.scanStarted && (
                                                            <span className="perf-duration">
                                                                ({calculateDuration(performanceMetrics.scanStarted, performanceMetrics.scanCompleted)})
                                                            </span>
                                                        )}
                                                    </span>
                                                </div>
                                            )}
                                            {performanceMetrics.mappingCompleted && (
                                                <div className="perf-item">
                                                    <span className="perf-label">├─ Mapping Complete:</span>
                                                    <span className="perf-value">
                                                        {formatTime(performanceMetrics.mappingCompleted)}
                                                        {performanceMetrics.scanCompleted && (
                                                            <span className="perf-duration">
                                                                ({calculateDuration(performanceMetrics.scanCompleted, performanceMetrics.mappingCompleted)})
                                                            </span>
                                                        )}
                                                    </span>
                                                </div>
                                            )}
                                            {performanceMetrics.fillStarted && (
                                                <div className="perf-item">
                                                    <span className="perf-label">├─ Fill Started:</span>
                                                    <span className="perf-value">{formatTime(performanceMetrics.fillStarted)}</span>
                                                </div>
                                            )}
                                            {performanceMetrics.fillCompleted && (
                                                <div className="perf-item">
                                                    <span className="perf-label">├─ Fill Complete:</span>
                                                    <span className="perf-value">
                                                        {formatTime(performanceMetrics.fillCompleted)}
                                                        {performanceMetrics.fillStarted && (
                                                            <span className="perf-duration">
                                                                ({calculateDuration(performanceMetrics.fillStarted, performanceMetrics.fillCompleted)})
                                                            </span>
                                                        )}
                                                    </span>
                                                </div>
                                            )}
                                            {performanceMetrics.scanStarted && performanceMetrics.fillCompleted && (
                                                <div className="perf-total">
                                                    <span>└─ Total Duration:</span>
                                                    <span className="perf-total-value">
                                                        {calculateDuration(performanceMetrics.scanStarted, performanceMetrics.fillCompleted)}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Section Filter */}
                                <div className="section-filter">
                                    <button
                                        className={selectedSection === "all" ? "active" : ""}
                                        onClick={() => setSelectedSection("all")}
                                    >
                                        All ({fields.length})
                                    </button>
                                    {Object.keys(fieldsBySection).map((section) => (
                                        <button
                                            key={section}
                                            className={selectedSection === section ? "active" : ""}
                                            onClick={() => setSelectedSection(section as QuestionSection)}
                                        >
                                            {formatSectionName(section as QuestionSection)} (
                                            {fieldsBySection[section as QuestionSection].length})
                                        </button>
                                    ))}
                                </div>

                                {/* Fields List */}
                                <div className="fields-list">
                                    {filteredFields.map((field, index) => (
                                        <FieldItem
                                            key={index}
                                            field={field}
                                            onUpdate={(val) => handleFieldUpdate(fields.indexOf(field), val)}
                                        />
                                    ))}
                                </div>
                            </>
                        ) : (
                            <div className="resume-viewer">
                                <div className="resume-viewer-header">
                                    <button
                                        className="copy-btn"
                                        onClick={() => {
                                            navigator.clipboard.writeText(resumeText);
                                            alert("Resume text copied to clipboard!");
                                        }}
                                    >
                                        Copy Resume Text
                                    </button>
                                </div>
                                <pre>{resumeText || "No resume content found. Please upload a resume during onboarding."}</pre>
                            </div>
                        )}
                    </div>
                    <div className="panel-footer">
                        <button className="run-autofill-btn mini" onClick={handleRunAutofill}>
                            ⚡ Rerun Autofill
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

const FieldItem: React.FC<{ field: DetectedField; onUpdate: (val: string) => void }> = ({ field, onUpdate }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState(field.filledValue || "");

    const handleFocus = () => {
        field.element.scrollIntoView({ behavior: "smooth", block: "center" });
        field.element.focus();
    };

    const handleSave = async (e: React.MouseEvent) => {
        e.stopPropagation();

        // Update DOM element using our helper which handles all field types (including Greenhouse dropdowns)
        try {
            const result = await fillField(field, editValue);
            console.log(`Assistant manual fill result:`, result);
        } catch (err) {
            console.error("Failed to fill DOM element from assistant:", err);
        }

        // Update profile if canonical key is available
        if (field.canonicalKey) {
            try {
                await updateProfileField(field.canonicalKey, editValue);
                console.log(`Updated profile field: ${field.canonicalKey}`);
            } catch (err) {
                console.error("Failed to update profile from assistant:", err);
            }
        } else {
            // Store as custom answer for this question text
            try {
                const profile = await loadProfile();
                if (profile) {
                    const customAnswers = { ...profile.customAnswers, [field.questionText]: editValue };
                    const updatedProfile = { ...profile, customAnswers };
                    const { saveProfile } = await import("../../core/storage/profileStorage");
                    await saveProfile(updatedProfile);
                    console.log(`Stored custom answer for: ${field.questionText}`);
                }
            } catch (err) {
                console.error("Failed to store custom answer:", err);
            }
        }

        onUpdate(editValue);
        setIsEditing(false);
    };

    const handleEditClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsEditing(true);
    };

    return (
        <div
            className={`field-item ${field.filled ? "filled" : ""} ${field.skipped && field.filledValue ? "suggested" : ""} ${field.skipped && !field.filledValue ? "skipped" : ""
                } ${field.confidence < 0.6 ? "low-confidence" : ""}`}
            onClick={handleFocus}
        >
            <div className="field-header">
                <span className="field-question">{field.questionText}</span>
                {field.isRequired && <span className="required-badge">Required</span>}
            </div>

            <div className="field-details">
                <span className="field-type">{field.fieldType}</span>

                {!isEditing && field.filledValue && (
                    <span className={`field-status ${field.filled ? "filled" : "suggested"}`}>
                        {field.filled ? "✓ " : "💡 AI: "}
                        {field.filledValue === true || field.filledValue === "true" ? "Yes" :
                            field.filledValue === false || field.filledValue === "false" ? "No" :
                                truncate(String(field.filledValue || ""), 30)}
                    </span>
                )}

                {field.skipped && !field.filledValue && !isEditing && (
                    <span className="field-status skipped">
                        ⊘ {field.skipReason}
                    </span>
                )}

                {field.confidence > 0 && (
                    <span className={`confidence ${field.confidence > 0.8 ? "high" : field.confidence > 0.5 ? "mid" : "low"}`}>
                        Confidence: {(field.confidence * 100).toFixed(0)}%
                    </span>
                )}

                {!isEditing && (
                    <button className="edit-btn" onClick={handleEditClick}>
                        {field.filledValue ? "Edit" : "Add Answer"}
                    </button>
                )}
            </div>

            {isEditing && (
                <div className="edit-field-ui" onClick={(e) => e.stopPropagation()}>
                    {field.options && field.options.length > 0 ? (
                        <select
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            autoFocus
                        >
                            <option value="">Select an option...</option>
                            {field.options.map((opt, i) => (
                                <option key={i} value={opt}>{opt}</option>
                            ))}
                        </select>
                    ) : (
                        <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            autoFocus
                            placeholder={`Enter ${field.questionText}...`}
                        />
                    )}
                    <div className="edit-actions">
                        <button className="save-btn" onClick={handleSave}>Save & Store</button>
                        <button className="cancel-btn" onClick={() => setIsEditing(false)}>Cancel</button>
                    </div>
                </div>
            )}

            {field.canonicalKey && (
                <div className="field-mapping">
                    Mapped to: <code>{field.canonicalKey}</code>
                </div>
            )}
        </div>
    );
};

// Helper functions

function calculateStats(fields: DetectedField[]) {
    const requiredTotal = fields.filter((f) => f.isRequired).length;
    const requiredFilled = fields.filter((f) => f.isRequired && f.filled).length;
    const optionalTotal = fields.filter((f) => !f.isRequired).length;
    const optionalFilled = fields.filter((f) => !f.isRequired && f.filled).length;

    return {
        requiredTotal,
        requiredFilled,
        requiredPercent: requiredTotal > 0 ? Math.round((requiredFilled / requiredTotal) * 100) : 0,
        optionalTotal,
        optionalFilled,
        optionalPercent: optionalTotal > 0 ? Math.round((optionalFilled / optionalTotal) * 100) : 0,
    };
}

function groupBySection(fields: DetectedField[]): Record<QuestionSection, DetectedField[]> {
    const grouped: Record<string, DetectedField[]> = {};

    fields.forEach((field) => {
        if (!grouped[field.section]) {
            grouped[field.section] = [];
        }
        grouped[field.section].push(field);
    });

    return grouped as Record<QuestionSection, DetectedField[]>;
}

function formatSectionName(section: QuestionSection): string {
    const names: Record<QuestionSection, string> = {
        [QuestionSection.PERSONAL]: "Personal",
        [QuestionSection.EDUCATION]: "Education",
        [QuestionSection.EXPERIENCE]: "Experience",
        [QuestionSection.SKILLS]: "Skills",
        [QuestionSection.WORK_AUTHORIZATION]: "Work Auth",
        [QuestionSection.EEO]: "EEO",
        [QuestionSection.PREFERENCES]: "Preferences",
        [QuestionSection.OTHER]: "Other",
    };

    return names[section] || section;
}

function truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
}

// Render function called from content script - SHADOW DOM IMPLEMENTATION
export function renderOverlayPanel(
    fields: DetectedField[],
    onAutoFill: () => Promise<void>,
    onFieldUpdate: (index: number, field: DetectedField) => void
) {
    let host = document.getElementById("autofill-extension-host");

    if (!host) {
        // Create the HOST element in the DOM
        host = document.createElement("div");
        host.id = "autofill-extension-host";
        document.documentElement.appendChild(host);

        // Create Shadow DOM
        const shadow = host.attachShadow({ mode: "open" });

        // Inject Styles into Shadow DOM
        const styleTag = document.createElement("style");
        styleTag.textContent = STYLES;
        shadow.appendChild(styleTag);

        // Create Mount Point inside Shadow DOM
        const mountPoint = document.createElement("div");
        mountPoint.id = "autofill-root";
        shadow.appendChild(mountPoint);

        // Store root reference on the host for future updates
        (host as any)._reactRoot = createRoot(mountPoint);
    }

    // Render using the stored React Root
    const reactRoot = (host as any)._reactRoot as Root;
    if (reactRoot) {
        reactRoot.render(
            <OverlayPanel
                fields={fields}
                onAutoFill={onAutoFill}
                onFieldUpdate={onFieldUpdate}
            />
        );
    }
}

export function unmountOverlay() {
    const host = document.getElementById("autofill-extension-host");
    if (host) {
        if ((host as any)._reactRoot) {
            (host as any)._reactRoot.unmount();
        }
        host.remove();
    }
}
