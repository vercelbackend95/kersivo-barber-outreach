import { runCalibrationCli } from '../../src/lib/recommendations/calibration/cli/runCalibrationCli';

async function main(): Promise<void> {
  const exitCode = await runCalibrationCli(process.argv.slice(2));
  process.exit(exitCode);
}

main();
