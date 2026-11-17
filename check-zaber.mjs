import { Library, Units } from "@zaber/motion";
import { Connection } from "@zaber/motion/ascii";
import { runAngularScan } from "./run-angular-scan.mjs";

async function main() {
  const [cloudId, ...angleArgs] = process.argv.slice(2);

if (!cloudId || angleArgs.length === 0) {
  throw new Error("Usage: node check-zaber.mjs CLOUD_ID 15 30 45");
}

const angles = angleArgs.map(Number);

if (angleArgs.some((arg) => arg.trim() === "") ||
    angles.some((angle) => !Number.isFinite(angle) || angle < 0 || angle > 90)) {
  throw new Error("Enter angles between 0 and 90 degrees for this demo.");
}

  Library.enableDeviceDbStore();
  const connection = await Connection.openIot(cloudId);

  try {
    const devices = await connection.detectDevices();
    console.log(`Found ${devices.length} device(s).`);

    const device = devices[0];
if (!device || device.name !== "X-RST240B-E08") {
  throw new Error("Expected the X-RST240B-E08 virtual rotary stage.");
}

const axis = device.getAxis(1);

if (!(await axis.isHomed())) {
  console.log("Finding the stage's reference position…");
  await axis.home();
}

const stage = {
  moveTo: (angle) => axis.moveAbsolute(angle, Units.ANGLE_DEGREES),
  getPosition: () => axis.getPosition(Units.ANGLE_DEGREES),
};

await runAngularScan(angles, stage, (event) => {
  if (event.status === "moving") {
    console.log(`Moving to ${event.target}°…`);
  } else if (event.status === "reached") {
    console.log(`Stage reports ${event.position.toFixed(2)}°`);
  } else {
    const last = event.lastConfirmedPosition;
    console.error(
      `Scan stopped at target ${event.target}°. ` +
      (last === undefined
        ? "No position confirmed yet."
        : `Last confirmed position was ${last.toFixed(2)}°.`),
    );
  }
});
  } finally {
    await connection.close();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});