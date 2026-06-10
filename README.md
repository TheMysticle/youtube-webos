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

---

## Requirements

- A Samsung Tizen TV (Tizen 9+ tested).
- Tizen CLI tools installed on your development machine.

---

## Installation & Deployment (Tizen CLI)

To install this app on your Samsung TV, you will need the official [Tizen Studio](https://developer.tizen.org/development/tizen-studio/download) along with the TV extension installed on your development machine.

### 1. Enable Developer Mode on the TV
1. On your Samsung TV, open the **Apps** panel.
2. Press `1`, `2`, `3`, `4`, `5` on your remote to open the Developer Mode dialog.
3. Toggle **Developer Mode** to ON, and enter the local IP address of your computer.
4. Restart the TV by holding the power button on the remote.

### 2. Connect to the TV
Find your TV's IP address (e.g., `192.168.1.100`). Using the Tizen `sdb` tool, connect to it on port `26101`:
```sh
sdb connect 192.168.1.100:26101
```

### 3. Create a Certificate Profile
Samsung TVs require all apps to be signed by a valid developer certificate.
1. Open the **Tizen Certificate Manager** (included with Tizen Studio).
2. Click **+** to create a new certificate profile. Name it (e.g., `MyTizenCert`).
3. Select **Samsung** as the certificate type and follow the steps to log into your Samsung Account to generate the Author and Distributor certificates.
4. Ensure your TV is connected via `sdb` so the Certificate Manager can add your TV's Device ID (e.g., `TV_DEVICE_ID`) to the permitted devices list.

### 4. Build the Application
Clone this repository, install dependencies, and build the Webpack bundle:
```sh
npm install
npm run build:tizen
```
This compiles the web app and prepares the `dist` directory with the required `config.xml`.

### 5. Package the WGT Archive
Package the application using the Tizen CLI, specifying your certificate profile name (`MyTizenCert`):
```sh
tizen package -t wgt -s MyTizenCert -o ./YouTubeAdFree.wgt -- dist
```

### 6. Install to the TV
Install the compiled `.wgt` archive directly to your connected TV:
```sh
tizen install -n ./YouTubeAdFree.wgt/YouTubeAdFree.wgt -s 192.168.1.100:26101
```

### 7. Launch the App
You can launch the app directly from the terminal using your TV's Device ID (which you can find by running `sdb devices`):
```sh
tizen run -p ytadfree99.YouTubeAdFree -t TV_DEVICE_ID
```
