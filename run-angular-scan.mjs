export async function runAngularScan(angles, stage, onProgress) {
  let lastConfirmedPosition;

  for (const target of angles) {
    onProgress({ status: "moving", target });

    let position;
    try {
      await stage.moveTo(target);
      position = await stage.getPosition();
    } catch (error) {
      onProgress({
        status: "failed",
        target,
        lastConfirmedPosition,
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }

    lastConfirmedPosition = position;
    onProgress({ status: "reached", target, position });
  }
}