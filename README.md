<h1 align="center">
  YouTube Ad-Free (Samsung Tizen Port)
</h1>

<p align="center">
  YouTube app for Samsung Tizen TV with ad blocking and other enhancements
</p>

---

## Features

- Ad Blocking
- [SponsorBlock](https://sponsor.ajay.app/) Integration
- Force Highest Video Quality
- Audio-Only Mode (🟦 Blue button on remote)
- Full Animation Support
- Shorts Removal
- Higher-Quality Thumbnails
- On-Screen Clock Overlay
- YouTube Logo Removal
- Remove end screens
- Bypass account selector screen

> [!NOTE]
> Press the 🟩 **Green** button on your remote to access the configuration screen.
> Press the 🟨 **Yellow** button on your remote to toggle the UI Overlay Inspector.
> Press the 🟥 **Red** button on your remote to toggle the on-screen Debug Console.

---

## Known Issues (Not Working)

Some features are currently being debugged or adapted for the Tizen platform:
- **Timeline Scrubbing Thumbnails**: Thumbnails occasionally appear black or fail to render during timeline scrubbing.
- **Clock Visibility**: The on-screen clock overlay may hide inconsistently depending on the player focus state.
- **Debug Watermark**: The `yt-debug-watermark` overlay periodically appears on screen; currently utilizing aggressive mutation observers to hide it.

---

## Requirements

- A Samsung Tizen TV (Tizen 9+ tested).
- Tizen CLI tools installed on your development machine.

---

## Installation (Tizen CLI)

You can install the app using the official Samsung Tizen CLI tools. Ensure you have the Tizen Studio and TV extensions installed.

### Building a WGT

```sh
npm install
npm run build:tizen
```

This compiles the web app and copies the Tizen `config.xml` to the `dist` directory.

### Packaging

Package the application using the Tizen CLI (replace `MystileTV` with your actual certificate profile name):

```sh
tizen package -t wgt -s MystileTV -o ./YouTubeAdFree.wgt -- dist
```

### Installing to the TV

Install the compiled `.wgt` archive directly to your TV using its IP address (e.g., `192.168.1.116:26101`):

```sh
tizen install -n ./YouTubeAdFree.wgt/YouTubeAdFree.wgt -s 192.168.1.116:26101
```
