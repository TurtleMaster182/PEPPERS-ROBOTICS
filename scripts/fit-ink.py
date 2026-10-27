#!/usr/bin/env python3
"""Fit published Cambridge free-plume measurements (numpy/scipy required).
Usage: python scripts/fit-ink.py /tmp/Free_plume_data.zip
Archive: https://doi.org/10.17863/CAM.44080 (CC BY 4.0).
The website has no dependency on Python or the raw data archive.
"""
import hashlib
import json
import sys
from io import BytesIO
from pathlib import Path
from zipfile import ZipFile
import numpy as np
from scipy.io import loadmat

def calibrate(source):
    """Use all five Eulerian experiments; widths are Gaussian W² moments."""
    samples, horizontal = [], []
    eta = np.linspace(-3, 3, 61)
    with ZipFile(source) as archive:
        for experiment in range(1, 6):
            name = f"data{experiment}_Eulerian.mat"
            data = loadmat(BytesIO(archive.read(name)))
            x, z = data["x"].ravel(), data["z"].ravel()
            for row in range(len(z)):
                W = np.maximum(data["W"][row].astype(float), 0)
                weight = W ** 2
                center = np.sum(x * weight) / weight.sum()
                width = np.sqrt(2 * np.sum(weight * (x - center) ** 2) / weight.sum())
                core = W > .4 * W.max()
                # Normalize fluctuations by the centerline velocity, not local W.
                samples.append([experiment, z[row], center, width, W.max(),
                                np.sqrt(np.mean(data["u"][row][core] ** 2)) / W.max(),
                                np.sqrt(np.mean(data["w"][row][core] ** 2)) / W.max()])
                horizontal.append(np.interp(eta, (x - center) / width, data["U"][row] / W.max()))
    rows = np.array(samples)
    width_slope, width_intercept = np.polyfit(rows[:, 1], rows[:, 3], 1)
    center_slope = float(np.polyfit(rows[:, 1], rows[:, 2], 1)[0])
    predicted = width_intercept + width_slope * rows[:, 1]
    result = {
        "source": "https://doi.org/10.17863/CAM.44080",
        "archive_sha256": hashlib.sha256(Path(source).read_bytes()).hexdigest(),
        "license": "CC BY 4.0",
        "authors": "David Parker, Henry Burridge, Jamie Partridge, Paul Linden",
        "selection": "data1_Eulerian.mat through data5_Eulerian.mat; all 134 height rows",
        "units": "coordinates and width: cm; velocity: cm/s; rms ratios: dimensionless",
        "width_definition": "sqrt(2 * sum(W^2 * (x-center)^2) / sum(W^2)); center weighted by W^2",
        "fit": {
            "width_intercept_cm": float(width_intercept), "width_slope": float(width_slope),
            "center_drift_slope": center_slope, "mean_speed_cm_s": float(rows[:, 4].mean()),
            "horizontal_rms_ratio": float(rows[:, 5].mean()),
            "vertical_rms_ratio": float(rows[:, 6].mean()), "measured_height_cm": float(rows[:, 1].max()),
            "width_relative_rmse": float(np.sqrt(np.mean(((predicted - rows[:, 3]) / rows[:, 3]) ** 2))),
        },
        "horizontal_profile": {"eta": eta.tolist(), "U_over_W0": np.mean(horizontal, axis=0).tolist()},
        # A compact measured profile allows the fit to be inspected without Matlab.
        "measured_profiles": [dict(zip(["experiment", "z_cm", "center_cm", "width_cm", "W0_cm_s", "u_rms_over_W0", "w_rms_over_W0"], row.tolist()))
                              for row in rows[::13]],
    }
    return result


if __name__ == "__main__":
    result = calibrate(sys.argv[1])
    output = Path(__file__).resolve().parent / "data/plume-calibration.json"
    output.write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps(result["fit"], indent=2))
