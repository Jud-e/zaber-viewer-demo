import { useState, type FormEvent } from "react";
import "./App.css";

type ScanEvent =
  | { status: "moving"; target: number }
  | { status: "reached"; target: number; position: number }
  | { status: "failed"; target: number; lastConfirmedPosition?: number; message: string };

type ScanUpdate = ScanEvent | { status: "complete" } | { status: "error"; message: string };
type ScanState = "ready" | "running" | "complete" | "error";

const stateLabels = { ready: "Ready", running: "Scanning", complete: "Complete", error: "Error" };

export default function App() {
  const [input, setInput] = useState("5, 85, 15");
  const [plan, setPlan] = useState<number[]>([]);
  const [events, setEvents] = useState<ScanEvent[]>([]);
  const [state, setState] = useState<ScanState>("ready");
  const [message, setMessage] = useState("Enter angles to start a scan.");
  const running = state === "running";

  // Each move begins a new row, even if two successive targets are equal.
  const steps = events.reduce<ScanEvent[]>((rows, event) => {
    if (event.status === "moving") rows.push(event);
    else rows[rows.length - 1] = event;
    return rows;
  }, []);
  const lastReached = [...steps].reverse().find((step) => step.status === "reached");
  const reported = lastReached?.status === "reached" ? lastReached.position : undefined;
  const active = steps[steps.length - 1];
  const target = running && active?.status === "moving" ? active.target : undefined;
  const completed = steps.filter((step) => step.status === "reached").length;

  async function startScan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (running) return;

    const parts = input.split(",").map((part) => part.trim());
    const angles = parts.map(Number);
    if (parts.some((part) => !part) || angles.some((angle) => !Number.isFinite(angle) || angle < 0 || angle > 90)) {
      setState("error");
      setMessage("Enter comma-separated angles between 0° and 90°.");
      return;
    }

    setEvents([]);
    setPlan(angles);
    setState("running");
    setMessage("Connecting to the virtual stage…");

    try {
      const response = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ angles }),
      });

      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(result?.error ?? `Could not start the scan (HTTP ${response.status}).`);
      }

      if (!response.body || !response.headers.get("content-type")?.includes("application/x-ndjson")) {
        throw new Error("Expected scan updates. Restart the streaming scan server and try again.");
      }

      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
      let pending = "";
      let terminal: Extract<ScanUpdate, { status: "complete" | "error" }> | undefined;

      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          pending += value;
          const lines = pending.split("\n");
          pending = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.trim()) continue;
            const update = JSON.parse(line) as ScanUpdate;
            if (update.status === "complete" || update.status === "error") {
              terminal = update;
              continue;
            }
            setEvents((previous) => [...previous, update]);
            if (update.status === "moving") setMessage(`Moving to ${update.target}°…`);
          }
        }
      } finally {
        reader.releaseLock();
      }

      if (!terminal) throw new Error("Connection ended before the scan result was confirmed.");
      if (terminal.status === "error") throw new Error(terminal.message);
      setState("complete");
      setMessage("All positions read back.");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Could not read scan updates.");
    }
  }

  return (
    <main className="scan-console">
      <header className="scan-header">
        <div>
          <h1>Rotary Stage Scan</h1>
          <p>Zaber X-RST240B-E08 · Virtual device</p>
        </div>
        <span className={`scan-pill ${state}`}>{stateLabels[state]}</span>
      </header>

      <div className="scan-layout">
        <section className="scan-panel position-panel" aria-labelledby="position-title">
          <h2 id="position-title">Stage position</h2>
          <div className="scan-gauge" aria-hidden="true">
            <div className="gauge-ring" />
            {Array.from({ length: 24 }, (_, index) => (
              <span key={index} className={`gauge-tick ${index % 6 === 0 ? "major" : ""}`} style={{ rotate: `${index * 15}deg` }} />
            ))}
            <span className="gauge-zero">0°</span>
            <span className="gauge-ninety">90°</span>
            {target !== undefined && <span className="gauge-needle target" style={{ rotate: `${target}deg` }} />}
            {reported !== undefined && <span className="gauge-needle" style={{ rotate: `${reported}deg` }} />}
            <span className="gauge-hub" />
          </div>
          <div className="scan-readouts">
            <div><span>Last reported</span><strong>{reported === undefined ? "—" : `${reported.toFixed(2)}°`}</strong></div>
            <div><span>Active target</span><strong>{target === undefined ? "—" : `${target}°`}</strong></div>
          </div>
        </section>

        <div className="scan-workflow">
          <section className="scan-panel" aria-labelledby="plan-title">
            <h2 id="plan-title">Scan plan</h2>
            <form onSubmit={startScan}>
              <label htmlFor="angles">Target angles</label>
              <div className="scan-input-row">
                <input id="angles" value={input} onChange={(event) => setInput(event.target.value)} disabled={running} aria-describedby="angle-help" />
                <button type="submit" disabled={running}>{running ? "Scanning…" : "Run scan"}</button>
              </div>
              <p id="angle-help" className="scan-hint">Comma-separated · 0° to 90°</p>
            </form>
            <p role="status" className={`scan-message ${state}`}>{message}</p>
          </section>

          <section className="scan-panel" aria-labelledby="results-title">
            <div className="scan-results-heading">
              <h2 id="results-title">Scan results</h2>
              {plan.length > 0 && <span>{completed} / {plan.length} reached</span>}
            </div>
            {plan.length === 0 ? <p className="scan-empty">Position readbacks will appear here.</p> : (
              <div className="scan-table">
                <table>
                  <thead><tr><th scope="col">Target</th><th scope="col">Reported</th><th scope="col">Status</th></tr></thead>
                  <tbody>
                    {plan.map((angle, index) => {
                      const step = steps[index];
                      const status = step?.status ?? "queued";
                      const label = status === "moving" && state === "error" ? "Unconfirmed" :
                        { queued: "Queued", moving: "Moving", reached: "Reached", failed: "Failed" }[status];
                      return (
                        <tr key={index}>
                          <td>{angle}°</td>
                          <td>{step?.status === "reached" ? `${step.position.toFixed(2)}°` : "—"}</td>
                          <td><span className={`scan-pill ${status}`}>{label}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
