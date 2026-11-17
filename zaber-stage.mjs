import { Library, Units } from "@zaber/motion";
import { Connection } from "@zaber/motion/ascii";
import { runAngularScan } from "./run-angular-scan.mjs";

export async function scanWithZaber(cloudId, angles, onProgress) {
  Library.enableDeviceDbStore();
  const connection = await Connection.openIot(cloudId);

  try {
    const [device] = await connection.detectDevices();
    if (device?.name !== "X-RST240B-E08") {
      throw new Error("Expected the X-RST240B-E08 virtual rotary stage.");
    }

    const axis = device.getAxis(1);
    if (!(await axis.isHomed())) {
      await axis.home();
    }

    const stage = {
      moveTo: (angle) => axis.moveAbsolute(angle, Units.ANGLE_DEGREES),
      getPosition: () => axis.getPosition(Units.ANGLE_DEGREES),
    };

    await runAngularScan(angles, stage, onProgress);
  } finally {
    await connection.close();
  }
}