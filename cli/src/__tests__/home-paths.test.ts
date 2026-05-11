import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  describeLocalInstancePaths,
  expandHomePrefix,
  resolveAutomanagerHomeDir,
  resolveAutomanagerInstanceId,
} from "../config/home.js";

const ORIGINAL_ENV = { ...process.env };

describe("home path resolution", () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("defaults to ~/.automanager and default instance", () => {
    delete process.env.AUTOMANAGER_HOME;
    delete process.env.AUTOMANAGER_INSTANCE_ID;

    const paths = describeLocalInstancePaths();
    expect(paths.homeDir).toBe(path.resolve(os.homedir(), ".automanager"));
    expect(paths.instanceId).toBe("default");
    expect(paths.configPath).toBe(path.resolve(os.homedir(), ".automanager", "instances", "default", "config.json"));
  });

  it("supports AUTOMANAGER_HOME and explicit instance ids", () => {
    process.env.AUTOMANAGER_HOME = "~/paperclip-home";

    const home = resolveAutomanagerHomeDir();
    expect(home).toBe(path.resolve(os.homedir(), "paperclip-home"));
    expect(resolveAutomanagerInstanceId("dev_1")).toBe("dev_1");
  });

  it("rejects invalid instance ids", () => {
    expect(() => resolveAutomanagerInstanceId("bad/id")).toThrow(/Invalid instance id/);
  });

  it("expands ~ prefixes", () => {
    expect(expandHomePrefix("~")).toBe(os.homedir());
    expect(expandHomePrefix("~/x/y")).toBe(path.resolve(os.homedir(), "x/y"));
  });
});
