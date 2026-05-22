# OneTap Mobile

React Native + Expo mobile app for the OneTap secure file sharing platform.

## Features

- 🔐 **End-to-end encryption** — AES-256-GCM encryption happens on-device before upload
- 🔗 **One-time access links** — each link can only be used once
- ⏱️ **Custom expiry** — set links to expire in minutes, hours, or days
- 📁 **File support** — images, PDFs, text files
- 📋 **Copy to clipboard** — instantly copy generated links
- 📤 **Share files** — use native share sheet to open/share decrypted files
- 🌙 **Dark purple UI** — matches the design reference

## Screens

| Screen | Description |
|--------|-------------|
| **Splash** | Animated intro with progress bar |
| **Home** | Dashboard with cloud storage banner, file categories, recent files, and open-link modal |
| **Upload** | Pick a file, set expiry, encrypt & upload, copy the generated link |
| **View** | Paste a secure link or navigate from Home to decrypt and view a file |
| **About** | Team profiles with social links and feature list |

## Setup

```bash
# Install dependencies (already done)
npm install

# Start the Expo development server
npx expo start
```

Then scan the QR code with **Expo Go** on your phone, or press:
- `a` — open Android emulator
- `i` — open iOS simulator (macOS only)
- `w` — open in web browser

## Project Structure

```
OneTap-Mobile/
├── App.js                    # Root navigator (Stack + Bottom Tabs)
├── src/
│   ├── screens/
│   │   ├── SplashScreen.js   # Animated splash / onboarding
│   │   ├── HomeScreen.js     # Dashboard + open-link modal
│   │   ├── UploadScreen.js   # File picker, encrypt, upload
│   │   ├── ViewScreen.js     # Decrypt and preview files
│   │   └── AboutScreen.js    # Team info and features
│   ├── components/
│   │   ├── GradientCard.js   # Reusable gradient card
│   │   └── ToastConfig.js    # Custom toast notifications
│   ├── services/
│   │   └── api.js            # Backend API calls
│   ├── utils/
│   │   └── encryptionHandler.js  # AES-GCM encrypt/decrypt
│   └── constants/
│       └── theme.js          # Colors, fonts, sizes
```

## Backend API

The app connects to: `https://respectable-jaclyn-koyebuser1-38d6aeac.koyeb.app/api`

Endpoints used:
- `GET /redis/usage` — check available storage
- `POST /files/upload?expiryMinutes=N` — upload encrypted file
- `GET /files/view/:fileId` — download encrypted file (one-time)

## How Encryption Works

1. User picks a file on their device
2. File is read as an ArrayBuffer
3. A random AES-256-GCM key + IV are generated
4. File is encrypted in-memory
5. Encrypted bytes are written to a temp cache file
6. Temp file is uploaded to the server
7. The decryption key is embedded in the shareable link as a URL fragment (`#key=...`)
8. The server never sees the plaintext key — only the recipient with the full link can decrypt

## Notes

- PDF preview requires opening via the native share sheet (no in-app PDF renderer)
- The `crypto.subtle` Web Crypto API is available in React Native via Hermes engine
- `expo-document-picker` requires the `expo-document-picker` plugin in `app.json`
