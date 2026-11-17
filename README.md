# Rotary Stage Scan Controller

A React and Node.js app that runs programmable angular scans on a
Zaber X-RST240B-E08 virtual rotary stage using the Zaber Motion Library.

[Watch the demo](https://drive.google.com/file/d/1Y5t55ci89-jr6zGwK1x7dicItqqGKVpu/view?usp=sharing)

## How it works

Enter a sequence of angles in the browser. The Node server sends one move
at a time through the Zaber SDK, waits for it to finish, and reads back
the reported position. The server streams progress to React, which
displays the current target and the last reported angle.

## Run locally

1. Start an X-RST240B-E08 session in the Zaber Virtual Device viewer.
2. Set `ZABER_CLOUD_ID` in PowerShell and run `node scan-server.mjs`.
3. Run `npm run dev` in the React project and open the Vite URL.
4. Try `5, 85, 15` to see the stage change direction.

## Test failure handling

Run `node test-scan-failure.mjs`. The test injects a failed move at 40°
and checks that the controller reports 10° as the last confirmed
position and sends no command for 20°.