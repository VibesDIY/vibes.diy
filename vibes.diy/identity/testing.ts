// Test-only surface of @vibes.diy/identity (#2937).
//
// The device-id test harness (`createTestDeviceCA` / `createTestUser`) plus the
// device-id crypto classes the api/cli test suites construct directly. This is
// the in-repo replacement for the `@fireproof/core-device-id` value import that
// ~70 api test files used to reach for. Kept on a dedicated subpath so the test
// helpers never leak into the shipped `.` / `./node` bundles.
export { createTestDeviceCA, createTestUser } from "./device-id/test-helpers.js";
export type { CreateTestUserParams, TestUser } from "./device-id/test-helpers.js";
export { DeviceIdKey } from "./device-id/key.js";
export { DeviceIdSignMsg } from "./device-id/sign.js";
export { DeviceIdCSR } from "./device-id/csr.js";
export { DeviceIdVerifyMsg } from "./device-id/verify.js";
export { DeviceIdCA } from "./device-id/ca.js";
