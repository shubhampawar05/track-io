import assert from "node:assert/strict";
import { validateAudioUploadInput } from "../services/recordingStorage.service";

function fakeFile(input: Partial<Express.Multer.File>): Express.Multer.File {
  return {
    fieldname: "file",
    originalname: input.originalname ?? "recording.webm",
    encoding: "7bit",
    mimetype: input.mimetype ?? "audio/webm",
    size: input.size ?? 1024,
    destination: "",
    filename: "",
    path: "",
    stream: undefined as never,
    buffer: input.buffer ?? Buffer.from("123"),
  };
}

function run() {
  validateAudioUploadInput(fakeFile({ mimetype: "audio/webm", size: 1024 }));
  validateAudioUploadInput(fakeFile({ mimetype: "audio/mp4", size: 1024 }));

  assert.throws(() => validateAudioUploadInput(fakeFile({ mimetype: "video/mp4" })), /Unsupported audio format/);
  assert.throws(() => validateAudioUploadInput(fakeFile({ buffer: Buffer.alloc(0) })), /Audio file is empty/);
  assert.throws(
    () => validateAudioUploadInput(fakeFile({ size: 16 * 1024 * 1024 })),
    /Audio file too large/,
  );
}

run();
console.log("recording upload validation tests passed");
