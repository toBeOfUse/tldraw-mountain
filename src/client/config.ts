export const BACKEND_URL = `${window.location.protocol}//${window.location.hostname}${
  window.location.protocol === "http:" ? ":5858" : ""
}`;

// single-room setup with hardcoded id
export const roomId = "test-room";
