import ws from "k6/ws";
import { check, sleep } from "k6";
import { Counter, Trend } from "k6/metrics";

const sessions = Number(__ENV.SESSIONS ?? 500);
const duration = __ENV.DURATION ?? "5m";
const gatewayUrl = __ENV.GATEWAY_URL ?? "wss://api.example.com/ws/device";
const deviceId = __ENV.DEVICE_ID ?? "load-device";
const deviceToken = __ENV.DEVICE_TOKEN;
const voiceTurnRate = Number(__ENV.VOICE_TURN_RATE ?? 0.02);

const turnLatency = new Trend("voice_turn_latency_ms");
const failedTurns = new Counter("voice_turn_failures");

export const options = {
  scenarios: {
    sessions: {
      executor: "constant-vus",
      vus: sessions,
      duration,
    },
  },
  thresholds: {
    voice_turn_latency_ms: ["p(95)<3000"],
    voice_turn_failures: ["count<10"],
  },
};

export default function () {
  if (!deviceToken) {
    throw new Error("DEVICE_TOKEN is required");
  }

  const started = Date.now();
  const result = ws.connect(`${gatewayUrl}?deviceId=${deviceId}`, {}, socket => {
    socket.on("open", () => {
      socket.send(JSON.stringify({ type: "hello", token: deviceToken }));
      socket.setInterval(() => {
        socket.send(JSON.stringify({ type: "ping", at: Date.now() }));
      }, 20000);

      if (Math.random() < voiceTurnRate) {
        const turnStarted = Date.now();
        socket.send(
          JSON.stringify({
            type: "audio.start",
            turnId: `${__VU}-${Date.now()}`,
            sampleRate: 16000,
          })
        );
        socket.send(
          JSON.stringify({
            type: "audio.end",
            turnId: `${__VU}-${Date.now()}-end`,
          })
        );
        socket.on("message", message => {
          try {
            const parsed = JSON.parse(message);
            if (parsed.type === "assistant.delta" || parsed.type === "audio.chunk") {
              turnLatency.add(Date.now() - turnStarted);
            }
            if (parsed.type === "error") {
              failedTurns.add(1);
            }
          } catch {
            // Ignore non-JSON frames.
          }
        });
      }
    });

    socket.on("error", () => failedTurns.add(1));
    socket.setTimeout(() => socket.close(), 5000);
  });

  check(result, { "websocket connected": r => r && r.status === 101 });
  sleep(Math.max(1, (Date.now() - started) / 1000));
}
