import { describe, expect, it } from "vitest";
import { runChildProcess } from "./server-utils.js";

describe("runChildProcess", () => {
  it("preserves utf8 text split across stdout chunks", async () => {
    const script = `
const bytes = Buffer.from("한글 문서 저장", "utf8");
process.stdout.write(bytes.subarray(0, 1));
setTimeout(() => process.stdout.write(bytes.subarray(1)), 10);
`;
    const logChunks: string[] = [];

    const result = await runChildProcess("test-run", process.execPath, ["-e", script], {
      cwd: process.cwd(),
      env: {},
      timeoutSec: 5,
      graceSec: 1,
      onLog: async (stream, chunk) => {
        if (stream === "stdout") logChunks.push(chunk);
      },
    });

    expect(result.stdout).toBe("한글 문서 저장");
    expect(logChunks.join("")).toBe("한글 문서 저장");
  });
});
