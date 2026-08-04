import { QARun, CalibrationRun } from "../types";

export const initialQARuns: QARun[] = [
  {
    id: "seeded_run_1",
    name: "SALI Kiosk 1 Booking Terminal 1",
    data: [
      { uid: 0, id: "TC-SID-11", testCase: "Sender Input Details", scenario: "User inputs 'Los Angeles'", expected: "App displays dropdown matches...", status: "Passed" },
      { uid: 1, id: "TC-SID-12", testCase: "Sender Input Details", scenario: "User clicks correct address from dropdown", expected: "App populates street address...", status: "Passed" },
      { uid: 2, id: "TC-SID-13", testCase: "Sender Input Details", scenario: "User uses Up/Down Arrow keys and Enter", expected: "App highlights recommendations as expected", status: "Pending" },
      { uid: 3, id: "TC-SID-14", testCase: "Sender Input Details", scenario: "User clicks 'X' button to empty field", expected: "App closes dropdown and wipes input value", status: "Pending" },
      { uid: 4, id: "TC-SID-15", testCase: "Sender Input Details", scenario: "User types extremely fast", expected: "API calls are throttled cleanly", status: "Passed" },
      { uid: 5, id: "TC-SID-16", testCase: "Sender Input Details", scenario: "User clicks 'Override Manual' button", expected: "Inputs become editable fields immediately", status: "Passed" },
      { uid: 6, id: "TC-SID-17", testCase: "Sender Input Details", scenario: "User clicks 'CASS VALIDATE' button", expected: "CASS validation standardizes address", status: "Passed" }
    ]
  }
];

export const initialCalibrationRuns: CalibrationRun[] = [
  {
    id: "seeded_cal_1",
    name: "Close Kiosk Mounting Cal",
    timestamp: "7/10/2026 11:15 AM",
    cameraHeight: "24 in",
    data: [
      { box: "1st Box", weight: "12 lbs", dim: "Length", actual: 12.0, app: 11.5, diff: 0.5, error: 4.17 },
      { box: "1st Box", weight: "12 lbs", dim: "Width", actual: 12.0, app: 11.8, diff: 0.2, error: 1.67 },
      { box: "1st Box", weight: "12 lbs", dim: "Height", actual: 12.0, app: 11.1, diff: 0.9, error: 7.5 },
      { box: "2nd Box", weight: "24 lbs", dim: "Length", actual: 24.0, app: 23.2, diff: 0.8, error: 3.33 },
      { box: "2nd Box", weight: "24 lbs", dim: "Width", actual: 24.0, app: 23.6, diff: 0.4, error: 1.67 },
      { box: "2nd Box", weight: "24 lbs", dim: "Height", actual: 24.0, app: 21.8, diff: 2.2, error: 9.17 },
      { box: "3rd Box", weight: "36 lbs", dim: "Length", actual: 36.0, app: 35.1, diff: 0.9, error: 2.5 },
      { box: "3rd Box", weight: "36 lbs", dim: "Width", actual: 36.0, app: 35.5, diff: 0.5, error: 1.39 },
      { box: "3rd Box", weight: "36 lbs", dim: "Height", actual: 36.0, app: 32.2, diff: 3.8, error: 10.56 }
    ],
    sourceImage: null,
    analysis: {
      overallAvg: 4.99,
      dimAvgs: { Length: 3.33, Width: 1.58, Height: 9.08 },
      boxAvgs: { "1st Box": 4.45, "2nd Box": 4.72, "3rd Box": 4.82 }
    }
  },
  {
    id: "seeded_cal_2",
    name: "Overhead 5ft Mounting Cal",
    timestamp: "7/17/2026 10:15 AM",
    cameraHeight: "60 in",
    data: [
      { box: "1st Box", weight: "12 lbs", dim: "Length", actual: 12.0, app: 11.9, diff: 0.1, error: 0.83 },
      { box: "1st Box", weight: "12 lbs", dim: "Width", actual: 12.0, app: 11.8, diff: 0.2, error: 1.67 },
      { box: "1st Box", weight: "12 lbs", dim: "Height", actual: 12.0, app: 11.6, diff: 0.4, error: 3.33 },
      { box: "2nd Box", weight: "24 lbs", dim: "Length", actual: 24.0, app: 23.8, diff: 0.2, error: 0.83 },
      { box: "2nd Box", weight: "24 lbs", dim: "Width", actual: 24.0, app: 23.9, diff: 0.1, error: 0.42 },
      { box: "2nd Box", weight: "24 lbs", dim: "Height", actual: 24.0, app: 22.9, diff: 1.1, error: 4.58 },
      { box: "3rd Box", weight: "36 lbs", dim: "Length", actual: 36.0, app: 35.6, diff: 0.4, error: 1.11 },
      { box: "3rd Box", weight: "36 lbs", dim: "Width", actual: 36.0, app: 35.8, diff: 0.2, error: 0.56 },
      { box: "3rd Box", weight: "36 lbs", dim: "Height", actual: 36.0, app: 34.1, diff: 1.9, error: 5.28 }
    ],
    sourceImage: null,
    analysis: {
      overallAvg: 2.07,
      dimAvgs: { Length: 0.92, Width: 0.88, Height: 4.40 },
      boxAvgs: { "1st Box": 1.94, "2nd Box": 1.94, "3rd Box": 2.32 }
    }
  }
];
