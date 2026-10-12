# Ultrasonic Echo-Quality Classifier

Project contributors: **Anupreeya and Arya Shahi**.

An HC-SR04 / ESP32 experiment with a browser dashboard and a **10-tree Random Forest**. Each session contains 30 readings. The dashboard predicts Clean, Clutter, or Weak signal, displays session readings, and supports labeled live checks, confusion matrices, CSV imports, and browser-local retraining.

## Training targets

The forest learns the recorded condition labels: Clean, Clutter, and Weak signal. Clutter can alternate between several object distances within one session, regardless of total distance range. Range, valid-return fraction, distance statistics, temporal jumps, and mean/maximum consecutive differences are input features. There is no threshold-based relabeling or live prediction override.

## Hardware and recording

Connect TRIG to ESP32 GPIO 5 and ECHO to GPIO 18, with common ground. A typical HC-SR04 ECHO is 5 V: use a suitable voltage divider or level shifter for the ESP32 input. Upload `ultrasonic_sensor/ultrasonic_sensor.ino` using Arduino IDE. It sends continuous sessions at 115200 baud. Close Serial Monitor before recording or using the website.

```powershell
python -m pip install -r requirements.txt
python record_csv.py --port COM3 --label clean
python record_csv.py --port COM3 --label clutter
python record_csv.py --port COM3 --label weak_signal
```

Arrange each condition before recording, then press RESET/EN when prompted. The recorder saves 30 complete sessions of 30 readings per condition. Existing recordings are protected; move them to a backup before recording again.

## Website

Live dashboard: https://anupreeya24.github.io/ultrasonic-echo-quality-classifier/

The complete static website is in `docs/`. To run locally from the repository root:

```powershell
python -m http.server 8765 --directory docs
```

Open `http://localhost:8765` in desktop Chrome or Edge. Connect the ESP32, choose its serial port (for example COM3), and press RESET/EN once. Live predictions update after each complete session. Sensor recordings, labels, and rebuilt models are saved only in the browser. Export a notebook backup before changing browsers or website addresses.

### Publish on GitHub Pages

After pushing this repository, open **Settings → Pages → Build and deployment → Source → GitHub Actions**. Run the **Deploy website** workflow if it has not already completed. The workflow publishes `docs/` on the repository's GitHub Pages URL. Open the HTTPS URL in desktop Chrome or Edge to use USB serial. GitHub Pages serves the browser code; it does not require a Python server.

## Google Colab

Upload `Ultrasonic_10_Tree_Random_Forest.ipynb` to Google Colab, run it, and select the three original CSVs in `data/`. The notebook trains a scikit-learn Random Forest with `n_estimators=10`, evaluates complete held-out sessions, plots its confusion matrix and feature importances, and downloads its model and results.

The browser uses its own JavaScript forest implementation. Colab uses scikit-learn. Both use 10 trees and the same features and target definitions, but predictions need not match exactly. The notebook does not automatically replace the browser model.

## Validation and limitations

The included dataset has 90 recorded sessions (2,700 readings), with 30 sessions per collected condition. The model uses 45 recorded sessions for training and 45 for testing, including 15 test sessions per class. No generated examples are used. Predictions can be wrong; the confusion matrix reports real held-out counts. Sessions from the same recording can be similar, so use separate live tests and varied recording runs for stronger validation. HC-SR04 measures echo timing, not echo amplitude.

To rebuild the browser baseline and check inference with Node.js:

```powershell
node build_rule_model.mjs
node check-pattern-forest.mjs
node check-live.mjs
```

