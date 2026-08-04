/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from "react";
import { 
  CalibrationRun, 
  DimensionRow,
  CalibrationAnalysis 
} from "../types";
import { 
  checkAvg, 
  checkDiff, 
  checkError, 
  cleanNumber, 
  analyzeTestData, 
  average,
  getMountingHeightCategory,
  parseCSVText,
  parsePastedSpreadsheetText
} from "../utils/helpers";
import { 
  BarChart, 
  Bar, 
  LineChart,
  Line,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from "recharts";
import { 
  Target, 
  Upload, 
  Info, 
  FileBarChart2, 
  GitCompare, 
  Database, 
  Image as ImageIcon, 
  Trash2, 
  X, 
  Loader, 
  Compass, 
  CheckCircle, 
  AlertTriangle, 
  HelpCircle, 
  ChevronRight,
  TrendingDown,
  TrendingUp,
  Sliders,
  Sparkles,
  Copy,
  Check
} from "lucide-react";

interface DepthAnalyticsProps {
  appState: { tests: CalibrationRun[] };
  setAppState: React.Dispatch<React.SetStateAction<{ tests: CalibrationRun[] }>>;
  onShowAlert: (title: string, message: string, isError?: boolean) => void;
  onShowConfirm: (title: string, message: string, onConfirm: () => void) => void;
}

type TabType = 'single-report' | 'comparison' | 'raw-data';

// Helper to replace **bold** with <strong>bold</strong> and `code` with styled code tag
function formatBoldText(text: string): string {
  let formatted = text;
  const boldRegex = /\*\*(.*?)\*\*/g;
  formatted = formatted.replace(boldRegex, '<strong class="font-bold text-slate-900">$1</strong>');
  
  const codeRegex = /`(.*?)`/g;
  formatted = formatted.replace(codeRegex, '<code class="bg-slate-100 text-rose-600 font-mono text-xs px-1.5 py-0.5 rounded">$1</code>');
  
  return formatted;
}

function SimpleMarkdownRenderer({ content }: { content: string }) {
  const lines = content.split('\n');
  return (
    <div className="space-y-3.5 text-slate-700 text-sm leading-relaxed font-sans">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={idx} className="h-2" />;

        if (trimmed.startsWith('### ')) {
          return (
            <h4 key={idx} className="text-sm font-black text-slate-900 mt-4 mb-2 flex items-center gap-2 uppercase tracking-wider">
              <span className="w-1.5 h-3.5 bg-blue-600 rounded-full"></span>
              {trimmed.substring(4)}
            </h4>
          );
        }
        if (trimmed.startsWith('## ')) {
          return (
            <h3 key={idx} className="text-base font-extrabold text-blue-900 mt-6 mb-2 border-b border-slate-100 pb-1.5 flex items-center gap-1.5">
              {trimmed.substring(3)}
            </h3>
          );
        }
        if (trimmed.startsWith('# ')) {
          return (
            <h2 key={idx} className="text-lg font-black text-blue-950 mt-8 mb-3 uppercase tracking-wide">
              {trimmed.substring(2)}
            </h2>
          );
        }

        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          const bulletText = trimmed.substring(2);
          return (
            <li key={idx} className="ml-5 list-disc pl-1 text-slate-700 my-1">
              <span dangerouslySetInnerHTML={{ __html: formatBoldText(bulletText) }} />
            </li>
          );
        }

        if (/^\d+\.\s/.test(trimmed)) {
          const match = trimmed.match(/^(\d+\.\s)(.*)/);
          if (match) {
            return (
              <div key={idx} className="ml-2 my-2 flex items-start gap-2.5">
                <span className="bg-blue-50 text-blue-700 font-extrabold text-[10px] px-2 py-0.5 rounded-md mt-0.5 shrink-0">
                  {match[1].trim()}
                </span>
                <span className="text-slate-700" dangerouslySetInnerHTML={{ __html: formatBoldText(match[2]) }} />
              </div>
            );
          }
        }

        if (trimmed.startsWith('> ')) {
          return (
            <blockquote key={idx} className="border-l-4 border-blue-400 bg-blue-50/40 p-3 rounded-r-xl italic my-3 text-slate-600">
              {trimmed.substring(2)}
            </blockquote>
          );
        }

        return (
          <p key={idx} className="my-1.5" dangerouslySetInnerHTML={{ __html: formatBoldText(trimmed) }} />
        );
      })}
    </div>
  );
}

export default function DepthAnalytics({ appState, setAppState, onShowAlert, onShowConfirm }: DepthAnalyticsProps) {
  const [activeTab, setActiveTab] = useState<TabType>('single-report');
  
  // Single Report selectors
  const [selectedSingleId, setSelectedSingleId] = useState<string>('');
  
  // Comparison selectors
  const [compTestAId, setCompTestAId] = useState<string>('');
  const [compTestBId, setCompTestBId] = useState<string>('');

  // Multi-test comparison selectors
  const [selectedCompIds, setSelectedCompIds] = useState<string[]>([]);
  const [compareReport, setCompareReport] = useState<string | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [compSubTab, setCompSubTab] = useState<'multi' | 'pairwise'>('multi');

  // Upload Dialog
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadName, setUploadName] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Screenshot viewer Dialog
  const [viewingImageTest, setViewingImageTest] = useState<CalibrationRun | null>(null);

  // Sync default selection if state changes
  React.useEffect(() => {
    if (appState.tests.length > 0) {
      if (!selectedSingleId || !appState.tests.some(t => t.id === selectedSingleId)) {
        setSelectedSingleId(appState.tests[0].id);
      }
      if (!compTestAId || !appState.tests.some(t => t.id === compTestAId)) {
        setCompTestAId(appState.tests[0].id);
      }
      if (!compTestBId || !appState.tests.some(t => t.id === compTestBId)) {
        setCompTestBId(appState.tests[1]?.id || appState.tests[0].id);
      }
      // Initialize multi-selection with first 3 runs if empty
      if (selectedCompIds.length === 0) {
        setSelectedCompIds(appState.tests.slice(0, 3).map(t => t.id));
      } else {
        // filter out any deleted tests
        setSelectedCompIds(prev => prev.filter(id => appState.tests.some(t => t.id === id)));
      }
    } else {
      setSelectedSingleId('');
      setCompTestAId('');
      setCompTestBId('');
      setSelectedCompIds([]);
    }
  }, [appState.tests]);

  // Selected single test
  const singleTest = useMemo(() => {
    return appState.tests.find(t => t.id === selectedSingleId) || null;
  }, [appState.tests, selectedSingleId]);

  // Comparison tests
  const testA = useMemo(() => appState.tests.find(t => t.id === compTestAId) || null, [appState.tests, compTestAId]);
  const testB = useMemo(() => appState.tests.find(t => t.id === compTestBId) || null, [appState.tests, compTestBId]);

  // Multi-comparison calculations
  const selectedCompRuns = useMemo(() => {
    return appState.tests
      .filter(t => selectedCompIds.includes(t.id))
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }, [appState.tests, selectedCompIds]);

  const multiRunTrendData = useMemo(() => {
    return selectedCompRuns.map(run => ({
      name: run.name,
      'Overall Avg Error %': run.analysis.overallAvg,
      'Length Avg Error %': run.analysis.dimAvgs.Length,
      'Width Avg Error %': run.analysis.dimAvgs.Width,
      'Height Avg Error %': run.analysis.dimAvgs.Height,
    }));
  }, [selectedCompRuns]);

  const multiRunBoxMatrixData = useMemo(() => {
    const allBoxNames = Array.from(new Set(selectedCompRuns.flatMap(run => Object.keys(run.analysis.boxAvgs)))) as string[];
    return allBoxNames.map((boxName: string) => {
      const row: Record<string, string | number> = { box: boxName };
      selectedCompRuns.forEach(run => {
        row[run.id] = run.analysis.boxAvgs[boxName] !== undefined ? run.analysis.boxAvgs[boxName] : 'N/A';
      });
      return row;
    });
  }, [selectedCompRuns]);

  const multiRunHeuristics = useMemo(() => {
    if (selectedCompRuns.length === 0) return null;
    
    const overallAvgError = average(selectedCompRuns.map((run) => run.analysis.overallAvg));
    
    const bestRun = selectedCompRuns.reduce((best, curr) => curr.analysis.overallAvg < best.analysis.overallAvg ? curr : best, selectedCompRuns[0]);
    const worstRun = selectedCompRuns.reduce((worst, curr) => curr.analysis.overallAvg > worst.analysis.overallAvg ? curr : worst, selectedCompRuns[0]);
    
    const dimAvgs = {
      Length: average(selectedCompRuns.map((run) => run.analysis.dimAvgs.Length)),
      Width: average(selectedCompRuns.map((run) => run.analysis.dimAvgs.Width)),
      Height: average(selectedCompRuns.map((run) => run.analysis.dimAvgs.Height)),
    };
    
    const dims = Object.entries(dimAvgs);
    const bestDim = dims.reduce((a, b) => a[1] < b[1] ? a : b);
    const worstDim = dims.reduce((a, b) => a[1] > b[1] ? a : b);
    
    return {
      overallAvgError,
      bestRun,
      worstRun,
      dimAvgs,
      bestDim,
      worstDim
    };
  }, [selectedCompRuns]);

  // Core chart calculations
  const singleDimChartData = useMemo(() => {
    if (!singleTest) return [];
    return [
      { name: 'Length', 'Error %': singleTest.analysis.dimAvgs.Length },
      { name: 'Width', 'Error %': singleTest.analysis.dimAvgs.Width },
      { name: 'Height', 'Error %': singleTest.analysis.dimAvgs.Height },
    ];
  }, [singleTest]);

  const singleBoxChartData = useMemo(() => {
    if (!singleTest) return [];
    return Object.entries(singleTest.analysis.boxAvgs).map(([box, err]) => ({
      name: box,
      'Error %': err
    }));
  }, [singleTest]);

  const compDimChartData = useMemo(() => {
    if (!testA || !testB) return [];
    return [
      { name: 'Length', [testA.name]: testA.analysis.dimAvgs.Length, [testB.name]: testB.analysis.dimAvgs.Length },
      { name: 'Width', [testA.name]: testA.analysis.dimAvgs.Width, [testB.name]: testB.analysis.dimAvgs.Width },
      { name: 'Height', [testA.name]: testA.analysis.dimAvgs.Height, [testB.name]: testB.analysis.dimAvgs.Height },
    ];
  }, [testA, testB]);

  const compBoxChartData = useMemo(() => {
    if (!testA || !testB) return [];
    const allBoxes = Array.from(new Set([...Object.keys(testA.analysis.boxAvgs), ...Object.keys(testB.analysis.boxAvgs)]));
    return allBoxes.map(box => ({
      name: box,
      [testA.name]: testA.analysis.boxAvgs[box] || 0,
      [testB.name]: testB.analysis.boxAvgs[box] || 0
    }));
  }, [testA, testB]);

  // Insight generator calculations
  const singleInsights = useMemo(() => {
    if (!singleTest) return null;
    const { overallAvg, dimAvgs, boxAvgs } = singleTest.analysis;
    const dims = Object.entries(dimAvgs) as [string, number][];
    const bestDim = dims.reduce((a, b) => a[1] < b[1] ? a : b);
    const worstDim = dims.reduce((a, b) => a[1] > b[1] ? a : b);

    const boxes = Object.entries(boxAvgs) as [string, number][];
    const bestBox = boxes.reduce((a, b) => a[1] < b[1] ? a : b);
    const worstBox = boxes.reduce((a, b) => a[1] > b[1] ? a : b);

    let maxDeviation = 0;
    singleTest.data.forEach(d => {
      if (Math.abs(d.diff) > Math.abs(maxDeviation)) maxDeviation = d.diff;
    });

    const isOverallPassed = checkAvg(overallAvg) === 'Pass';
    
    let specificAdvice = "";
    if (worstDim[0] === 'Height') {
      specificAdvice = "Height (Z-axis) calculations are sensitive to overhead camera angles. Consider reviewing the depth-sensor calibration parameters for low-profile packages to improve vertical mapping.";
    } else {
      specificAdvice = `Variance in ${worstDim[0]} points to edge-detection or boundary mapping issues. Verify the lighting constraints and background recognition algorithms on the X/Y plane.`;
    }

    return {
      bestDim,
      worstDim,
      bestBox,
      worstBox,
      maxDeviation,
      isOverallPassed,
      specificAdvice
    };
  }, [singleTest]);

  // Pasting file/text inside depth workspace
  const handleContainerPaste = (e: React.ClipboardEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return; 
    }

    const clipboardData = e.clipboardData;
    let imageFile: File | null = null;
    const items = clipboardData.items;

    if (items) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') === 0) {
          imageFile = items[i].getAsFile();
          break;
        }
      }
    }

    if (imageFile) {
      setIsUploadOpen(true);
      const pastedFile = new File([imageFile], `screenshot-${Date.now()}.png`, { type: imageFile.type });
      setUploadFile(pastedFile);
      if (!uploadName) {
        setUploadName("Pasted Screenshot Run");
      }
      e.preventDefault();
      return;
    }

    const pastedText = clipboardData.getData('text/plain');
    if (pastedText && pastedText.trim().length > 0) {
      try {
        const rows = parsePastedSpreadsheetText(pastedText);
        if (rows.length >= 2) {
          const data: DimensionRow[] = [];
          let currentBox = "Unknown Box";
          let currentWeight = "";
          let extractedTime = "";
          let extractedCameraHeight: string | null = null;

          for (let r = 0; r < Math.min(rows.length, 10); r++) {
            const checkCols = rows[r];
            for (let c = 0; c < Math.min(checkCols.length, 4); c++) {
              const cell = (checkCols[c] || '').trim();
              if (cell && /[0-9]/.test(cell) && (cell.includes('/') || cell.includes(':') || /am|pm/i.test(cell))) {
                if (!/box|weight|dimension|actual|app|error|diff/i.test(cell)) {
                  extractedTime = cell;
                }
              }
              if (cell && /camera\s*height/i.test(cell)) {
                if (cell.includes('=')) {
                  extractedCameraHeight = cell.split('=')[1].trim();
                } else if (cell.includes(':')) {
                  extractedCameraHeight = cell.split(':')[1].trim();
                } else if (c + 1 < checkCols.length) {
                  extractedCameraHeight = checkCols[c+1].trim();
                }
              }
            }
          }

          if (!extractedTime) {
            extractedTime = new Date().toLocaleString() + " (Clipboard Sync)";
          }

          for (let i = 0; i < rows.length; i++) {
            const cols = rows[i];
            if (cols.length < 3) continue;

            let dimColIndex = -1;
            for (let j = 0; j < Math.min(cols.length, 5); j++) {
              const val = (cols[j] || '').toLowerCase().trim();
              if (val === 'length' || val === 'width' || val === 'height') {
                dimColIndex = j;
                break;
              }
            }

            if (dimColIndex !== -1) {
              if (dimColIndex > 0) {
                const potBox = cols[0].trim().replace(/\r?\n|\r/g, ' ');
                if (potBox !== '') currentBox = potBox;
              }
              if (dimColIndex > 1) {
                const potWeight = cols[1].trim();
                if (potWeight !== '') currentWeight = potWeight;
              }

              const dimRaw = cols[dimColIndex].toLowerCase().trim() as any;
              const dim = (dimRaw.charAt(0).toUpperCase() + dimRaw.slice(1)) as any;
              
              const actual = cleanNumber(cols[dimColIndex + 1]);
              let app = cleanNumber(cols[dimColIndex + 2]);
              if (isNaN(app)) {
                app = 0;
              }
              
              let errorVal = cleanNumber(cols[dimColIndex + 3]);
              let diffVal = cleanNumber(cols[dimColIndex + 4]);
              
              if (!isNaN(actual)) {
                const calcError = actual !== 0 ? (Math.abs(actual - app) / actual * 100) : 0;

                if (isNaN(errorVal) || isNaN(diffVal)) {
                  diffVal = parseFloat((actual - app).toFixed(2));
                  errorVal = calcError;
                } else {
                  if (errorVal > 0 && errorVal <= 1 && Math.abs((errorVal * 100) - calcError) < 2) {
                    errorVal = errorVal * 100;
                  }
                }
                
                errorVal = parseFloat(errorVal.toFixed(2));

                data.push({
                  box: currentBox,
                  weight: currentWeight,
                  dim,
                  actual,
                  app,
                  diff: diffVal,
                  error: errorVal
                });
              }
            }
          }

          if (data.length > 0) {
            const pastedRunName = `Clipboard Sync [${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}]`;
            saveTestRun(pastedRunName, extractedTime, data, null, extractedCameraHeight);
            onShowAlert("Clipboard Synced", `Successfully parsed and loaded "${pastedRunName}" with ${data.length} dimension metrics from your clipboard!`);
            e.preventDefault();
          }
        }
      } catch (err) {
        console.error("Clipboard load failed: ", err);
      }
    }
  };

  const processUpload = async () => {
    if (!uploadFile) {
      onShowAlert("Missing File", "Please select an Image or CSV file.");
      return;
    }
    if (!uploadName.trim()) {
      onShowAlert("Missing Name", "Please provide a name for this test.");
      return;
    }

    setIsProcessing(true);
    try {
      if (uploadFile.type.startsWith('image/')) {
        await processImageFile(uploadFile, uploadName);
      } else if (uploadFile.name.endsWith('.csv')) {
        await processCSVFile(uploadFile, uploadName);
      } else {
        onShowAlert("Unsupported File", "Unsupported file type. Please upload a .png, .jpeg, or .csv file.", true);
      }
    } catch (err: any) {
      console.error(err);
      onShowAlert("Processing Error", err.message || "Failed to parse upload", true);
    } finally {
      setIsProcessing(false);
    }
  };

  const processCSVFile = (file: File, name: string) => {
    return new Promise<void>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          const rawText = text.replace(/^\uFEFF/, '');
          const rows = parseCSVText(rawText);
          
          if (rows.length < 2) throw new Error("CSV appears empty or lacks data rows.");

          let extractedTime = "";
          let extractedCameraHeight: string | null = null;
          
          for (let r = 0; r < Math.min(rows.length, 10); r++) {
            const checkCols = rows[r];
            for (let c = 0; c < Math.min(checkCols.length, 4); c++) {
              const cell = checkCols[c].trim();
              if (cell && /[0-9]/.test(cell) && (cell.includes('/') || cell.includes(':') || /am|pm/i.test(cell))) {
                if (!/box|weight|dimension|actual|app|error|diff/i.test(cell)) {
                  extractedTime = cell;
                }
              }
              if (cell && /camera\s*height/i.test(cell)) {
                if (cell.includes('=')) {
                  extractedCameraHeight = cell.split('=')[1].trim();
                } else if (cell.includes(':')) {
                  extractedCameraHeight = cell.split(':')[1].trim();
                } else if (c + 1 < checkCols.length) {
                  extractedCameraHeight = checkCols[c+1].trim();
                }
              }
            }
          }
          
          if (!extractedTime) {
            extractedTime = new Date().toLocaleString() + " (Auto-Generated Fallback)"; 
          }

          const data: DimensionRow[] = [];
          let currentBox = "Unknown Box";
          let currentWeight = "";

          for (let i = 0; i < rows.length; i++) {
            const cols = rows[i];
            if (cols.length < 3) continue; 

            let dimColIndex = -1;
            for (let j = 0; j < Math.min(cols.length, 5); j++) {
              const val = (cols[j] || '').toLowerCase().trim();
              if (val === 'length' || val === 'width' || val === 'height') {
                dimColIndex = j;
                break;
              }
            }

            if (dimColIndex !== -1) {
              if (dimColIndex > 0) {
                const potBox = cols[0].trim().replace(/\r?\n|\r/g, ' ');
                if (potBox !== '') currentBox = potBox;
              }
              if (dimColIndex > 1) {
                const potWeight = cols[1].trim();
                if (potWeight !== '') currentWeight = potWeight;
              }

              const dimRaw = cols[dimColIndex].toLowerCase().trim() as any;
              const dim = (dimRaw.charAt(0).toUpperCase() + dimRaw.slice(1)) as any;
              
              const actual = cleanNumber(cols[dimColIndex + 1]);
              let app = cleanNumber(cols[dimColIndex + 2]);
              if (isNaN(app)) {
                app = 0;
              }
              
              let errorVal = cleanNumber(cols[dimColIndex + 3]);
              let diffVal = cleanNumber(cols[dimColIndex + 4]);
              
              if (!isNaN(actual)) {
                const calcError = actual !== 0 ? (Math.abs(actual - app) / actual * 100) : 0;

                if (isNaN(errorVal) || isNaN(diffVal)) {
                  diffVal = parseFloat((actual - app).toFixed(2));
                  errorVal = calcError;
                } else {
                  if (errorVal > 0 && errorVal <= 1 && Math.abs((errorVal * 100) - calcError) < 2) {
                    errorVal = errorVal * 100;
                  }
                }
                
                errorVal = parseFloat(errorVal.toFixed(2));

                data.push({
                  box: currentBox,
                  weight: currentWeight,
                  dim,
                  actual,
                  app,
                  diff: diffVal,
                  error: errorVal
                });
              }
            }
          }

          if (data.length === 0) throw new Error("No valid data found in CSV. Ensure format matches template.");

          saveTestRun(name, extractedTime, data, null, extractedCameraHeight);
          resolve();
        } catch (err) {
          reject(err);
        }
      };
      reader.readAsText(file);
    });
  };

  const processImageFile = (file: File, name: string) => {
    return new Promise<void>((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async (e) => {
        try {
          const dataUrl = e.target?.result as string;
          const base64Data = dataUrl.split(',')[1];
          const mimeType = file.type;

          // Call Express proxy endpoint `/api/analyze-image`
          const res = await fetch("/api/analyze-image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ base64Data, mimeType })
          });

          if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || "Failed to analyze image with Gemini API");
          }

          const responseData = await res.json();
          if (!responseData.rows || !Array.isArray(responseData.rows)) {
            throw new Error("No table rows found in Gemini extraction response.");
          }

          let extractedTime = responseData.timestamp || "";
          let extractedCameraHeight = responseData.cameraHeight || null;

          const data: DimensionRow[] = [];
          responseData.rows.forEach((item: any) => {
            const dimRaw = (item.dimension || '').toLowerCase().trim();
            const dim = (dimRaw.charAt(0).toUpperCase() + dimRaw.slice(1)) as any;
            const actual = item.actual;
            const app = item.app;

            if (!isNaN(actual) && !isNaN(app) && (dim === 'Length' || dim === 'Width' || dim === 'Height')) {
              const calcError = actual !== 0 ? (Math.abs(actual - app) / actual * 100) : 0;
              const diffVal = item.diff !== undefined ? item.diff : parseFloat((actual - app).toFixed(2));
              let errorVal = item.error !== undefined ? item.error : calcError;

              if (errorVal > 0 && errorVal <= 1 && Math.abs((errorVal * 100) - calcError) < 2) {
                errorVal = errorVal * 100;
              }
              errorVal = parseFloat(errorVal.toFixed(2));

              data.push({
                box: item.box || "Unknown Box",
                weight: item.weight || "",
                dim,
                actual,
                app,
                diff: diffVal,
                error: errorVal
              });
            }
          });

          if (!extractedTime) {
            extractedTime = new Date().toLocaleString() + " (Auto-Generated Fallback)";
          }

          if (data.length === 0) {
            throw new Error("No calibration rows extracted from the image.");
          }

          const overrideSummary: Partial<CalibrationAnalysis> = {};
          if (responseData.summaryOverallAvg !== undefined && responseData.summaryOverallAvg !== null) {
            overrideSummary.overallAvg = responseData.summaryOverallAvg;
          }

          if (
            responseData.summaryDimLength !== undefined ||
            responseData.summaryDimWidth !== undefined ||
            responseData.summaryDimHeight !== undefined
          ) {
            overrideSummary.dimAvgs = {
              Length: responseData.summaryDimLength ?? 0,
              Width: responseData.summaryDimWidth ?? 0,
              Height: responseData.summaryDimHeight ?? 0,
            };
          }

          saveTestRun(
            name, 
            extractedTime, 
            data, 
            dataUrl, 
            extractedCameraHeight, 
            Object.keys(overrideSummary).length > 0 ? overrideSummary : undefined
          );
          resolve();
        } catch (err) {
          reject(err);
        }
      };
    });
  };

  const saveTestRun = (
    name: string, 
    timestamp: string, 
    data: DimensionRow[], 
    sourceImage: string | null, 
    cameraHeight: string | null,
    overrideSummary?: Partial<CalibrationAnalysis>
  ) => {
    const analysis = analyzeTestData(data, overrideSummary);
    const newRun: CalibrationRun = {
      id: 'test_' + Date.now(),
      name,
      timestamp,
      cameraHeight,
      data,
      sourceImage,
      analysis
    };

    setAppState(prev => ({
      tests: [...prev.tests, newRun]
    }));
    
    setIsUploadOpen(false);
    setUploadFile(null);
    setUploadName('');
    
    // Switch single selection immediately to the new report
    setSelectedSingleId(newRun.id);
    setActiveTab('single-report');
  };

  // Delete Calibration Run
  const handleDeleteTest = (testId: string) => {
    onShowConfirm(
      "Delete Calibration Run?",
      "Are you sure you want to completely delete this calibration run? This cannot be undone.",
      () => {
        setAppState(prev => {
          const remaining = prev.tests.filter(t => t.id !== testId);
          return { tests: remaining };
        });
      }
    );
  };

  // Selection dropdowns helpers
  const compDiffOverall = useMemo(() => {
    if (!testA || !testB) return 0;
    return parseFloat((testB.analysis.overallAvg - testA.analysis.overallAvg).toFixed(2));
  }, [testA, testB]);

  // Height details
  const htDetailsA = useMemo(() => singleTest ? getMountingHeightCategory(singleTest.cameraHeight) : null, [singleTest]);
  const compHtDetailsA = useMemo(() => testA ? getMountingHeightCategory(testA.cameraHeight) : null, [testA]);
  const compHtDetailsB = useMemo(() => testB ? getMountingHeightCategory(testB.cameraHeight) : null, [testB]);

  const copyToClipboard = () => {
    if (!compareReport) return;
    navigator.clipboard.writeText(compareReport);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const downloadReportTxt = () => {
    if (!compareReport) return;
    const element = document.createElement("a");
    const file = new Blob([compareReport], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `SALI_QA_Calibration_Executive_Report_${Date.now()}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const generateComparisonReport = async () => {
    setIsGeneratingReport(true);
    setReportError(null);
    try {
      const selectedRunsData = selectedCompRuns.map(run => ({
        name: run.name,
        timestamp: run.timestamp,
        cameraHeight: run.cameraHeight,
        overallAvg: run.analysis.overallAvg,
        dimAvgs: run.analysis.dimAvgs,
        boxAvgs: run.analysis.boxAvgs
      }));

      const res = await fetch("/api/generate-compare-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectedRuns: selectedRunsData })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to generate report with Gemini API");
      }

      const data = await res.json();
      setCompareReport(data.report);
    } catch (err: any) {
      console.error(err);
      setReportError(err.message || "An unexpected error occurred while generating report.");
    } finally {
      setIsGeneratingReport(false);
    }
  };

  return (
    <div className="space-y-6" onPaste={handleContainerPaste}>
      {/* Header and Sync Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-900 flex items-center gap-3">
            <Target className="text-blue-600 h-8 w-8" /> Depth Calculation Analytics
          </h2>
          <p className="text-slate-500 mt-1">
            Upload package depth images (screenshots) or synced CSV test results to generate automated calibration logs.
          </p>
        </div>
        <div>
          <button 
            onClick={() => setIsUploadOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl shadow-sm font-bold transition-colors flex items-center gap-2 cursor-pointer text-sm w-full md:w-auto justify-center"
          >
            <Upload className="h-4 w-4" /> Upload Test Data
          </button>
        </div>
      </div>

      {/* Rules Legend */}
      <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-5 text-sm text-slate-700 flex flex-wrap gap-4 items-center justify-between shadow-xs">
        <div className="flex flex-wrap gap-4 items-center">
          <strong className="text-blue-800 flex items-center gap-1.5 font-bold">
            <Info className="h-4 w-4 text-blue-600" /> Validation Calibration Rules:
          </strong>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> % Dimensional Error &lt; 5%</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Physical Deviation between -0.4" and 0.4"</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Overall Box Averages &lt; 10%</span>
        </div>
      </div>

      {/* Main Grid split */}
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Navigation Sidebar */}
        <div className="w-full lg:w-64 shrink-0">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sticky top-6">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 px-2">Navigation</h3>
            <nav className="space-y-1">
              <button 
                onClick={() => switchTab('single-report')} 
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-colors cursor-pointer ${
                  activeTab === 'single-report' 
                    ? 'bg-blue-50 text-blue-700' 
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <FileBarChart2 className="h-4.5 w-4.5" /> Individual Report
              </button>
              <button 
                onClick={() => switchTab('comparison')} 
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-colors cursor-pointer ${
                  activeTab === 'comparison' 
                    ? 'bg-blue-50 text-blue-700' 
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <GitCompare className="h-4.5 w-4.5" /> Compare Tests
              </button>
              <button 
                onClick={() => switchTab('raw-data')} 
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-colors cursor-pointer ${
                  activeTab === 'raw-data' 
                    ? 'bg-blue-50 text-blue-700' 
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Database className="h-4.5 w-4.5" /> All Raw Data
              </button>
            </nav>
          </div>
        </div>

        {/* Workspace Display view */}
        <div className="flex-1 min-w-0">
          {/* TAB 1: Single Report */}
          {activeTab === 'single-report' && (
            <div className="space-y-6 animate-fade-in">
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row items-center gap-4 justify-between">
                <div className="flex items-center gap-4 w-full md:w-auto">
                  <label className="font-bold text-slate-700 whitespace-nowrap text-sm">Select Test to View:</label>
                  <select 
                    value={selectedSingleId}
                    onChange={(e) => setSelectedSingleId(e.target.value)}
                    className="bg-slate-50 border border-slate-300 text-slate-900 text-sm rounded-xl focus:ring-blue-500 focus:border-blue-500 block p-3 min-w-[250px] w-full md:w-auto font-medium cursor-pointer"
                  >
                    {appState.tests.length === 0 ? (
                      <option value="">No data uploaded</option>
                    ) : (
                      appState.tests.map(t => (
                        <option key={t.id} value={t.id}>
                          {t.name} [{t.timestamp.replace(' (Auto-Generated Fallback)', '')}]
                        </option>
                      ))
                    )}
                  </select>
                </div>
                {singleTest && (
                  <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                    {singleTest.sourceImage && (
                      <button 
                        onClick={() => setViewingImageTest(singleTest)}
                        className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-3.5 py-2 rounded-xl flex items-center gap-2 transition-colors whitespace-nowrap border border-blue-100 bg-white shadow-sm text-xs font-bold cursor-pointer"
                      >
                        <ImageIcon className="h-4 w-4" /> View Image
                      </button>
                    )}
                    <button 
                      onClick={() => handleDeleteTest(singleTest.id)}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 px-3.5 py-2 rounded-xl flex items-center gap-2 transition-colors whitespace-nowrap border border-red-100 bg-white shadow-sm text-xs font-bold cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" /> Delete Test
                    </button>
                  </div>
                )}
              </div>

              {singleTest ? (
                <div className="space-y-6">
                  {/* Test Heading */}
                  <div className="mb-2 pl-1">
                    <h3 className="text-2xl font-extrabold text-slate-900">{singleTest.name}</h3>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <p className="text-blue-600 font-bold flex items-center gap-2 bg-blue-50 px-3 py-1.5 rounded-lg text-xs">
                        <Database className="h-4 w-4" /> Data Timestamp: {singleTest.timestamp}
                      </p>
                      {singleTest.cameraHeight && htDetailsA && (
                        <p className="text-indigo-600 font-bold flex items-center gap-2 bg-indigo-50 px-3 py-1.5 rounded-lg text-xs">
                          <Sliders className="h-4 w-4" /> Camera Elevation: {htDetailsA.feet} ft ({htDetailsA.inches}")
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Summary KPI Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                      <div className="flex justify-between items-start mb-2">
                        <p className="text-sm font-bold text-slate-500">Overall Avg</p>
                        <span className={`p-1 px-2 text-xs font-bold rounded-lg ${checkAvg(singleTest.analysis.overallAvg) === 'Pass' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                          {checkAvg(singleTest.analysis.overallAvg)}
                        </span>
                      </div>
                      <h3 className="text-3xl font-extrabold text-slate-900">{singleTest.analysis.overallAvg}%</h3>
                    </div>

                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                      <div className="flex justify-between items-start mb-2">
                        <p className="text-sm font-bold text-slate-500">Length Avg</p>
                        <span className={`p-1 px-2 text-xs font-bold rounded-lg ${checkAvg(singleTest.analysis.dimAvgs.Length) === 'Pass' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                          {checkAvg(singleTest.analysis.dimAvgs.Length)}
                        </span>
                      </div>
                      <h3 className="text-3xl font-extrabold text-slate-900">{singleTest.analysis.dimAvgs.Length}%</h3>
                    </div>

                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                      <div className="flex justify-between items-start mb-2">
                        <p className="text-sm font-bold text-slate-500">Width Avg</p>
                        <span className={`p-1 px-2 text-xs font-bold rounded-lg ${checkAvg(singleTest.analysis.dimAvgs.Width) === 'Pass' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                          {checkAvg(singleTest.analysis.dimAvgs.Width)}
                        </span>
                      </div>
                      <h3 className="text-3xl font-extrabold text-slate-900">{singleTest.analysis.dimAvgs.Width}%</h3>
                    </div>

                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                      <div className="flex justify-between items-start mb-2">
                        <p className="text-sm font-bold text-slate-500">Height Avg</p>
                        <span className={`p-1 px-2 text-xs font-bold rounded-lg ${checkAvg(singleTest.analysis.dimAvgs.Height) === 'Pass' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                          {checkAvg(singleTest.analysis.dimAvgs.Height)}
                        </span>
                      </div>
                      <h3 className="text-3xl font-extrabold text-slate-900">{singleTest.analysis.dimAvgs.Height}%</h3>
                    </div>
                  </div>

                  {/* Dimension and Box Charts */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col min-h-[350px]">
                      <h3 className="text-base font-extrabold mb-6 text-slate-800 flex items-center gap-2">
                        <Compass className="h-4.5 w-4.5 text-slate-400" /> Error by Dimension
                      </h3>
                      <div className="flex-1 w-full min-h-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={singleDimChartData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="name" stroke="#94a3b8" />
                            <YAxis stroke="#94a3b8" unit="%" />
                            <Tooltip formatter={(v) => [`${v}%`, 'Average Error']} />
                            <Bar dataKey="Error %" fill="#3b82f6" radius={6} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col min-h-[350px]">
                      <h3 className="text-base font-extrabold mb-6 text-slate-800 flex items-center gap-2">
                        <Database className="h-4.5 w-4.5 text-slate-400" /> Error by Box Type
                      </h3>
                      <div className="flex-1 w-full min-h-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={singleBoxChartData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="name" stroke="#94a3b8" />
                            <YAxis stroke="#94a3b8" unit="%" />
                            <Tooltip formatter={(v) => [`${v}%`, 'Average Error']} />
                            <Bar dataKey="Error %" fill="#8b5cf6" radius={6} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  {/* Summary Centered Table */}
                  <div className="flex justify-center">
                    <div className="w-full max-w-2xl">
                      <table className="w-full text-center text-sm border-collapse bg-white shadow-sm rounded-2xl overflow-hidden border border-slate-200">
                        <thead className="bg-slate-100 text-xs uppercase font-bold text-slate-600">
                          <tr><th colSpan={Object.keys(singleTest.analysis.boxAvgs).length} className="p-3 border-b border-slate-200 text-center">Average Per Box</th></tr>
                          <tr>
                            {Object.keys(singleTest.analysis.boxAvgs).map((b, i, arr) => (
                              <th key={b} className={`p-2 border-b border-slate-200 ${i !== arr.length - 1 ? 'border-r border-slate-200' : ''} text-center`}>{b}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="font-bold">
                          <tr>
                            {Object.entries(singleTest.analysis.boxAvgs).map(([b, val], i, arr) => (
                              <td key={b} className={`p-3 ${i !== arr.length - 1 ? 'border-r border-slate-200' : ''} ${checkAvg(val as number) === 'Pass' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'} text-center`}>
                                {val as number}%
                              </td>
                            ))}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* AI Insights and Mount baseline correlations */}
                  {singleInsights && (
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-6">
                      <h3 className="text-xl font-bold text-slate-900 mb-2 flex items-center gap-2">
                        <Sparkles className="h-6 w-6 text-blue-600" /> Auto-Generated Insights & Summary
                      </h3>
                      <p className="text-slate-700 leading-relaxed text-base">
                        Overall, this test run <strong className={singleInsights.isOverallPassed ? "text-emerald-600" : "text-rose-600"}>{singleInsights.isOverallPassed ? "passed" : "failed"}</strong> the &lt;10% average error threshold with a final calibration score of <strong>{singleTest.analysis.overallAvg}%</strong>. The maximum physical deviation recorded across all boxes was <strong>{singleInsights.maxDeviation} inches</strong>. 
                        Notably, the <strong>{singleInsights.bestBox[0]}</strong> performed exceptionally well with an average error of only {singleInsights.bestBox[1]}%, successfully passing the threshold.
                      </p>

                      {/* Optical height audit */}
                      {singleTest.cameraHeight && htDetailsA && (
                        <div className="border-2 border-indigo-200 bg-gradient-to-r from-indigo-50/50 to-blue-50/50 rounded-2xl p-6 shadow-sm">
                          <div className="flex items-center gap-2 mb-4">
                            <div className="bg-indigo-100 p-2.5 rounded-xl text-indigo-700">
                              <Target className="h-5 w-5" />
                            </div>
                            <div>
                              <h4 className="text-indigo-950 font-extrabold text-base">Z-Axis & Mounting Distance Calibration Audit</h4>
                              <p className="text-xs text-indigo-500 font-medium">{htDetailsA.category}</p>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                            <div className="bg-white p-4 rounded-xl border border-indigo-100 flex flex-col justify-center items-center text-center shadow-xs">
                              <span className="text-[10px] text-indigo-500 font-bold uppercase tracking-wider">Mounted Distance</span>
                              <span className="text-2xl font-black text-indigo-950 mt-1">{htDetailsA.feet} ft <span className="text-xs font-normal text-slate-500">({htDetailsA.inches}")</span></span>
                              <span className="text-[10px] text-slate-400 mt-0.5">Scale to Lens Offset</span>
                            </div>
                            <div className="bg-white p-4 rounded-xl border border-indigo-100 flex flex-col justify-center items-center text-center shadow-xs">
                              <span className="text-[10px] text-indigo-500 font-bold uppercase tracking-wider">Z-Axis (Height) Error</span>
                              <span className={`text-2xl font-black ${singleTest.analysis.dimAvgs.Height < 5 ? 'text-emerald-600' : 'text-rose-600'} mt-1`}>
                                {singleTest.analysis.dimAvgs.Height}%
                              </span>
                              <span className="text-[10px] text-slate-400 mt-0.5">Target Threshold &lt; 5.0%</span>
                            </div>
                            <div className="text-xs text-slate-600 leading-relaxed md:col-span-1">
                              <strong className="text-indigo-900 block mb-1">Optical Physics Diagnostics:</strong>
                              <p className="mb-2">{htDetailsA.desc}</p>
                              <p className="text-slate-500"><strong className="text-indigo-950">System Assessment:</strong> {htDetailsA.physicalImpact}</p>
                            </div>
                          </div>

                          {htDetailsA.inches <= 24 && (
                            <div className="mt-4 p-3.5 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 flex items-start gap-2">
                              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                              <div>
                                <span className="font-bold">Extreme Close-Up Alert:</span> Since the camera is mounted at only <span className="font-bold">{htDetailsA.feet}ft</span>, perspective deformation heavily degrades edge dimension accuracy. Suggest raising the mounting baseline above 4ft (48") to flatten the perspective planes, or deploy a localized lens distortion correction matrix.
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Best / Worst stats */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100 flex items-start gap-3">
                          <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
                          <div>
                            <strong className="block text-slate-900 text-xs uppercase tracking-wide font-bold">Most Accurate Dimension</strong>
                            <span className="text-slate-800 text-lg font-bold">{singleInsights.bestDim[0]} <span className="text-sm font-normal text-slate-500 ml-1">({singleInsights.bestDim[1]}% avg error)</span></span>
                          </div>
                        </div>
                        
                        <div className="bg-rose-50/50 p-4 rounded-xl border border-rose-100 flex items-start gap-3">
                          <AlertTriangle className="h-5 w-5 text-rose-600 mt-0.5 shrink-0" />
                          <div>
                            <strong className="block text-slate-900 text-xs uppercase tracking-wide font-bold">Primary Bottleneck</strong>
                            <span className="text-slate-800 text-lg font-bold">{singleInsights.worstDim[0]} <span className="text-sm font-normal text-slate-500 ml-1">({singleInsights.worstDim[1]}% avg error)</span></span>
                          </div>
                        </div>

                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-start gap-3">
                          <CheckCircle className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
                          <div>
                            <strong className="block text-slate-900 text-xs uppercase tracking-wide font-bold">Best Performing Box</strong>
                            <span className="text-slate-800 text-lg font-bold">{singleInsights.bestBox[0]} <span className="text-sm font-normal text-slate-500 ml-1">({singleInsights.bestBox[1]}% avg error)</span></span>
                          </div>
                        </div>

                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-start gap-3">
                          <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                          <div>
                            <strong className="block text-slate-900 text-xs uppercase tracking-wide font-bold">Worst Performing Box</strong>
                            <span className="text-slate-800 text-lg font-bold">{singleInsights.worstBox[0]} <span className="text-sm font-normal text-slate-500 ml-1">({singleInsights.worstBox[1]}% avg error)</span></span>
                          </div>
                        </div>
                      </div>

                      {/* Tactical Roadmap */}
                      <div className="p-5 bg-blue-50/80 rounded-xl border border-blue-100 text-sm text-slate-700">
                        <h4 className="font-bold text-blue-900 text-base mb-3 flex items-center gap-2">
                          <Target className="h-5 w-5" /> Strategic Action Plan
                        </h4>
                        <ul className="space-y-3 list-disc pl-4 text-slate-600">
                          <li><span className="font-semibold text-slate-800">1. Maintain Strengths:</span> The tracking algorithms are optimized for profiles identical to the <strong>{singleInsights.bestBox[0]}</strong>, excelling in <strong>{singleInsights.bestDim[0]}</strong> calculations ({singleInsights.bestDim[1]}% error). Lock in these current sensor thresholds.</li>
                          <li><span className="font-semibold text-slate-800">2. Address Weaknesses:</span> Immediate recalibrations should focus on payloads similar to the <strong>{singleInsights.worstBox[0]}</strong>. It is currently dropping down overall systems metrics.</li>
                          <li><span className="font-semibold text-slate-800">3. Technical focus:</span> <strong>{singleInsights.worstDim[0]}</strong> is the primary dimensional bottleneck at {singleInsights.worstDim[1]}% average error. {singleInsights.specificAdvice}</li>
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-8 text-center text-slate-500 bg-white rounded-2xl shadow-sm border border-slate-200">
                  Select a test or upload new logs to display analysis.
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Compare Tests */}
          {activeTab === 'comparison' && (
            <div className="space-y-6 animate-fade-in">
              {/* Compare sub-tabs toggles */}
              <div className="flex border-b border-slate-200 justify-between items-center pb-0.5">
                <div className="flex gap-2">
                  <button
                    onClick={() => setCompSubTab('multi')}
                    className={`px-4 py-2.5 font-bold text-xs uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                      compSubTab === 'multi'
                        ? 'border-blue-600 text-blue-600 font-extrabold'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Multi-Run Trend Matrix ({selectedCompIds.length})
                  </button>
                  <button
                    onClick={() => setCompSubTab('pairwise')}
                    className={`px-4 py-2.5 font-bold text-xs uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                      compSubTab === 'pairwise'
                        ? 'border-blue-600 text-blue-600 font-extrabold'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Two-Run Pairwise Detail (A vs B)
                  </button>
                </div>
                <div className="text-[10px] font-bold text-slate-400 uppercase hidden sm:block">
                  SALI Pre-Production QA Suite
                </div>
              </div>

              {/* VIEW 1: Multi-Run Workspace */}
              {compSubTab === 'multi' && (
                <div className="space-y-6 animate-fade-in">
                  {/* Selectors Workspace */}
                  <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 pb-3 border-b border-slate-100">
                      <div>
                        <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                          <Database className="h-4 w-4 text-blue-600" /> Select Runs to Compare
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">Choose multiple calibration datasets for aggregate system diagnostics.</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setSelectedCompIds(appState.tests.map(t => t.id))}
                          className="px-2.5 py-1.5 text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer"
                        >
                          Select All
                        </button>
                        <button
                          onClick={() => setSelectedCompIds([])}
                          className="px-2.5 py-1.5 text-[11px] font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                        >
                          Clear
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[160px] overflow-y-auto pr-1">
                      {appState.tests.map(t => {
                        const isSelected = selectedCompIds.includes(t.id);
                        const mounting = getMountingHeightCategory(t.cameraHeight);
                        return (
                          <div
                            key={t.id}
                            onClick={() => {
                              setSelectedCompIds(prev => 
                                prev.includes(t.id) ? prev.filter(x => x !== t.id) : [...prev, t.id]
                              );
                            }}
                            className={`p-3 rounded-xl border-2 transition-all cursor-pointer flex items-center gap-3 ${
                              isSelected
                                ? 'border-blue-500 bg-blue-50/40 text-blue-950 shadow-xs'
                                : 'border-slate-100 hover:border-slate-300 bg-slate-50/50 text-slate-700'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}} // toggled by parent div click
                              className="h-4 w-4 text-blue-600 rounded-md border-slate-300 cursor-pointer focus:ring-blue-500"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-xs truncate">{t.name}</p>
                              <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-slate-500">
                                <span className="font-semibold text-slate-600">{t.analysis.overallAvg}% err</span>
                                <span>•</span>
                                <span>{mounting.feet} ft</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {selectedCompIds.length < 2 ? (
                    <div className="p-12 text-center text-slate-500 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center justify-center">
                      <GitCompare className="h-12 w-12 text-slate-300 mb-3 animate-pulse" />
                      <h3 className="font-bold text-slate-800 text-base">Select Multiple Runs</h3>
                      <p className="text-xs text-slate-500 max-w-sm mt-1 leading-relaxed">
                        Please check at least 2 or more calibration datasets in the selector above to generate aggregate trend charts, box matrices, and trigger the AI trend report.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* KPI Dashboard Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in">
                        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Runs Compared</p>
                          <h3 className="text-2xl font-extrabold text-slate-900 mt-1">{selectedCompRuns.length} datasets</h3>
                          <p className="text-[10px] text-slate-500 mt-1">Chronological series analysis</p>
                        </div>
                        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Aggregate Error</p>
                          <h3 className="text-2xl font-extrabold text-slate-900 mt-1">{multiRunHeuristics?.overallAvgError}%</h3>
                          <p className="text-[10px] text-slate-500 mt-1">Average across selected runs</p>
                        </div>
                        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Best Performance</p>
                          <h3 className="text-2xl font-extrabold text-emerald-600 truncate mt-1">{multiRunHeuristics?.bestRun.name}</h3>
                          <p className="text-[10px] text-emerald-500 font-medium mt-1">Lowest error: {multiRunHeuristics?.bestRun.analysis.overallAvg}%</p>
                        </div>
                        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Accuracy Drift Grade</p>
                          <h3 className={`text-2xl font-extrabold mt-1 ${
                            (multiRunHeuristics?.overallAvgError || 0) < 5 ? 'text-emerald-600' : (multiRunHeuristics?.overallAvgError || 0) < 10 ? 'text-amber-600' : 'text-rose-600'
                          }`}>
                            {(multiRunHeuristics?.overallAvgError || 0) < 5 ? 'Production Grade' : (multiRunHeuristics?.overallAvgError || 0) < 10 ? 'Marginal Drift' : 'Needs Calibration'}
                          </h3>
                          <p className="text-[10px] text-slate-500 mt-1">Based on target &lt; 5.0% error</p>
                        </div>
                      </div>

                      {/* Charts and Matrix split */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Multi-run trendline */}
                        <div className="border border-slate-200 bg-white p-6 rounded-2xl shadow-sm flex flex-col min-h-[380px]">
                          <div className="mb-4">
                            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wide">
                              <FileBarChart2 className="h-4.5 w-4.5 text-blue-600" /> Multi-Run Error Trendline
                            </h3>
                            <p className="text-xs text-slate-500 mt-0.5">Chronological tracking of overall and dimensional calibration errors.</p>
                          </div>
                          <div className="flex-1 w-full min-h-[250px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={multiRunTrendData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} />
                                <YAxis stroke="#94a3b8" unit="%" fontSize={11} />
                                <Tooltip formatter={(v) => [`${v}%`]} contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }} />
                                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                                <Line type="monotone" dataKey="Overall Avg Error %" stroke="#2563eb" strokeWidth={3} activeDot={{ r: 6 }} />
                                <Line type="monotone" dataKey="Height Avg Error %" stroke="#8b5cf6" strokeWidth={2} strokeDasharray="4 4" />
                                <Line type="monotone" dataKey="Length Avg Error %" stroke="#10b981" strokeWidth={1.5} />
                                <Line type="monotone" dataKey="Width Avg Error %" stroke="#f59e0b" strokeWidth={1.5} />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </div>

                        {/* Box Error Matrix */}
                        <div className="border border-slate-200 bg-white p-6 rounded-2xl shadow-sm flex flex-col min-h-[380px]">
                          <div className="mb-4">
                            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wide">
                              <Sliders className="h-4.5 w-4.5 text-blue-600" /> Box-by-Box Comparison Matrix
                            </h3>
                            <p className="text-xs text-slate-500 mt-0.5">Direct comparison of each box type across the selected runs.</p>
                          </div>
                          <div className="flex-1 overflow-auto max-h-[260px] border border-slate-100 rounded-xl">
                            <table className="w-full text-left border-collapse min-w-[380px]">
                              <thead>
                                <tr className="border-b border-slate-100 bg-slate-50/70 sticky top-0 z-10">
                                  <th className="py-2.5 px-3.5 text-xs font-extrabold text-slate-500 uppercase">Box Type</th>
                                  {selectedCompRuns.map(run => (
                                    <th key={run.id} className="py-2.5 px-3.5 text-xs font-extrabold text-slate-500 uppercase text-center truncate max-w-[120px]" title={run.name}>
                                      {run.name}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {multiRunBoxMatrixData.map(row => (
                                  <tr key={row.box} className="hover:bg-slate-50/30 transition-colors">
                                    <td className="py-3 px-3.5 text-xs font-bold text-slate-800">{row.box}</td>
                                    {selectedCompRuns.map(run => {
                                      const val = row[run.id];
                                      if (val === 'N/A') {
                                        return (
                                          <td key={run.id} className="py-3 px-3.5 text-xs text-slate-400 text-center font-semibold">
                                            N/A
                                          </td>
                                        );
                                      }
                                      const numVal = typeof val === 'number' ? val : parseFloat(val as string);
                                      const isPass = numVal < 10;
                                      return (
                                        <td key={run.id} className="py-3 px-3.5 text-center">
                                          <span className={`inline-block px-2.5 py-1 text-[11px] font-extrabold rounded-md ${
                                            isPass ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'
                                          }`}>
                                            {numVal}%
                                          </span>
                                        </td>
                                      );
                                    })}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>

                      {/* AI Executive Report Generator Panel */}
                      <div className="border-2 border-blue-200 bg-gradient-to-r from-blue-50/60 to-indigo-50/60 rounded-2xl p-6 shadow-xs relative overflow-hidden">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-5 pb-4 border-b border-blue-100">
                          <div className="flex items-center gap-2.5">
                            <div className="bg-blue-600/10 p-2.5 rounded-xl text-blue-700 shadow-xs shrink-0">
                              <Sparkles className="h-5 w-5 text-blue-600 animate-pulse" />
                            </div>
                            <div>
                              <h3 className="text-base font-black text-blue-950 uppercase tracking-wide">AI Multi-Test Trend & Executive Report</h3>
                              <p className="text-xs text-slate-600 mt-0.5">
                                Automatically synthesize spatial drift, camera elevation impacts, and generate calibrated QA guides across all {selectedCompRuns.length} selected runs.
                              </p>
                            </div>
                          </div>
                          {!compareReport && !isGeneratingReport && (
                            <button
                              onClick={generateComparisonReport}
                              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center gap-2 transition-all cursor-pointer shadow-sm hover:scale-[1.02]"
                            >
                              <Sparkles className="h-4 w-4" /> Synthesize AI Report
                            </button>
                          )}
                        </div>

                        {isGeneratingReport && (
                          <div className="p-8 flex flex-col items-center justify-center text-center space-y-4 bg-white/60 rounded-xl border border-blue-100/40">
                            <Loader className="h-8 w-8 text-blue-600 animate-spin" />
                            <div>
                              <p className="font-extrabold text-sm text-blue-950 animate-pulse">Consulting Gemini AI Analyst Engine...</p>
                              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                                Modeling Z-axis camera elevation skews, compiling dimensional drift matrices, and synthesizing tactical physical mounting remediation strategies.
                              </p>
                            </div>
                          </div>
                        )}

                        {reportError && (
                          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-start gap-2">
                            <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
                            <div>
                              <span className="font-bold">Failed to Generate Report:</span> {reportError}
                              <button
                                onClick={generateComparisonReport}
                                className="mt-2 block bg-rose-600 hover:bg-rose-700 text-white font-bold px-3 py-1.5 rounded-lg text-[10px] cursor-pointer"
                              >
                                Retry Analysis
                              </button>
                            </div>
                          </div>
                        )}

                        {compareReport && !isGeneratingReport && (
                          <div className="bg-white p-6 rounded-xl border border-blue-100/50 shadow-sm space-y-4">
                            {/* Actions panel */}
                            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                              <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                Verified Gemini Comparative Audit Log
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={copyToClipboard}
                                  className="p-2 text-slate-500 hover:text-blue-600 hover:bg-slate-50 rounded-lg border border-slate-100 transition-all flex items-center gap-1.5 text-xs font-bold bg-white cursor-pointer"
                                  title="Copy Report"
                                >
                                  {isCopied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                                  {isCopied ? 'Copied' : 'Copy'}
                                </button>
                                <button
                                  onClick={downloadReportTxt}
                                  className="p-2 text-slate-500 hover:text-blue-600 hover:bg-slate-50 rounded-lg border border-slate-100 transition-all flex items-center gap-1.5 text-xs font-bold bg-white cursor-pointer"
                                  title="Download Report"
                                >
                                  <Upload className="h-3.5 w-3.5 rotate-180" /> Download Txt
                                </button>
                                <button
                                  onClick={generateComparisonReport}
                                  className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg border border-blue-100 transition-all flex items-center gap-1.5 text-xs font-bold bg-white cursor-pointer"
                                >
                                  <Sparkles className="h-3.5 w-3.5" /> Regenerate
                                </button>
                              </div>
                            </div>

                            {/* Report render */}
                            <div className="max-h-[350px] overflow-y-auto pr-1">
                              <SimpleMarkdownRenderer content={compareReport} />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* VIEW 2: Existing Pairwise side-by-side comparison */}
              {compSubTab === 'pairwise' && (
                <div className="space-y-6 animate-fade-in">
                  <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row items-center gap-4">
                    <div className="flex items-center gap-2">
                      <label className="font-bold text-slate-700 text-sm">Test Run A:</label>
                      <select 
                        value={compTestAId}
                        onChange={(e) => setCompTestAId(e.target.value)}
                        className="bg-slate-50 border border-slate-300 text-sm rounded-xl p-3 min-w-[200px] font-medium cursor-pointer"
                      >
                        {appState.tests.map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    </div>
                    <span className="text-slate-400 font-extrabold px-3 text-sm">VS</span>
                    <div className="flex items-center gap-2">
                      <label className="font-bold text-slate-700 text-sm">Test Run B:</label>
                      <select 
                        value={compTestBId}
                        onChange={(e) => setCompTestBId(e.target.value)}
                        className="bg-slate-50 border border-slate-300 text-sm rounded-xl p-3 min-w-[200px] font-medium cursor-pointer"
                      >
                        {appState.tests.map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {testA && testB ? (
                    <div className="space-y-6">
                      {/* Contrast insights card */}
                      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                        <h3 className="text-xl font-bold text-slate-900 mb-2 flex items-center gap-2">
                          <GitCompare className="h-6 w-6 text-blue-600" /> Comprehensive Analysis: Test A vs Test B
                        </h3>
                        <p className="text-sm text-slate-500 mb-6">
                          Comparing <span className="font-semibold text-slate-800">[{testA.timestamp}]</span> vs <span className="font-semibold text-slate-800">[{testB.timestamp}]</span>
                        </p>

                        {/* Camera delta baseline metrics */}
                        {testA.cameraHeight && testB.cameraHeight && compHtDetailsA && compHtDetailsB && (
                          <div className="bg-indigo-950 text-white rounded-2xl p-6 shadow-md border border-indigo-900 mb-6">
                            <div className="flex items-center gap-2 mb-4">
                              <Sliders className="h-5 w-5 text-indigo-300" />
                              <h4 className="font-extrabold text-sm uppercase tracking-wider text-indigo-100 font-sans">Mounting Height vs Z-Axis Error Delta Audit Matrix</h4>
                            </div>
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-center">
                              <div className="bg-indigo-900/40 p-4 rounded-xl border border-indigo-800 flex flex-col justify-center items-center shadow-xs">
                                <span className="text-[10px] text-indigo-300 font-extrabold uppercase block tracking-wider mb-1">Physical Mounting Shift</span>
                                <span className="text-xl font-black">{compHtDetailsA.feet} ft &rarr; {compHtDetailsB.feet} ft</span>
                                <span className="text-[10px] text-indigo-200/60 mt-1">
                                  Delta Shift: {compHtDetailsB.inches - compHtDetailsA.inches > 0 ? '+' : ''}{(compHtDetailsB.inches - compHtDetailsA.inches).toFixed(1)}"
                                </span>
                              </div>
                              
                              <div className="bg-indigo-900/40 p-4 rounded-xl border border-indigo-800 flex flex-col justify-center items-center shadow-xs">
                                <span className="text-[10px] text-indigo-300 font-extrabold uppercase block tracking-wider mb-1">Vertical Z-Axis Error Shift</span>
                                <span className={`text-xl font-black ${testB.analysis.dimAvgs.Height <= testA.analysis.dimAvgs.Height ? 'text-emerald-400' : 'text-rose-400'}`}>
                                  {testA.analysis.dimAvgs.Height}% &rarr; {testB.analysis.dimAvgs.Height}%
                                </span>
                                <span className="text-[10px] text-indigo-200/60 mt-1">
                                  Performance Shift: {(testB.analysis.dimAvgs.Height - testA.analysis.dimAvgs.Height) > 0 ? '+' : ''}{(testB.analysis.dimAvgs.Height - testA.analysis.dimAvgs.Height).toFixed(2)}%
                                </span>
                              </div>

                              <div className="text-left text-xs text-indigo-200 leading-relaxed flex flex-col justify-center">
                                <strong className="text-white block mb-1">Mounting Physics Insight:</strong>
                                <p className="mb-1 animate-fade-in">
                                  {compHtDetailsA.inches <= 24 && compHtDetailsB.inches > 24 ? (
                                    "Test A utilized a critically low elevation which suffered heavily from wide-angle perspective distortions. Raising the mounting baseline in Test B flattened the camera's visual planes, dramatically stabilizing dimensional calculations."
                                  ) : (
                                    "Baseline overhead elevations are active. Changes in vertical height reflect range-sensor stability."
                                  )}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        <p className="text-slate-700 leading-relaxed mb-6 text-base">
                          Moving from <strong>{testA.name}</strong> to <strong>{testB.name}</strong>, the overall average error{' '}
                          {compDiffOverall <= 0 ? (
                            <span className="text-emerald-600 font-bold inline-flex items-center gap-1"><TrendingDown className="h-4 w-4" /> improved by {Math.abs(compDiffOverall)}%</span>
                          ) : (
                            <span className="text-rose-600 font-bold inline-flex items-center gap-1"><TrendingUp className="h-4 w-4" /> worsened by {compDiffOverall}%</span>
                          )} (from {testA.analysis.overallAvg}% to {testB.analysis.overallAvg}%).
                        </p>

                        <h4 className="font-bold text-slate-700 text-sm uppercase mb-3">Dimension Shifts</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center mb-6">
                          <div className="p-4 border border-slate-100 rounded-xl bg-slate-50">
                            <p className="text-xs font-bold text-slate-400 uppercase mb-1">Length Error</p>
                            <p className={`text-lg font-bold ${testB.analysis.dimAvgs.Length <= testA.analysis.dimAvgs.Length ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {testA.analysis.dimAvgs.Length}% &rarr; {testB.analysis.dimAvgs.Length}%
                            </p>
                          </div>
                          <div className="p-4 border border-slate-100 rounded-xl bg-slate-50">
                            <p className="text-xs font-bold text-slate-400 uppercase mb-1">Width Error</p>
                            <p className={`text-lg font-bold ${testB.analysis.dimAvgs.Width <= testA.analysis.dimAvgs.Width ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {testA.analysis.dimAvgs.Width}% &rarr; {testB.analysis.dimAvgs.Width}%
                            </p>
                          </div>
                          <div className="p-4 border border-slate-100 rounded-xl bg-slate-50">
                            <p className="text-xs font-bold text-slate-400 uppercase mb-1">Height Error</p>
                            <p className={`text-lg font-bold ${testB.analysis.dimAvgs.Height <= testA.analysis.dimAvgs.Height ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {testA.analysis.dimAvgs.Height}% &rarr; {testB.analysis.dimAvgs.Height}%
                            </p>
                          </div>
                        </div>

                        <h4 className="font-bold text-slate-700 text-sm uppercase mb-3">Box Type Shifts</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center mb-2 animate-fade-in">
                          {Array.from(new Set([...Object.keys(testA.analysis.boxAvgs), ...Object.keys(testB.analysis.boxAvgs)])).map(box => {
                            const valA = testA.analysis.boxAvgs[box] || 0;
                            const valB = testB.analysis.boxAvgs[box] || 0;
                            return (
                              <div key={box} className="p-4 border border-slate-100 rounded-xl bg-slate-50">
                                <p className="text-xs font-bold text-slate-400 uppercase mb-1">{box}</p>
                                <p className={`text-lg font-extrabold ${valB <= valA ? 'text-emerald-600' : 'text-rose-600'}`}>
                                  {valA}% &rarr; {valB}%
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Comparison Charts */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in">
                        <div className="border border-slate-200 bg-white p-6 rounded-2xl shadow-sm flex flex-col min-h-[350px]">
                          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-6 text-center">Dimension Error Comparison</h3>
                          <div className="flex-1 w-full min-h-[250px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={compDimChartData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" stroke="#94a3b8" />
                                <YAxis stroke="#94a3b8" unit="%" />
                                <Tooltip formatter={(v) => [`${v}%`]} />
                                <Legend />
                                <Bar dataKey={testA.name} fill="#94a3b8" radius={[4, 4, 0, 0]} />
                                <Bar dataKey={testB.name} fill="#3b82f6" radius={[4, 4, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>

                        <div className="border border-slate-200 bg-white p-6 rounded-2xl shadow-sm flex flex-col min-h-[350px]">
                          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-6 text-center">Box Error Comparison</h3>
                          <div className="flex-1 w-full min-h-[250px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={compBoxChartData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" stroke="#94a3b8" />
                                <YAxis stroke="#94a3b8" unit="%" />
                                <Tooltip formatter={(v) => [`${v}%`]} />
                                <Legend />
                                <Bar dataKey={testA.name} fill="#94a3b8" radius={[4, 4, 0, 0]} />
                                <Bar dataKey={testB.name} fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-8 text-center text-slate-500 bg-white rounded-2xl shadow-sm border border-slate-200">
                      Select valid comparison runs.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: All Raw Data */}
          {activeTab === 'raw-data' && (
            <div className="space-y-6 animate-fade-in">
              {appState.tests.length === 0 ? (
                <div className="p-8 text-center text-slate-500 bg-white rounded-2xl shadow-sm border border-slate-200">
                  No testing datasets are currently saved.
                </div>
              ) : (
                appState.tests.map(test => (
                  <div key={test.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-8">
                    <div className="p-5 border-b border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                      <div>
                        <h3 className="font-extrabold text-slate-900 text-lg">{test.name}</h3>
                        <p className="text-xs text-slate-500 font-bold mt-1">
                          Uploaded: {test.timestamp} {test.cameraHeight && `| Elevation Baseline: ${test.cameraHeight}`}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {test.sourceImage && (
                          <button 
                            onClick={() => setViewingImageTest(test)}
                            className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-3.5 py-2.5 rounded-xl flex items-center gap-2 transition-all border border-blue-100 bg-white text-xs font-bold shadow-sm cursor-pointer"
                          >
                            <ImageIcon className="h-4 w-4" /> View Screenshot
                          </button>
                        )}
                        <button 
                          onClick={() => handleDeleteTest(test.id)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 px-3.5 py-2.5 rounded-xl flex items-center gap-2 transition-all border border-red-100 bg-white text-xs font-bold shadow-sm cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" /> Delete Test
                        </button>
                      </div>
                    </div>

                    <div className="overflow-x-auto max-h-[450px]">
                      <table className="w-full text-left border-collapse relative min-w-[800px]">
                        <thead className="sticky top-0 bg-slate-100 z-10 shadow-xs">
                          <tr className="text-slate-500 text-xs uppercase tracking-wider font-bold">
                            <th className="p-4 border-b border-slate-200">Box Type</th>
                            <th className="p-4 border-b border-slate-200">Dimension</th>
                            <th className="p-4 border-b border-slate-200">Actual (in)</th>
                            <th className="p-4 border-b border-slate-200">App (in)</th>
                            <th className="p-4 border-b border-slate-200">% Error</th>
                            <th className="p-4 border-b border-slate-200">Inch Diff</th>
                          </tr>
                        </thead>
                        <tbody className="text-slate-700 text-sm font-medium">
                          {test.data.map((row, idx) => {
                            const errorStatus = checkError(row.error);
                            const diffStatus = checkDiff(row.diff);
                            return (
                              <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50/55 transition-colors">
                                <td className="p-4">{row.box} <span className="text-slate-400 text-xs font-normal">({row.weight})</span></td>
                                <td className="p-4 font-bold text-slate-800">{row.dim}</td>
                                <td className="p-4">{row.actual}</td>
                                <td className="p-4">{row.app}</td>
                                <td className="p-4">
                                  <div className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-bold ${errorStatus === 'Pass' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                                    {row.error.toFixed(2)}%
                                  </div>
                                </td>
                                <td className="p-4">
                                  <div className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-bold ${diffStatus === 'Pass' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                                    {row.diff > 0 ? `+${row.diff}` : row.diff}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="p-5 bg-slate-50/60 border-t border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-5">
                      <table className="w-full text-center text-sm border-collapse bg-white shadow-sm rounded-xl overflow-hidden border border-slate-200">
                        <thead className="bg-slate-100 text-xs uppercase font-bold text-slate-600">
                          <tr><th colSpan={3} className="p-2 border-b border-slate-200">Average Per Dimension</th></tr>
                          <tr>
                            <th className="p-2 border-r border-slate-200 w-1/3">Length</th>
                            <th className="p-2 border-r border-slate-200 w-1/3">Width</th>
                            <th className="p-2 w-1/3">Height</th>
                          </tr>
                        </thead>
                        <tbody className="font-bold">
                          <tr>
                            <td className={`p-2 border-r border-slate-200 ${checkAvg(test.analysis.dimAvgs.Length) === 'Pass' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>{test.analysis.dimAvgs.Length}%</td>
                            <td className={`p-2 border-r border-slate-200 ${checkAvg(test.analysis.dimAvgs.Width) === 'Pass' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>{test.analysis.dimAvgs.Width}%</td>
                            <td className={`p-2 ${checkAvg(test.analysis.dimAvgs.Height) === 'Pass' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>{test.analysis.dimAvgs.Height}%</td>
                          </tr>
                        </tbody>
                      </table>

                      <table className="w-full text-center text-sm border-collapse bg-white shadow-sm rounded-xl overflow-hidden border border-slate-200">
                        <thead className="bg-slate-100 text-xs uppercase font-bold text-slate-600">
                          <tr><th colSpan={Object.keys(test.analysis.boxAvgs).length} className="p-2 border-b border-slate-200">Average Per Box</th></tr>
                          <tr>
                            {Object.keys(test.analysis.boxAvgs).map((b, i, arr) => (
                              <th key={b} className={`p-2 ${i !== arr.length - 1 ? 'border-r' : ''} border-slate-200`}>{b}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="font-bold">
                          <tr>
                            {Object.entries(test.analysis.boxAvgs).map(([b, val], i, arr) => (
                              <td key={b} className={`p-2 ${i !== arr.length - 1 ? 'border-r' : ''} border-slate-200 ${checkAvg(val as number) === 'Pass' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>{val as number}%</td>
                            ))}
                          </tr>
                        </tbody>
                      </table>

                      <table className="w-full text-center text-sm border-collapse bg-white shadow-sm rounded-xl overflow-hidden border border-slate-200 text-center font-sans">
                        <thead className="bg-slate-100 text-xs uppercase font-bold text-slate-600">
                          <tr><th className="p-2 border-b border-slate-200">Overall Average</th></tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className={`p-2.5 text-base font-extrabold ${checkAvg(test.analysis.overallAvg) === 'Pass' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>{test.analysis.overallAvg}%</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Upload Modal Dialog */}
      {isUploadOpen && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border border-slate-100 animate-fade-in">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-slate-900">Upload Depth Test Results</h2>
              <button 
                onClick={() => {
                  setIsUploadOpen(false);
                  setUploadFile(null);
                  setUploadName('');
                }} 
                className="text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 p-1.5 rounded-lg cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Test Name (e.g., Daily Run v1.2)</label>
                <input 
                  type="text" 
                  value={uploadName}
                  onChange={(e) => setUploadName(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl p-3 text-sm font-medium focus:ring-blue-500 focus:border-blue-500 transition-all" 
                  placeholder="Enter a name for this test run"
                />
              </div>
              
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Image or CSV File</label>
                <div className="flex items-center justify-center w-full">
                  <label className="flex flex-col items-center justify-center w-full h-36 border-2 border-slate-300 border-dashed rounded-xl cursor-pointer bg-slate-50 hover:bg-slate-100/80 transition-all hover:border-blue-400">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center px-4">
                      <Upload className="w-8 h-8 mb-3 text-blue-500" />
                      <p className="mb-1 text-sm text-slate-600"><span className="font-bold">Upload Screenshot</span>, Paste (Ctrl+V), or CSV</p>
                      <p className="text-xs text-slate-400">AI automatically processes table rows from images.</p>
                    </div>
                    <input 
                      type="file" 
                      accept=".csv, image/png, image/jpeg, image/jpg" 
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        if (file) {
                          setUploadFile(file);
                          if (!uploadName) {
                            setUploadName(file.name.replace(/\.[^/.]+$/, ""));
                          }
                        }
                      }}
                      className="hidden" 
                    />
                  </label>
                </div>

                {uploadFile && (
                  <div className="mt-3 p-3 bg-blue-50 border border-blue-100 rounded-xl flex justify-between items-center shadow-xs">
                    <span className="text-sm text-blue-700 font-bold truncate">Selected: {uploadFile.name}</span>
                    <button 
                      onClick={() => {
                        setUploadFile(null);
                        setUploadName('');
                      }} 
                      className="text-blue-400 hover:text-blue-600 transition-colors" 
                      title="Remove file"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                )}
              </div>

              <div className="pt-5 border-t border-slate-100 flex justify-end gap-3 text-sm">
                <button 
                  onClick={() => {
                    setIsUploadOpen(false);
                    setUploadFile(null);
                    setUploadName('');
                  }} 
                  className="px-4 py-2.5 font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  onClick={processUpload} 
                  disabled={isProcessing}
                  className="px-5 py-2.5 font-bold bg-blue-600 text-white hover:bg-blue-700 rounded-xl transition-colors shadow-sm min-w-[130px] flex justify-center items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isProcessing ? (
                    <>
                      <Loader className="h-4 w-4 animate-spin" /> Processing...
                    </>
                  ) : (
                    "Process & Save"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Image Viewer Dialog */}
      {viewingImageTest && viewingImageTest.sourceImage && (
        <div className="fixed inset-0 bg-slate-900/80 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col max-h-[90vh] overflow-hidden border border-slate-100 animate-fade-in">
            <div className="flex justify-between items-center p-5 border-b border-slate-200 shrink-0 bg-slate-50">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <ImageIcon className="h-6 w-6 text-blue-600" /> Original Uploaded Source ({viewingImageTest.name})
              </h2>
              <button 
                onClick={() => setViewingImageTest(null)} 
                className="text-slate-400 hover:text-slate-600 bg-slate-200 hover:bg-slate-300 p-2 rounded-xl transition-all cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 overflow-auto flex-1 bg-slate-100 flex justify-center items-start">
              <img 
                src={viewingImageTest.sourceImage} 
                className="max-w-full h-auto rounded-xl shadow-md border border-slate-300" 
                alt="Original Upload" 
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );

  function switchTab(tab: TabType) {
    setActiveTab(tab);
  }
}
