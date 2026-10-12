# Ultrasonic Echo-Quality Classifier

An HC-SR04 / ESP32 experiment with a browser dashboard and a **10-tree Random Forest**. Each session contains 30 readings. The dashboard predicts Clean, Clutter, or Weak signal, displays session readings, and supports labeled live checks, confusion matrices, CSV imports, and browser-local retraining.

## Training targets

The session range is the maximum minus minimum valid distance:

| Range | Target |
|---|---|
| Below 1 cm | Clean |
| 1 cm to below 10 cm | Clutter |
| 10 cm or more | Weak signal |

Sessions with no valid echoes have the Weak signal target. The ranges label training examples; live inference uses the Random Forest. Features include valid-return fraction, distance statistics, session range, and a temporal jump feature.

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

The included dataset has 90 recorded sessions (2,700 readings). The browser baseline uses 45 recorded sessions plus 400 generated training examples; the other 45 recorded sessions form its test set. Generated examples are excluded from reported test scores. The score measures agreement with range-derived labels, not independent verification of physical echo quality. The recorded data contains no Clutter sessions under these range definitions, so recorded-data performance for Clutter is untested. Record varied conditions in independent runs for stronger validation. HC-SR04 measurements provide echo timing, not echo amplitude.

To rebuild the browser baseline and check inference with Node.js:

```powershell
node build_rule_model.mjs
node check-pattern-forest.mjs
node check-live.mjs
```
