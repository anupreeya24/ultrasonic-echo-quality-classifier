#define TRIG_PIN 5
#define ECHO_PIN 18

const int READINGS_PER_SESSION = 30;
const unsigned long ECHO_TIMEOUT_US = 30000;

unsigned long sessionNumber = 0;

void setup() {
  Serial.begin(115200);

  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);

  digitalWrite(TRIG_PIN, LOW);
  delay(1500);

  Serial.println(
    "session_id,reading_index,echo_duration_us,distance_cm,valid_echo"
  );
}

void loop() {
  sessionNumber++;

  for (int i = 0; i < READINGS_PER_SESSION; i++) {
    digitalWrite(TRIG_PIN, LOW);
    delayMicroseconds(2);

    digitalWrite(TRIG_PIN, HIGH);
    delayMicroseconds(10);

    digitalWrite(TRIG_PIN, LOW);

    unsigned long duration =
      pulseIn(ECHO_PIN, HIGH, ECHO_TIMEOUT_US);

    int valid = duration > 0 ? 1 : 0;

    float distance = valid
      ? duration * 0.0343 / 2.0
      : 0.0;

    Serial.print("live_");
    Serial.print(sessionNumber);
    Serial.print(",");

    Serial.print(i);
    Serial.print(",");

    Serial.print(duration);
    Serial.print(",");

    Serial.print(distance, 2);
    Serial.print(",");

    Serial.println(valid);

    delay(100);
  }

  Serial.println();
  delay(1000);
}