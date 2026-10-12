import argparse
import csv
import math
import time
from datetime import datetime
from pathlib import Path

import serial

TOTAL_SESSIONS = 30
READINGS_PER_SESSION = 30

ROOT = Path(__file__).resolve().parent

HEADER = [
    "session_id",
    "reading_index",
    "echo_duration_us",
    "distance_cm",
    "valid_echo",
    "label",
]


def parse_reading(line):
    parts = line.split(",")

    if len(parts) != 5 or not parts[0].startswith("live_"):
        return None

    try:
        session = int(parts[0][5:])
        index = int(parts[1])
        duration = int(parts[2])
        distance = float(parts[3])
        valid = int(parts[4])
    except ValueError:
        return None

    if (
        session < 1
        or not 0 <= index < READINGS_PER_SESSION
        or duration < 0
        or not math.isfinite(distance)
        or distance < 0
        or valid not in (0, 1)
    ):
        return None

    return session, index, duration, distance, valid


def main():
    parser = argparse.ArgumentParser(
        description="Record 30 complete ultrasonic sessions."
    )
    parser.add_argument("--port", required=True)
    parser.add_argument(
        "--label",
        required=True,
        choices=["clean", "clutter", "weak_signal"],
    )
    args = parser.parse_args()

    folder = ROOT / "data"
    folder.mkdir(exist_ok=True)

    path = folder / f"{args.label}.csv"
    run_id = datetime.now().strftime("%Y%m%d_%H%M%S")

    if path.exists():
        raise FileExistsError(
            f"{path} already exists. Rename it before recording."
        )

    with serial.Serial(
        args.port, 115200, timeout=1
    ) as connection:
        connection.reset_input_buffer()

        with path.open(
            "x", newline="", encoding="utf-8"
        ) as output:
            writer = csv.writer(output)
            writer.writerow(HEADER)
            output.flush()

            print(
                "Press ESP32 RESET/EN once now.",
                flush=True,
            )
            print(
                "Waiting for session 1, reading 0...",
                flush=True,
            )

            started = False
            saved_sessions = 0
            current_session = None
            readings = {}
            invalid_session = False
            buffer = bytearray()
            last_received = time.monotonic()

            while saved_sessions < TOTAL_SESSIONS:
                # Keep partial serial lines until their newline arrives.
                chunk = connection.read(
                    max(1, connection.in_waiting)
                )

                if chunk:
                    buffer.extend(chunk)

                if time.monotonic() - last_received > 120:
                    raise TimeoutError(
                        f"No valid readings for 120 seconds. "
                        f"Saved {saved_sessions} complete sessions "
                        f"in {path}"
                    )

                while b"\n" in buffer:
                    raw_line, _, remainder = buffer.partition(b"\n")
                    buffer = bytearray(remainder)

                    line = raw_line.decode(
                        "utf-8", errors="replace"
                    ).strip()

                    if not line:
                        continue

                    reading = parse_reading(line)

                    if reading is None:
                        if started:
                            invalid_session = True
                            print(
                                f"Ignoring unreadable line: {line!r}",
                                flush=True,
                            )
                        continue

                    session, index, duration, distance, valid = reading
                    last_received = time.monotonic()

                    if not started:
                        if (session, index) != (1, 0):
                            continue
                        started = True
                        current_session = session

                    if session != current_session:
                        if session < current_session:
                            raise RuntimeError(
                                "The board restarted during recording. "
                                "Back up the partial CSV and start again."
                            )

                        if len(readings) != READINGS_PER_SESSION:
                            print(
                                f"Skipped incomplete board session "
                                f"{current_session}; collecting a replacement.",
                                flush=True,
                            )

                        current_session = session
                        readings = {}
                        invalid_session = False

                    if index in readings:
                        invalid_session = True

                    readings[index] = [
                        index,
                        duration,
                        distance,
                        valid,
                    ]

                    # Save only when the entire session is available.
                    if index == READINGS_PER_SESSION - 1:
                        complete = (
                            not invalid_session
                            and set(readings)
                            == set(range(READINGS_PER_SESSION))
                        )

                        if complete:
                            saved_sessions += 1
                            session_id = (
                                f"{args.label}_{run_id}_"
                                f"{saved_sessions}"
                            )

                            for i in range(READINGS_PER_SESSION):
                                writer.writerow([
                                    session_id,
                                    *readings[i],
                                    args.label,
                                ])

                            output.flush()

                            print(
                                f"Recorded session "
                                f"{saved_sessions}/{TOTAL_SESSIONS}",
                                flush=True,
                            )
                        else:
                            print(
                                f"Board session {session} is incomplete; "
                                "it will not be saved.",
                                flush=True,
                            )

                        if saved_sessions == TOTAL_SESSIONS:
                            break

    print(
        f"Saved {TOTAL_SESSIONS * READINGS_PER_SESSION} "
        f"readings to {path}"
    )


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print(
            "\nRecording stopped. Any completed sessions "
            "remain in the CSV."
        )