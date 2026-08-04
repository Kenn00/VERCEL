---
name: depth-calibration-qa
description: Skill and operational procedures for 3D depth camera spatial calibration analysis, Z-axis elevation evaluation, multi-run trend diagnostics, and Gemini AI report synthesis for SALI.
---

# SALI 3D Depth Camera Spatial Calibration & QA Skill

This skill defines the analytical protocols, domain rules, and AI synthesis pipelines for the **SALI (Spatial Analytics & Linear Measurement Intelligence)** Pre-Production Verification Terminal.

---

## 1. Core Domain Principles & Metrics

When analyzing depth camera test datasets, evaluate performance using these standardized calibration standards:

### Performance Thresholds
- **Production Grade (< 5.0% Overall Error)**: System meets target specifications for automated spatial volume measurement in warehouse/kiosk deployment.
- **Marginal Drift (5.0% - 10.0% Error)**: Acceptable for non-critical packaging, but requires zero-point camera recalibration or lighting environment checks.
- **Needs Calibration (> 10.0% Error)**: High risk of volumetric skew. Requires physical hardware adjustment, focal lens inspection, or camera elevation tweak.

### Dimensional Error Formula
For each box measurement run:
$$\text{Error \%} = \frac{|\text{Measured Dim} - \text{Ground Truth Dim}|}{\text{Ground Truth Dim}} \times 100$$

### Z-Axis Elevation & Camera Height Impact
- **Low Mounting Elevation ($\le$ 24 inches / 2.0 ft)**: Prone to wide-angle perspective distortions, edge-clipping, and severe Z-axis height errors on tall packages.
- **Standard Overhead Elevation (> 24 to 36 inches / 2.0 - 3.0 ft)**: Optimal balance for small to medium packaging volumes.
- **High Overhead Elevation (> 36 inches / > 3.0 ft)**: Flattens visual focal planes; stabilizes vertical measurement, but requires high depth-sensor resolution for shallow boxes.

---

## 2. Multi-Run Analysis & Trend Matrix

When comparing multiple calibration test runs:

1. **Chronological Tracking**: Track overall error trends over time to detect hardware degradation, thermal camera drift, or mounting shift.
2. **Dimension Skew Identification**: Isolate whether **Length**, **Width**, or **Height** consistently exhibits the highest average percentage error.
3. **Box-Type Variance**: Identify specific box form factors (e.g., small cubes vs flat polybags) that trigger spatial detection outliers.

---

## 3. Gemini API Integration Protocol

All Gemini AI text generation and report synthesis **MUST** run server-side via Express endpoints in `server.ts`:

- **Single Run Endpoint**: `POST /api/generate-qa-report`
- **Multi-Run Comparison Endpoint**: `POST /api/generate-compare-report`

### Server Prompt Best Practices
- Structure report outputs into clear markdown sections:
  1. **Executive Summary & Quality Score**
  2. **Multi-Run Trend Analysis & Drift Detection**
  3. **Systemic Bottlenecks & Anomaly Detection**
  4. **Strategic Remediation Action Plan**
- Ensure strictly professional, objective, and non-cluttered copy suitable for packaging operations executives.
