/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from "react";
import { 
  QARun, 
  TestCaseItem 
} from "../types";
import { 
  getVal, 
  parseCSVText, 
  parsePastedSpreadsheetText 
} from "../utils/helpers";
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip 
} from "recharts";
import { 
  Download, 
  FileSpreadsheet, 
  FolderOpen, 
  CheckCircle, 
  XCircle, 
  Loader, 
  Percent, 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  Info, 
  ShieldAlert, 
  Sparkles,
  Edit,
  Trash2,
  Plus
} from "lucide-react";
import * as XLSX from "xlsx";

interface QARunnerProps {
  qaState: { runs: QARun[]; activeRunId: string | null };
  setQAState: React.Dispatch<React.SetStateAction<{ runs: QARun[]; activeRunId: string | null }>>;
  onShowAlert: (title: string, message: string, isError?: boolean) => void;
  onShowConfirm: (title: string, message: string, onConfirm: () => void) => void;
}

export default function QARunner({ qaState, setQAState, onShowAlert, onShowConfirm }: QARunnerProps) {
  const [activeStatusFilter, setActiveStatusFilter] = useState<'all' | 'passed' | 'failed' | 'pending'>('all');
  const [activeSearchQuery, setActiveSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Selected QA Item for detailed editing modal
  const [editingItem, setEditingItem] = useState<TestCaseItem | null>(null);

  // Add Test Case Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newItemData, setNewItemData] = useState<{
    id: string;
    testCase: string;
    scenario: string;
    expected: string;
    status: 'Passed' | 'Failed' | 'Pending';
  }>({
    id: '',
    testCase: '',
    scenario: '',
    expected: '',
    status: 'Pending'
  });

  // Open Add Test Case Modal
  const handleOpenAddModal = () => {
    const nextNum = masterData.length + 1;
    const defaultId = `TC-${String(nextNum).padStart(3, '0')}`;
    setNewItemData({
      id: defaultId,
      testCase: '',
      scenario: '',
      expected: '',
      status: 'Pending'
    });
    setIsAddModalOpen(true);
  };

  // Save new test case
  const handleSaveNewItem = () => {
    if (!newItemData.id.trim()) {
      onShowAlert("Validation Error", "Please enter a Test ID#.", true);
      return;
    }
    if (!newItemData.testCase.trim()) {
      onShowAlert("Validation Error", "Please enter a Test Case name.", true);
      return;
    }

    const newItem: TestCaseItem = {
      uid: Date.now(),
      id: newItemData.id.trim(),
      testCase: newItemData.testCase.trim(),
      scenario: newItemData.scenario.trim(),
      expected: newItemData.expected.trim(),
      status: newItemData.status
    };

    if (qaState.runs.length === 0 || !qaState.activeRunId) {
      const runId = 'qa_run_' + Date.now();
      setQAState({
        runs: [{ id: runId, name: 'SALI Booking Terminal 1', data: [newItem] }],
        activeRunId: runId
      });
    } else {
      setQAState(prev => {
        const runsCopy = prev.runs.map(run => {
          if (run.id === prev.activeRunId) {
            return {
              ...run,
              data: [...run.data, newItem]
            };
          }
          return run;
        });
        return { ...prev, runs: runsCopy };
      });
    }

    setIsAddModalOpen(false);
    onShowAlert("Test Case Created", `Successfully added "${newItem.id}: ${newItem.testCase}" to the active run.`);
  };

  // Delete individual test case item
  const handleDeleteItem = (uid: number, event?: React.MouseEvent) => {
    if (event) event.stopPropagation();
    onShowConfirm(
      "Delete Test Case?",
      "Are you sure you want to permanently delete this test case from the current run?",
      () => {
        setQAState(prev => {
          const runsCopy = prev.runs.map(run => {
            if (run.id === prev.activeRunId) {
              return {
                ...run,
                data: run.data.filter(item => item.uid !== uid)
              };
            }
            return run;
          });
          return { ...prev, runs: runsCopy };
        });
        if (editingItem?.uid === uid) {
          setEditingItem(null);
        }
      }
    );
  };

  // Active run data
  const activeRun = useMemo(() => {
    return qaState.runs.find(r => r.id === qaState.activeRunId) || null;
  }, [qaState]);

  const masterData = useMemo(() => {
    return activeRun ? activeRun.data : [];
  }, [activeRun]);

  // Handle spreadsheet selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
  };

  const processFile = (file: File) => {
    const cleanName = file.name.replace(/\.[^/.]+$/, "");

    if (file.name.endsWith('.csv')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const text = event.target?.result as string;
          const rows = parseCSVText(text);
          if (rows.length < 2) throw new Error("CSV has no data rows.");
          
          const headers = rows[0].map(h => h.trim());
          const dataRows = rows.slice(1);
          
          const parsedData = dataRows.map((row, index) => {
            const rowObj: Record<string, string> = {};
            headers.forEach((header, colIndex) => {
              rowObj[header] = row[colIndex] || '';
            });
            
            const parsedStatus = String(getVal(rowObj, ['Status']) || 'Pending').trim().toLowerCase();
            let standardStatus: 'Passed' | 'Failed' | 'Pending' = 'Pending';
            if (parsedStatus.includes('pass')) standardStatus = 'Passed';
            if (parsedStatus.includes('fail')) standardStatus = 'Failed';

            return {
              uid: index,
              id: getVal(rowObj, ['Test ID#', 'Test ID', 'ID']),
              testCase: getVal(rowObj, ['Test Case', 'TestCase']),
              scenario: getVal(rowObj, ['Scenario', 'Test Scenario']),
              expected: getVal(rowObj, ['Expected Results', 'Expected Result', 'Expected']),
              status: standardStatus
            };
          }).filter(item => item.id || item.testCase || item.scenario);

          const runId = 'qa_run_' + Date.now();
          setQAState(prev => ({
            runs: [...prev.runs, { id: runId, name: cleanName, data: parsedData }],
            activeRunId: runId
          }));
        } catch (err) {
          console.error(err);
          onShowAlert("Spreadsheet Error", "Failed to parse the uploaded CSV. Please make sure it is valid.", true);
        }
      };
      reader.readAsText(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.SheetNames[0];
        const rawRows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet]);
        
        const parsedData = rawRows.map((row: any, index: number) => {
          const parsedStatus = String(getVal(row, ['Status']) || 'Pending').trim().toLowerCase();
          let standardStatus: 'Passed' | 'Failed' | 'Pending' = 'Pending';
          if (parsedStatus.includes('pass')) standardStatus = 'Passed';
          if (parsedStatus.includes('fail')) standardStatus = 'Failed';

          return {
            uid: index, 
            id: getVal(row, ['Test ID#', 'Test ID', 'ID']),
            testCase: getVal(row, ['Test Case', 'TestCase']),
            scenario: getVal(row, ['Scenario', 'Test Scenario']),
            expected: getVal(row, ['Expected Results', 'Expected Result', 'Expected']),
            status: standardStatus
          };
        }).filter(item => item.id || item.testCase || item.scenario);

        const runId = 'qa_run_' + Date.now();
        setQAState(prev => ({
          runs: [...prev.runs, { id: runId, name: cleanName, data: parsedData }],
          activeRunId: runId
        }));
      } catch (err) {
        console.error(err);
        onShowAlert("Spreadsheet Error", "Failed to parse the uploaded Excel spreadsheet.", true);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Keyboard / Paste tracking for tabular grid sync
  const handleContainerPaste = (e: React.ClipboardEvent) => {
    // Stop if actively writing in an input/textarea
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return; 
    }

    const pastedText = e.clipboardData.getData('text/plain');
    if (pastedText && pastedText.trim().length > 0) {
      try {
        const rows = parsePastedSpreadsheetText(pastedText);
        if (rows.length >= 2) {
          const parsedData = rows.map((row, index) => {
            const parsedStatus = String(row[4] || 'Pending').trim().toLowerCase();
            let standardStatus: 'Passed' | 'Failed' | 'Pending' = 'Pending';
            if (parsedStatus.includes('pass')) standardStatus = 'Passed';
            if (parsedStatus.includes('fail')) standardStatus = 'Failed';

            return {
              uid: index, 
              id: row[0] || `TC-${index + 1}`,
              testCase: row[1] || 'Uncategorized',
              scenario: row[2] || '',
              expected: row[3] || '',
              status: standardStatus
            };
          }).filter(item => item.id || item.testCase || item.scenario);

          if (parsedData.length > 0) {
            const runName = `Clipboard Sync [${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}]`;
            const runId = 'qa_run_' + Date.now();
            setQAState(prev => ({
              runs: [...prev.runs, { id: runId, name: runName, data: parsedData }],
              activeRunId: runId
            }));
            onShowAlert("Clipboard Synced", `Loaded "${runName}" with ${parsedData.length} cases!`);
          }
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Switch Active Run
  const selectRun = (runId: string) => {
    setQAState(prev => ({ ...prev, activeRunId: runId }));
    setCurrentPage(1);
    setActiveStatusFilter('all');
    setActiveSearchQuery('');
  };

  // Remove Active Run
  const deleteRun = (runId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    const runToDelete = qaState.runs.find(r => r.id === runId);
    if (!runToDelete) return;

    onShowConfirm(
      "Delete QA Test Run?",
      `Are you sure you want to completely delete "${runToDelete.name}" from this session?`,
      () => {
        setQAState(prev => {
          const remaining = prev.runs.filter(r => r.id !== runId);
          let nextActive = prev.activeRunId;
          if (prev.activeRunId === runId) {
            nextActive = remaining.length > 0 ? remaining[0].id : null;
          }
          return { runs: remaining, activeRunId: nextActive };
        });
      }
    );
  };

  // Metrics
  const metrics = useMemo(() => {
    let passed = 0;
    let failed = 0;
    let pending = 0;
    masterData.forEach(item => {
      if (item.status === 'Passed') passed++;
      else if (item.status === 'Failed') failed++;
      else pending++;
    });
    const total = masterData.length;
    const successRate = total > 0 ? Math.round((passed / total) * 100) : 0;
    return { passed, failed, pending, total, successRate };
  }, [masterData]);

  // Chart Data
  const pieChartData = useMemo(() => {
    return [
      { name: 'Passed', value: metrics.passed, color: '#10b981' },
      { name: 'Failed', value: metrics.failed, color: '#ef4444' },
      { name: 'Pending', value: metrics.pending, color: '#f59e0b' }
    ].filter(d => d.value > 0);
  }, [metrics]);

  // Categories Breakdown
  const categoriesBreakdown = useMemo(() => {
    const counts: Record<string, { total: number; passed: number; failed: number; pending: number }> = {};
    masterData.forEach(item => {
      const cat = item.testCase || "Uncategorized Workflows";
      if (!counts[cat]) {
        counts[cat] = { total: 0, passed: 0, failed: 0, pending: 0 };
      }
      counts[cat].total++;
      if (item.status === 'Passed') counts[cat].passed++;
      else if (item.status === 'Failed') counts[cat].failed++;
      else counts[cat].pending++;
    });

    let fragileCatName = "None";
    let fragilePassRate = 100;
    let robustCatName = "None";
    let robustPassRate = -1;

    Object.entries(counts).forEach(([name, countsObj]) => {
      const rate = (countsObj.passed / countsObj.total) * 100;
      if (countsObj.failed > 0 && rate < fragilePassRate) {
        fragilePassRate = rate;
        fragileCatName = name;
      }
      if (rate > robustPassRate) {
        robustPassRate = rate;
        robustCatName = name;
      }
    });

    return { counts, fragileCatName, fragilePassRate, robustCatName, robustPassRate };
  }, [masterData]);

  // Filter & Search Table Rows
  const filteredRows = useMemo(() => {
    return masterData.filter(item => {
      const matchState = activeStatusFilter === 'all' || item.status.toLowerCase() === activeStatusFilter;
      const searchableText = `${item.id} ${item.testCase} ${item.scenario} ${item.expected}`.toLowerCase();
      const matchSearch = searchableText.includes(activeSearchQuery.toLowerCase());
      return matchState && matchSearch;
    });
  }, [masterData, activeStatusFilter, activeSearchQuery]);

  // Paginated Rows
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredRows.slice(start, start + itemsPerPage);
  }, [filteredRows, currentPage]);

  const totalPages = Math.ceil(filteredRows.length / itemsPerPage) || 1;

  // Modify individual status in inline select
  const handleModifyStatus = (uid: number, nextStatus: 'Passed' | 'Failed' | 'Pending') => {
    setQAState(prev => {
      const runsCopy = prev.runs.map(run => {
        if (run.id === prev.activeRunId) {
          const dataCopy = run.data.map(item => {
            if (item.uid === uid) {
              return { ...item, status: nextStatus };
            }
            return item;
          });
          return { ...run, data: dataCopy };
        }
        return run;
      });
      return { ...prev, runs: runsCopy };
    });
  };

  // Modify item completely from the modal
  const handleSaveModalEdit = () => {
    if (!editingItem) return;
    if (!editingItem.id.trim()) {
      onShowAlert("Validation Error", "Test ID# cannot be empty.", true);
      return;
    }
    if (!editingItem.testCase.trim()) {
      onShowAlert("Validation Error", "Test Case name cannot be empty.", true);
      return;
    }

    setQAState(prev => {
      const runsCopy = prev.runs.map(run => {
        if (run.id === prev.activeRunId) {
          const dataCopy = run.data.map(item => {
            if (item.uid === editingItem.uid) {
              return { ...editingItem };
            }
            return item;
          });
          return { ...run, data: dataCopy };
        }
        return run;
      });
      return { ...prev, runs: runsCopy };
    });

    setEditingItem(null);
  };

  // Download active run CSV
  const downloadCSV = () => {
    if (!activeRun) return;
    const headers = ["Test ID#", "Test Case", "Scenario", "Expected Results", "Status"];
    const csvRows = [headers.join(",")];
    
    activeRun.data.forEach(item => {
      const row = [
        `"${(item.id || '').replace(/"/g, '""')}"`,
        `"${(item.testCase || '').replace(/"/g, '""')}"`,
        `"${(item.scenario || '').replace(/"/g, '""')}"`,
        `"${(item.expected || '').replace(/"/g, '""')}"`,
        `"${(item.status || '').replace(/"/g, '""')}"`
      ];
      csvRows.push(row.join(","));
    });

    const csvContent = "\uFEFF" + csvRows.join("\n"); 
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${activeRun.name}_updated.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8" onPaste={handleContainerPaste}>
      {/* Dropzone header */}
      <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="bg-blue-50 p-4 rounded-xl text-blue-600 shadow-inner border border-blue-100 flex items-center justify-center">
            <FileSpreadsheet className="h-6 w-6" />
          </div>
          <div>
            <span className="bg-emerald-50 text-emerald-800 text-xs font-semibold px-2 py-1 rounded-full border border-emerald-100 inline-flex items-center gap-1.5 mb-2">
              <span className="w-1.5 h-1.5 bg-emerald-600 rounded-full"></span> PRE-PRODUCTION STABLE
            </span>
            <h2 className="text-2xl font-bold text-slate-800">
              {activeRun ? activeRun.name : "SALI Booking Terminal 1"}
            </h2>
            <p className="text-slate-500 text-sm mt-0.5">Audit and verify step requirements dynamically across the Kiosk workflow</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full xl:w-auto">
          <button 
            onClick={handleOpenAddModal}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-5 py-3.5 rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer w-full sm:w-auto shrink-0"
          >
            <Plus className="h-4 w-4" /> Add Test Case
          </button>

          <div className="border-2 border-dashed border-slate-200 hover:border-blue-500 bg-slate-50/50 hover:bg-blue-50/10 rounded-xl px-5 py-3 flex items-center gap-4 cursor-pointer transition-all max-w-md w-full relative">
            <input 
              type="file" 
              accept=".xlsx, .xls, .csv" 
              onChange={handleFileSelect}
              className="absolute inset-0 opacity-0 cursor-pointer" 
            />
            <div className="bg-blue-100 p-2.5 rounded-xl text-blue-600">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div className="text-left text-xs">
              <p className="font-bold text-slate-800 text-xs">Sync Excel Spreadsheet</p>
              <p className="text-slate-400 text-[11px]">Drag or click SALI Test Case.xlsx</p>
            </div>
          </div>
        </div>
      </div>

      {/* Empty state placeholder */}
      {qaState.runs.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center shadow-sm flex flex-col items-center justify-center min-h-[400px]">
          <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 text-3xl mb-4 shadow-inner">
            <Download className="h-10 w-10" />
          </div>
          <h3 className="text-xl font-bold text-slate-700 mb-1">No Test Spreadsheet Synced</h3>
          <p className="text-slate-400 text-sm max-w-sm mx-auto mb-6">
            Upload your spreadsheet featuring: Test ID#, Test Case, Scenario, Expected Results, and Status columns or create test cases manually.
          </p>
          <button 
            onClick={handleOpenAddModal}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-6 py-3 rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer"
          >
            <Plus className="h-4 w-4" /> Add First Test Case
          </button>
        </div>
      )}

      {/* Main active work area */}
      {qaState.runs.length > 0 && (
        <div className="space-y-8 animate-fade-in">
          {/* Tabs bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 flex-1">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 shrink-0">
                <FolderOpen className="h-4 w-4 text-blue-500" /> Active Test Runs:
              </span>
              <div className="flex flex-wrap items-center gap-2 w-full">
                {qaState.runs.map(run => {
                  const isActive = run.id === qaState.activeRunId;
                  return (
                    <div 
                      key={run.id}
                      className={`inline-flex items-center rounded-xl border p-1 transition-all ${
                        isActive ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-700'
                      }`}
                    >
                      <button 
                        onClick={() => selectRun(run.id)}
                        className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                          isActive ? 'text-white' : 'text-slate-700 hover:text-slate-950'
                        }`}
                      >
                        {run.name}
                      </button>
                      <button 
                        onClick={(e) => deleteRun(run.id, e)}
                        className={`p-1 text-xs rounded-lg transition-all ml-1 cursor-pointer flex items-center justify-center ${
                          isActive ? 'text-blue-100 hover:text-white hover:bg-blue-700' : 'text-slate-400 hover:text-red-600 hover:bg-slate-100'
                        }`}
                        title="Remove run"
                      >
                        <XCircle className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button 
                onClick={downloadCSV}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer w-full sm:w-auto"
              >
                <Download className="h-4 w-4" /> Export Run CSV
              </button>
            </div>
          </div>

          {/* KPI Dashboard */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm transition-all hover:shadow">
              <div className="flex justify-between items-center mb-3">
                <span className="text-slate-500 font-semibold text-sm">Total Test Cases</span>
                <span className="text-blue-500 bg-blue-50 w-8 h-8 rounded-lg flex items-center justify-center text-sm">
                  <FileSpreadsheet className="h-4 w-4" />
                </span>
              </div>
              <div className="text-4xl font-extrabold text-slate-800">{metrics.total}</div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm transition-all hover:shadow">
              <div className="flex justify-between items-center mb-3">
                <span className="text-slate-500 font-semibold text-sm">Passed</span>
                <span className="text-emerald-500 bg-emerald-50 w-8 h-8 rounded-lg flex items-center justify-center text-sm">
                  <CheckCircle className="h-4 w-4" />
                </span>
              </div>
              <div className="text-4xl font-extrabold text-emerald-600">{metrics.passed}</div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm transition-all hover:shadow">
              <div className="flex justify-between items-center mb-3">
                <span className="text-slate-500 font-semibold text-sm">Failed</span>
                <span className="text-rose-500 bg-rose-50 w-8 h-8 rounded-lg flex items-center justify-center text-sm">
                  <XCircle className="h-4 w-4" />
                </span>
              </div>
              <div className="text-4xl font-extrabold text-rose-600">{metrics.failed}</div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm transition-all hover:shadow">
              <div className="flex justify-between items-center mb-3">
                <span className="text-slate-500 font-semibold text-sm">Pending</span>
                <span className="text-amber-500 bg-amber-50 w-8 h-8 rounded-lg flex items-center justify-center text-sm">
                  <Loader className="h-4 w-4 animate-spin" />
                </span>
              </div>
              <div className="text-4xl font-extrabold text-amber-600">{metrics.pending}</div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm transition-all hover:shadow">
              <div className="flex justify-between items-center mb-3">
                <span className="text-slate-500 font-semibold text-sm">Success Rate</span>
                <span className="text-blue-500 bg-blue-50 w-8 h-8 rounded-lg flex items-center justify-center text-sm">
                  <Percent className="h-4 w-4" />
                </span>
              </div>
              <div className="text-4xl font-extrabold text-slate-800">{metrics.successRate}%</div>
            </div>
          </div>

          {/* Charts & Diagnostics Logs */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm lg:col-span-1 flex flex-col">
              <h4 className="text-slate-700 font-bold mb-4 text-sm uppercase tracking-wide">Execution Metric Breakdown</h4>
              <div className="w-full flex-1 min-h-[220px] max-h-[260px] flex items-center justify-center relative">
                {pieChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={65}
                        outerRadius={85}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {pieChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => [`${value} case(s)`, 'Count']} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <span className="text-slate-400 text-sm">No data</span>
                )}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl font-black text-slate-800">{metrics.successRate}%</span>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Success</span>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm lg:col-span-2 flex flex-col justify-between space-y-4">
              <div>
                <h4 className="text-slate-700 font-bold mb-4 text-sm uppercase tracking-wide">Audit Engine Diagnostic logs</h4>
                
                {/* Diagnostics summary block */}
                <div className="space-y-4">
                  <div className={`flex items-start gap-3 border p-4 rounded-xl text-xs ${
                    metrics.failed > 0 
                      ? 'bg-rose-50 border-rose-100 text-rose-800' 
                      : metrics.pending > 0 
                        ? 'bg-amber-50 border-amber-100 text-amber-800' 
                        : 'bg-emerald-50 border-emerald-100 text-emerald-800'
                  }`}>
                    {metrics.failed > 0 ? (
                      <ShieldAlert className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
                    ) : (
                      <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <strong className="font-bold text-sm block mb-1">Certification Health Diagnosis</strong>
                      <p className="font-medium">
                        {metrics.failed > 0 
                          ? `Unstable deployment registered. ${metrics.failed} core anomalies must be resolved prior to release code authorization.`
                          : metrics.pending > 0
                            ? `Audit pending. ${metrics.pending} verification tasks require status clearance before pipeline promotion.`
                            : "Optimal build quality detected. Highly suitable for production environment deployment."
                        }
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100/70 text-xs">
                      <strong className="text-blue-900 block uppercase tracking-wider mb-1.5 font-bold">Fragility Diagnostic</strong>
                      <p className="text-slate-600 leading-relaxed">
                        {categoriesBreakdown.fragileCatName !== "None" ? (
                          <>
                            Focus immediate code revision on the <strong className="text-slate-800">{categoriesBreakdown.fragileCatName}</strong> workflow steps. These calculations exhibit a dropped success rate of <span className="font-bold text-red-600">{categoriesBreakdown.fragilePassRate.toFixed(1)}%</span>.
                          </>
                        ) : (
                          "Maintain code isolation. All active system workflows successfully clear automated QA assertions."
                        )}
                      </p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
                      <strong className="text-slate-700 block uppercase tracking-wider mb-1.5 font-bold">Robustness Metric</strong>
                      <p className="text-slate-600 leading-relaxed">
                        {categoriesBreakdown.robustCatName !== "None" ? (
                          <>
                            The most robust component detected is <strong className="text-slate-800">{categoriesBreakdown.robustCatName}</strong> with a solid <span className="text-emerald-600 font-bold">{categoriesBreakdown.robustPassRate.toFixed(1)}%</span> clearance rate. This architecture exhibits excellent compliance.
                          </>
                        ) : (
                          "Ready for verification logging."
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-xs space-y-2">
                    <h5 className="font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4 text-blue-500" /> Next Strategic Target Actions:
                    </h5>
                    <ul className="list-disc pl-4 text-slate-600 space-y-1">
                      <li>Ensure Test IDs are synchronized with current API specs before exporting CSV.</li>
                      {metrics.failed > 0 && <li>Debug failed workflows immediately. Re-test once structural errors resolve.</li>}
                      {metrics.pending > 0 && <li>Cycle through the remaining {metrics.pending} pending steps to complete code coverage.</li>}
                      <li>Retain updated builds locally by utilizing the <strong>Export Run CSV</strong> engine.</li>
                    </ul>
                  </div>
                </div>
              </div>
              <div className="pt-4 border-t border-slate-100 flex items-center gap-2 text-xs text-slate-400">
                <Info className="h-3.5 w-3.5" /> Runs dynamically analyzed inside memory. State alterations saved per session.
              </div>
            </div>
          </div>

          {/* Table Area */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 flex-1">
                <h3 className="font-bold text-slate-800 text-lg whitespace-nowrap">Runner Target Executions</h3>
                
                <div className="flex bg-slate-200/60 p-1 rounded-xl items-center gap-1 text-xs">
                  {(['all', 'passed', 'failed', 'pending'] as const).map(key => (
                    <button 
                      key={key}
                      onClick={() => {
                        setActiveStatusFilter(key);
                        setCurrentPage(1);
                      }}
                      className={`px-4 py-2 font-bold rounded-lg transition-all cursor-pointer ${
                        activeStatusFilter === key 
                          ? 'bg-white text-slate-800 shadow-sm' 
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {key.charAt(0).toUpperCase() + key.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative max-w-sm w-full">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
                <input 
                  type="text" 
                  placeholder="Search test case, scenario or expected..." 
                  value={activeSearchQuery}
                  onChange={(e) => {
                    setActiveSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse min-w-[900px]">
                <thead>
                  <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-bold text-xs uppercase tracking-wider">
                    <th className="p-4 w-32 min-w-[100px]">Test ID#</th>
                    <th className="p-4 w-1/4 min-w-[200px]">Test Case</th>
                    <th className="p-4 w-1/4 min-w-[220px]">Scenario</th>
                    <th className="p-4 w-1/4 min-w-[220px]">Expected Results</th>
                    <th className="p-4 w-44 min-w-[150px]">Status</th>
                    <th className="p-4 w-24 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                  {paginatedRows.length > 0 ? (
                    paginatedRows.map((item) => {
                      const dynamicColorClasses = 
                        item.status === 'Passed' 
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700' 
                          : item.status === 'Failed' 
                            ? 'border-rose-200 bg-rose-50 text-rose-700' 
                            : 'border-amber-200 bg-amber-50 text-amber-800';

                      return (
                        <tr key={item.uid} className="hover:bg-slate-50/80 transition-all border-b border-slate-100 group">
                          <td 
                            className="p-4 font-mono font-bold text-xs text-slate-500 cursor-pointer group-hover:text-blue-600 transition-all" 
                            onClick={() => setEditingItem({ ...item })}
                          >
                            {item.id || '—'}
                          </td>
                          <td 
                            className="p-4 font-bold text-slate-900 cursor-pointer group-hover:text-blue-600 transition-all" 
                            onClick={() => setEditingItem({ ...item })}
                          >
                            {item.testCase || '—'}
                          </td>
                          <td 
                            className="p-4 text-xs text-slate-600 max-w-xs truncate cursor-pointer group-hover:text-blue-600 transition-all" 
                            title="Click to view details" 
                            onClick={() => setEditingItem({ ...item })}
                          >
                            {item.scenario || '—'}
                          </td>
                          <td 
                            className="p-4 text-xs text-slate-600 max-w-xs truncate cursor-pointer group-hover:text-blue-600 transition-all" 
                            title="Click to view details" 
                            onClick={() => setEditingItem({ ...item })}
                          >
                            {item.expected || '—'}
                          </td>
                          <td className="p-4">
                            <select 
                              value={item.status}
                              onChange={(e) => handleModifyStatus(item.uid, e.target.value as any)}
                              className={`text-xs rounded-xl border px-3 py-2 focus:outline-none w-full min-w-[120px] font-bold cursor-pointer transition-all ${dynamicColorClasses}`}
                            >
                              <option value="Passed">✓ Passed</option>
                              <option value="Failed">✗ Failed</option>
                              <option value="Pending">⟳ Pending</option>
                            </select>
                          </td>
                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button 
                                onClick={() => setEditingItem({ ...item })}
                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all cursor-pointer"
                                title="Edit test case"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                              <button 
                                onClick={(e) => handleDeleteItem(item.uid, e)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                                title="Delete test case"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400">
                        No matching runner records found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="p-5 border-t border-slate-100 bg-slate-50/30 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 font-semibold">
              <div>
                Showing {filteredRows.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} to {Math.min(currentPage * itemsPerPage, filteredRows.length)} of {filteredRows.length} items
              </div>
              <div className="flex items-center gap-2">
                <button 
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  className="px-4 py-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white cursor-pointer transition-colors font-bold shadow-sm flex items-center gap-1"
                >
                  <ChevronLeft className="h-3 w-3" /> Previous
                </button>
                <button 
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  className="px-4 py-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white cursor-pointer transition-colors font-bold shadow-sm flex items-center gap-1"
                >
                  Next <ChevronRight className="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Editor Modal */}
      {editingItem && (
        <div className="fixed inset-0 bg-slate-900/60 z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden border border-slate-100 animate-fade-in">
            <div className="flex justify-between items-center p-5 border-b border-slate-200 shrink-0 bg-slate-50">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Edit className="h-5 w-5 text-blue-600" /> Edit Test Case Details
              </h2>
              <button 
                onClick={() => setEditingItem(null)} 
                className="text-slate-400 hover:text-slate-600 bg-slate-200 hover:bg-slate-300 p-2 rounded-xl transition-all cursor-pointer"
              >
                <span className="sr-only">Close</span>
                &times;
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-6 text-left">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <span className="text-xs font-bold uppercase text-slate-400 tracking-wider">Test ID# (Editable)</span>
                  <input 
                    type="text" 
                    value={editingItem.id}
                    onChange={(e) => setEditingItem({ ...editingItem, id: e.target.value })}
                    className="w-full border border-slate-300 rounded-xl p-3 text-sm font-mono font-bold focus:ring-blue-500 focus:border-blue-500 transition-all bg-slate-50 text-slate-900 mt-1"
                  />
                </div>
                <div>
                  <span className="text-xs font-bold uppercase text-slate-400 tracking-wider">Status Calibration</span>
                  <div className="mt-1">
                    <select 
                      value={editingItem.status}
                      onChange={(e) => setEditingItem({ ...editingItem, status: e.target.value as any })}
                      className={`text-sm font-bold rounded-xl border p-3 focus:outline-none w-full cursor-pointer transition-all ${
                        editingItem.status === 'Passed' 
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700' 
                          : editingItem.status === 'Failed' 
                            ? 'border-rose-200 bg-rose-50 text-rose-700' 
                            : 'border-amber-200 bg-amber-50 text-amber-800'
                      }`}
                    >
                      <option value="Passed">✓ Passed</option>
                      <option value="Failed">✗ Failed</option>
                      <option value="Pending">⟳ Pending</option>
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <span className="text-xs font-bold uppercase text-slate-400 tracking-wider">Test Case Name</span>
                <input 
                  type="text" 
                  value={editingItem.testCase}
                  onChange={(e) => setEditingItem({ ...editingItem, testCase: e.target.value })}
                  className="w-full border border-slate-300 rounded-xl p-3 text-sm font-semibold focus:ring-blue-500 focus:border-blue-500 transition-all bg-slate-50 text-slate-900 mt-1"
                />
              </div>

              <div>
                <span className="text-xs font-bold uppercase text-slate-400 tracking-wider">Scenario / Steps</span>
                <textarea 
                  rows={4} 
                  value={editingItem.scenario}
                  onChange={(e) => setEditingItem({ ...editingItem, scenario: e.target.value })}
                  className="w-full border border-slate-300 rounded-xl p-3 text-sm focus:ring-blue-500 focus:border-blue-500 transition-all font-medium bg-slate-50 text-slate-700 mt-1 whitespace-pre-wrap leading-relaxed"
                />
              </div>

              <div>
                <span className="text-xs font-bold uppercase text-slate-400 tracking-wider">Expected Results</span>
                <textarea 
                  rows={4} 
                  value={editingItem.expected}
                  onChange={(e) => setEditingItem({ ...editingItem, expected: e.target.value })}
                  className="w-full border border-slate-300 rounded-xl p-3 text-sm focus:ring-blue-500 focus:border-blue-500 transition-all font-medium bg-slate-50 text-slate-700 mt-1 whitespace-pre-wrap leading-relaxed"
                />
              </div>
            </div>
            
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-between items-center gap-3">
              <button 
                onClick={downloadCSV}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm transition-colors cursor-pointer shadow-xs flex items-center gap-2"
              >
                <Download className="h-4 w-4" /> Download CSV
              </button>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setEditingItem(null)} 
                  className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-600 font-bold rounded-xl text-sm transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSaveModalEdit}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition-all cursor-pointer shadow-sm"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add New Test Case Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden border border-slate-100 animate-fade-in">
            <div className="flex justify-between items-center p-5 border-b border-slate-200 shrink-0 bg-slate-50">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Plus className="h-5 w-5 text-blue-600" /> Add New Test Case
              </h2>
              <button 
                onClick={() => setIsAddModalOpen(false)} 
                className="text-slate-400 hover:text-slate-600 bg-slate-200 hover:bg-slate-300 p-2 rounded-xl transition-all cursor-pointer"
              >
                <span className="sr-only">Close</span>
                &times;
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-6 text-left">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase text-slate-500 tracking-wider block mb-1">
                    Test ID # <span className="text-rose-500">*</span>
                  </label>
                  <input 
                    type="text" 
                    value={newItemData.id}
                    onChange={(e) => setNewItemData({ ...newItemData, id: e.target.value })}
                    placeholder="e.g. TC-001"
                    className="w-full border border-slate-300 rounded-xl p-3 text-sm font-mono font-bold focus:ring-blue-500 focus:border-blue-500 transition-all bg-slate-50 text-slate-900"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase text-slate-500 tracking-wider block mb-1">
                    Status
                  </label>
                  <select 
                    value={newItemData.status}
                    onChange={(e) => setNewItemData({ ...newItemData, status: e.target.value as any })}
                    className={`text-sm font-bold rounded-xl border p-3 focus:outline-none w-full cursor-pointer transition-all ${
                      newItemData.status === 'Passed' 
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700' 
                        : newItemData.status === 'Failed' 
                          ? 'border-rose-200 bg-rose-50 text-rose-700' 
                          : 'border-amber-200 bg-amber-50 text-amber-800'
                    }`}
                  >
                    <option value="Pending">⟳ Pending</option>
                    <option value="Passed">✓ Passed</option>
                    <option value="Failed">✗ Failed</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase text-slate-500 tracking-wider block mb-1">
                  Test Case Name <span className="text-rose-500">*</span>
                </label>
                <input 
                  type="text" 
                  value={newItemData.testCase}
                  onChange={(e) => setNewItemData({ ...newItemData, testCase: e.target.value })}
                  placeholder="e.g. Barcode Scanner Angle Test"
                  className="w-full border border-slate-300 rounded-xl p-3 text-sm font-semibold focus:ring-blue-500 focus:border-blue-500 transition-all bg-slate-50 text-slate-900"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase text-slate-500 tracking-wider block mb-1">
                  Scenario
                </label>
                <textarea 
                  rows={3} 
                  value={newItemData.scenario}
                  onChange={(e) => setNewItemData({ ...newItemData, scenario: e.target.value })}
                  placeholder="e.g. Scan damaged 2D barcode placed at 30-degree angle under ambient kiosk light..."
                  className="w-full border border-slate-300 rounded-xl p-3 text-sm focus:ring-blue-500 focus:border-blue-500 transition-all font-medium bg-slate-50 text-slate-700 whitespace-pre-wrap leading-relaxed"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase text-slate-500 tracking-wider block mb-1">
                  Expected Result
                </label>
                <textarea 
                  rows={3} 
                  value={newItemData.expected}
                  onChange={(e) => setNewItemData({ ...newItemData, expected: e.target.value })}
                  placeholder="e.g. System decodes payload within 200ms and pops confirmation toast without error..."
                  className="w-full border border-slate-300 rounded-xl p-3 text-sm focus:ring-blue-500 focus:border-blue-500 transition-all font-medium bg-slate-50 text-slate-700 whitespace-pre-wrap leading-relaxed"
                />
              </div>
            </div>
            
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end items-center gap-3">
              <button 
                onClick={() => setIsAddModalOpen(false)} 
                className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-600 font-bold rounded-xl text-sm transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveNewItem}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition-all cursor-pointer shadow-sm flex items-center gap-2"
              >
                <Plus className="h-4 w-4" /> Add Test Case
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
