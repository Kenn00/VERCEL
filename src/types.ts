/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface TestCaseItem {
  uid: number;
  id: string;
  testCase: string;
  scenario: string;
  expected: string;
  status: 'Passed' | 'Failed' | 'Pending';
}

export interface QARun {
  id: string;
  name: string;
  data: TestCaseItem[];
}

export interface DimensionRow {
  box: string;
  weight: string;
  dim: 'Length' | 'Width' | 'Height';
  actual: number;
  app: number;
  diff: number;
  error: number;
}

export interface CalibrationAnalysis {
  overallAvg: number;
  dimAvgs: {
    Length: number;
    Width: number;
    Height: number;
  };
  boxAvgs: Record<string, number>;
}

export interface CalibrationRun {
  id: string;
  name: string;
  timestamp: string;
  cameraHeight: string | null;
  data: DimensionRow[];
  sourceImage: string | null;
  analysis: CalibrationAnalysis;
}
