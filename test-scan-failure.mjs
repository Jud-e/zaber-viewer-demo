import assert from "node:assert/strict";
import { runAngularScan } from "./run-angular-scan.mjs";

const commands = [];
const events = [];
let position;

const stage = {
  async moveTo(angle) {
    commands.push(angle);
    if (angle === 40) throw new Error("Simulated move failure");
    position = angle;
  },
  async getPosition() {
    return position;
  },
};

await assert.rejects(
  runAngularScan([10, 40, 20], stage, (event) => events.push(event)),
  /Simulated move failure/,
);

assert.deepEqual(commands, [10, 40]);
assert.deepEqual(events.at(-1), {
  status: "failed",
  target: 40,
  lastConfirmedPosition: 10,
  message: "Simulated move failure",
});

console.log("PASS: scan stopped at 40°. No command was sent for 20°.");