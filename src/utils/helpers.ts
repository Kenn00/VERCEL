import { DimensionRow, CalibrationAnalysis, TestCaseItem } from "../types";

export const checkError = (val: number): "Pass" | "Fail" => (val < 5 ? "Pass" : "Fail");
export const checkDiff = (val: number): "Pass" | "Fail" => (Math.abs(val) <= 0.4 ? "Pass" : "Fail");
export const checkAvg = (val: number): "Pass" | "Fail" => (val < 10 ? "Pass" : "Fail");

export function cleanNumber(val: any): number {
  if (val === undefined || val === null || val === "") return NaN;
  const cleaned = val.toString().replace(/[^0-9.-]/g, "");
  if (cleaned === "" || cleaned === "-" || cleaned === ".") return NaN;
  return parseFloat(cleaned);
}

export function average(values: number[]): number {
  if (!values || values.length === 0) return 0;
  const valid = values.filter((v) => typeof v === "number" && !isNaN(v));
  if (valid.length === 0) return 0;
  const sum = valid.reduce((acc, val) => acc + val, 0);
  return parseFloat((sum / valid.length).toFixed(2));
}

export function analyzeTestData(
  dataRows: DimensionRow[],
  overrideSummary?: Partial<CalibrationAnalysis>
): CalibrationAnalysis {
  const lengthErrors = dataRows.filter((r) => r.dim === "Length").map((r) => r.error);
  const widthErrors = dataRows.filter((r) => r.dim === "Width").map((r) => r.error);
  const heightErrors = dataRows.filter((r) => r.dim === "Height").map((r) => r.error);

  const dimAvgs = {
    Length: overrideSummary?.dimAvgs?.Length !== undefined
      ? overrideSummary.dimAvgs.Length
      : average(lengthErrors),
    Width: overrideSummary?.dimAvgs?.Width !== undefined
      ? overrideSummary.dimAvgs.Width
      : average(widthErrors),
    Height: overrideSummary?.dimAvgs?.Height !== undefined
      ? overrideSummary.dimAvgs.Height
      : average(heightErrors),
  };

  const boxNames = Array.from(new Set(dataRows.map((r) => r.box)));
  const boxAvgs: Record<string, number> = {};

  boxNames.forEach((box) => {
    if (overrideSummary?.boxAvgs?.[box] !== undefined) {
      boxAvgs[box] = overrideSummary.boxAvgs[box];
    } else {
      const boxErrors = dataRows.filter((r) => r.box === box).map((r) => r.error);
      boxAvgs[box] = average(boxErrors);
    }
  });

  let overallAvg = 0;
  if (overrideSummary?.overallAvg !== undefined) {
    overallAvg = overrideSummary.overallAvg;
  } else {
    // Spreadsheet formula: =AVERAGE(F23, F26, F29, F32) — average of the box averages
    const boxAvgList = Object.values(boxAvgs);
    if (boxAvgList.length > 0) {
      overallAvg = average(boxAvgList);
    } else {
      overallAvg = average([dimAvgs.Length, dimAvgs.Width, dimAvgs.Height]);
    }
  }

  return {
    overallAvg,
    dimAvgs,
    boxAvgs,
  };
}

export function parseCSVText(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      currentCell += '"';
      i++;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        i++;
      }
      currentRow.push(currentCell.trim());
      rows.push(currentRow);
      currentRow = [];
      currentCell = "";
    } else {
      currentCell += char;
    }
  }

  if (currentCell || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    rows.push(currentRow);
  }

  return rows.filter((r) => r.length > 0 && r.some((c) => c !== ""));
}

export function getVal(row: any, matches: string[]): string {
  if (!row || typeof row !== "object") return "";
  const keys = Object.keys(row);
  for (const m of matches) {
    const targetKey = keys.find(
      (k) => k.toLowerCase().replace(/\s/g, "") === m.toLowerCase().replace(/\s/g, "")
    );
    if (targetKey) return String(row[targetKey]);
  }
  return "";
}

export function parsePastedSpreadsheetText(text: string): string[][] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  return lines.map((line) => {
    if (line.includes("\t")) {
      return line.split("\t").map((cell) => cell.trim().replace(/^["']|["']$/g, ""));
    } else {
      return line.split(",").map((cell) => cell.trim().replace(/^["']|["']$/g, ""));
    }
  });
}

export function getMountingHeightCategory(heightStr: string | null) {
  if (!heightStr) {
    return {
      inches: 80,
      feet: 6.67,
      category: "Standard Overhead Mounting (> 4.0ft)",
      desc: "No physical height specified. Standard overhead range coordinates are assumed.",
      physicalImpact: "Using standard camera height values by default.",
    };
  }

  const clean = heightStr.toString().toLowerCase().trim();
  const num = parseFloat(clean.replace(/[^0-9.]/g, ""));
  if (isNaN(num)) {
    return {
      inches: 80,
      feet: 6.67,
      category: "Standard Overhead Mounting (> 4.0ft)",
      desc: "Assuming standard baseline.",
      physicalImpact: "Unknown camera height scale. Baseline models loaded.",
    };
  }

  let inches = num;
  if (clean.includes("ft") || clean.includes("foot") || clean.includes("feet") || num < 10) {
    inches = num * 12;
  }

  const feet = inches / 12;
  let category = "Unknown";
  let desc = "";
  let physicalImpact = "";

  if (inches <= 24) {
    category = "Critically Low Close-Up Mounting (1.0ft - 2.0ft)";
    desc = `The camera is placed extremely close (${feet.toFixed(1)}ft) to the scale platform. This low clearance triggers severe perspective lens parallax. Tall package profiles will obstruct the lens FOV, stretch out Length/Width margins, and cause heavy Z-axis (Height) compression.`;
    physicalImpact = "High perspective parallax error; suggest deploying lens checkerboard correction grids or raising the frame.";
  } else if (inches <= 48) {
    category = "Moderate/Mid-Range Mounting (2.0ft - 4.0ft)";
    desc = `The camera is located at a mid-range baseline (${feet.toFixed(1)}ft). Perspective parallax is moderately reduced, but packages must remain dead-center on the scale to avoid progressive radial stretching near lens boundaries.`;
    physicalImpact = "Optimal for kiosk cabinets, but susceptible to edge-of-frame distortion if package alignment drifts.";
  } else {
    category = "Standard Overhead Mounting (> 4.0ft)";
    desc = `The camera operates from a far overhead mounting elevation (${feet.toFixed(1)}ft). Parallax stretching is minimal, making Length/Width tracking exceptionally stable. However, vertical depth sensors can experience range signal baseline noise at this distance.`;
    physicalImpact = "Extremely stable planar measurements, but susceptible to minor vertical Z-axis drift due to sensor range limits.";
  }

  return {
    inches: parseFloat(inches.toFixed(1)),
    feet: parseFloat(feet.toFixed(2)),
    category,
    desc,
    physicalImpact,
  };
}
